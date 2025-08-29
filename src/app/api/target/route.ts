// src/app/api/target/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import TargetSheet from '@/models/TargetSheet';
import Invoice from '@/models/invoice'; // Assuming this model also has tenantId
import Appointment from '@/models/Appointment'; // Assuming this model also has tenantId
import mongoose from 'mongoose';


export const dynamic = 'force-dynamic';

const roundToTwo = (num: number): number => {
    if (isNaN(num) || num === null) return 0;
    return Number(Math.round(Number(num + 'e+2')) + 'e-2');
};

export async function GET(request: Request) {
    try {
        await dbConnect();
        const session = await getServerSession(authOptions);

        if (!session?.user?.tenantId) {
            return NextResponse.json({ message: 'Authentication failed or tenant not found.' }, { status: 401 });
        }
        const tenantId = new mongoose.Types.ObjectId(session.user.tenantId);
        
        // --- MODIFIED ---: Read date range from query parameters
        const { searchParams } = new URL(request.url);
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        let startDate: Date;
        let endDate: Date;
        const now = new Date();

        if (startDateParam && endDateParam) {
            startDate = new Date(startDateParam);
            endDate = new Date(endDateParam);
            endDate.setHours(23, 59, 59, 999); // Set to the end of the day
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        }

        // --- Use current month for fetching targets, as targets are typically monthly ---
        const monthIdentifier = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        let targetSheet = await TargetSheet.findOne({ month: monthIdentifier, tenantId: tenantId });

        if (!targetSheet) {
            targetSheet = { target: {} } as any;
        }

        const targets = {
            service: targetSheet.target?.service || 0,
            retail: targetSheet.target?.retail || 0,
            bills: targetSheet.target?.bills || 0,
            abv: targetSheet.target?.abv || 0,
            callbacks: targetSheet.target?.callbacks || 0,
            appointments: targetSheet.target?.appointments || 0,
            netSales: (targetSheet.target?.service || 0) + (targetSheet.target?.retail || 0),
        };

        const invoiceAggregation = await Invoice.aggregate([
            { $match: { 
                tenantId: tenantId, 
                // --- MODIFIED ---: Use dynamic date range
                createdAt: { $gte: startDate, $lte: endDate }, 
                paymentStatus: 'Paid' 
            }},
            { $project: {
                grandTotal: { $toDouble: "$grandTotal" },
                serviceTotal: { $toDouble: "$serviceTotal" },
                productTotal: { $toDouble: "$productTotal" }
            }},
            { $addFields: { preDiscountTotal: { $add: ["$serviceTotal", "$productTotal"] } }},
            { $project: {
                grandTotal: 1,
                actualServiceRevenue: { $cond: { if: { $gt: ["$preDiscountTotal", 0] }, then: { $multiply: ["$grandTotal", { $divide: ["$serviceTotal", "$preDiscountTotal"] }] }, else: 0 }},
                actualRetailRevenue: { $cond: { if: { $gt: ["$preDiscountTotal", 0] }, then: { $multiply: ["$grandTotal", { $divide: ["$productTotal", "$preDiscountTotal"] }] }, else: 0 }}
            }},
            { $group: {
                _id: null,
                totalService: { $sum: '$actualServiceRevenue' },
                totalRetail: { $sum: '$actualRetailRevenue' },
                totalBills: { $sum: 1 },
                totalGrandAmount: { $sum: '$grandTotal' }
            }}
        ]);

        const achievedResult = invoiceAggregation[0] || {};
        
        const achievedAppointmentsCount = await Appointment.countDocuments({
            tenantId: tenantId,
            // --- MODIFIED ---: Use dynamic date range
            appointmentDateTime: { $gte: startDate, $lte: endDate },
            status: { $nin: ['Cancelled', 'No-Show'] }
        });

        const achievedNetSales = (achievedResult.totalService || 0) + (achievedResult.totalRetail || 0);

        const achieved = {
            service: roundToTwo(achievedResult.totalService || 0),
            retail: roundToTwo(achievedResult.totalRetail || 0),
            bills: achievedResult.totalBills || 0,
            netSales: roundToTwo(achievedNetSales),
            abv: (achievedResult.totalBills > 0) ? roundToTwo(achievedResult.totalGrandAmount / achievedResult.totalBills) : 0,
            callbacks: 0,
            appointments: achievedAppointmentsCount,
        };
        
        // --- MODIFIED ---: Updated projection logic for custom date ranges
        let headingTo = { ...achieved }; // Default to achieved if the range is in the past.
        const today = new Date();

        // Only calculate projection if the selected range includes today
        if (today >= startDate && today <= endDate) {
            const totalDaysInRange = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24) + 1;
            const daysPassedInRange = (today.getTime() - startDate.getTime()) / (1000 * 3600 * 24) + 1;
            const projectionFactor = daysPassedInRange > 0 ? totalDaysInRange / daysPassedInRange : 0;
            
            headingTo = {
                service: roundToTwo(achieved.service * projectionFactor),
                retail: roundToTwo(achieved.retail * projectionFactor),
                bills: Math.round(achieved.bills * projectionFactor),
                netSales: roundToTwo(achieved.netSales * projectionFactor),
                abv: achieved.abv, // ABV is an average, so we don't project it.
                callbacks: Math.round(achieved.callbacks * projectionFactor),
                appointments: Math.round(achieved.appointments * projectionFactor),
            };
        }


        return NextResponse.json({
            month: monthIdentifier,
            summary: { target: targets, achieved: achieved, headingTo: headingTo }
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
        console.error("API Error GET /api/target:", error);
        return NextResponse.json({ message: "Error fetching target data", error: errorMessage }, { status: 500 });
    }
}

// --- PUT function remains unchanged ---
export async function PUT(request: Request) {
    await dbConnect();
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) {
            return NextResponse.json({ message: 'Authentication failed or tenant not found.' }, { status: 401 });
        }
        const tenantId = session.user.tenantId;

        const body = await request.json();
        const now = new Date();
        const monthIdentifier = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        await TargetSheet.findOneAndUpdate(
            { month: monthIdentifier, tenantId: tenantId },
            { 
                $set: {
                    tenantId: tenantId,
                    'target.service': Number(body.service) || 0,
                    'target.retail': Number(body.retail) || 0,
                    'target.bills': Number(body.bills) || 0,
                    'target.abv': Number(body.abv) || 0,
                    'target.callbacks': Number(body.callbacks) || 0,
                    'target.appointments': Number(body.appointments) || 0,
                }
            },
            { new: true, upsert: true, runValidators: true }
        );

        return NextResponse.json({ success: true, message: "Targets updated successfully." });
    } catch (error) {
        const detailedErrorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
        console.error("API Error PUT /api/target:", error);
        return NextResponse.json({ message: "Error updating targets", error: detailedErrorMessage }, { status: 500 });
    }
}