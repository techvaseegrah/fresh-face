// src/app/api/target/route.ts - FINAL CORRECTED VERSION

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import TargetSheet from '@/models/TargetSheet';
import Invoice from '@/models/invoice'; // Using your provided Invoice model
import Appointment from '@/models/Appointment'; // Still needed for counting appointments

// This is crucial. It tells Next.js to run this route dynamically for every request,
// ensuring the data is always fresh and not cached from a previous build.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();

        // Define the date range for the current month.
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        // Fetch the sales targets for the current month.
        const monthIdentifier = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let targetSheet = await TargetSheet.findOne({ month: monthIdentifier });

        // If no target sheet exists, create a default structure to avoid errors.
        if (!targetSheet) {
            targetSheet = { target: {} };
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

        // --- CORRECTED AGGREGATION LOGIC FOR YOUR INVOICE MODEL ---
        // This pipeline correctly calculates the final, post-discount revenue.
        const invoiceAggregation = await Invoice.aggregate([
            // Stage 1: Match only 'Paid' invoices created within the current month.
            {
                $match: {
                    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
                    paymentStatus: 'Paid'
                }
            },
            // Stage 2: Project and cast fields to ensure they are treated as precise decimals.
            {
                $project: {
                    grandTotal: { $toDouble: "$grandTotal" },
                    serviceTotal: { $toDouble: "$serviceTotal" },
                    productTotal: { $toDouble: "$productTotal" }
                }
            },
            // Stage 3: Calculate the pre-discount total to find the proportion.
            {
                $addFields: {
                    preDiscountTotal: { $add: ["$serviceTotal", "$productTotal"] },
                }
            },
            // Stage 4: Calculate the actual service and retail revenue by proportionally
            // distributing the final paid amount (grandTotal).
            {
                $project: {
                    grandTotal: 1,
                    actualServiceRevenue: {
                        $cond: {
                            if: { $gt: ["$preDiscountTotal", 0] },
                            then: {
                                $multiply: ["$grandTotal", { $divide: ["$serviceTotal", "$preDiscountTotal"] }]
                            },
                            else: 0
                        }
                    },
                    actualRetailRevenue: {
                        $cond: {
                            if: { $gt: ["$preDiscountTotal", 0] },
                            then: {
                                $multiply: ["$grandTotal", { $divide: ["$productTotal", "$preDiscountTotal"] }]
                            },
                            else: 0
                        }
                    }
                }
            },
            // Stage 5: Group all invoices to sum up the final calculated values.
            {
                $group: {
                    _id: null, // Group all results together
                    totalService: { $sum: '$actualServiceRevenue' }, // Sum of actual service revenue
                    totalRetail: { $sum: '$actualRetailRevenue' },   // Sum of actual retail revenue
                    totalBills: { $sum: 1 },                          // Count the number of paid invoices
                    totalGrandAmount: { $sum: '$grandTotal' }         // Sum of grand totals (used for ABV)
                }
            }
        ]);

        // Safely access the aggregation result.
        const achievedResult = invoiceAggregation[0] || {};
        
        // Fetch count of all non-cancelled appointments for the month. This still uses the Appointment model.
        const achievedAppointmentsCount = await Appointment.countDocuments({
            appointmentDateTime: { $gte: startOfMonth, $lte: endOfMonth },
            status: { $nin: ['Cancelled', 'No-Show'] }
        });

        // Net sales is the sum of the post-discount service and retail revenues.
        const achievedNetSales = (achievedResult.totalService || 0) + (achievedResult.totalRetail || 0);

        const achieved = {
            service: achievedResult.totalService || 0,
            retail: achievedResult.totalRetail || 0,
            bills: achievedResult.totalBills || 0,
            netSales: achievedNetSales,
            // Calculate Average Bill Value (ABV) safely, avoiding division by zero.
            abv: (achievedResult.totalBills > 0) ? (achievedResult.totalGrandAmount / achievedResult.totalBills) : 0,
            callbacks: 0, // Placeholder for callbacks logic
            appointments: achievedAppointmentsCount,
        };

        const daysInMonth = endOfMonth.getDate();
        const dayOfMonth = now.getDate();
        const projectionFactor = dayOfMonth > 0 ? daysInMonth / dayOfMonth : 0;

        const headingTo = {
            service: achieved.service * projectionFactor,
            retail: achieved.retail * projectionFactor,
            bills: achieved.bills * projectionFactor,
            netSales: achieved.netSales * projectionFactor,
            abv: achieved.abv, // ABV is an average, so no projection
            callbacks: achieved.callbacks * projectionFactor,
            appointments: achieved.appointments * projectionFactor,
        };

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

// The PUT handler for setting targets is correct and does not need changes.
export async function PUT(request: Request) {
    await dbConnect();
    try {
        const body = await request.json();
        const now = new Date();
        const monthIdentifier = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        await TargetSheet.findOneAndUpdate(
            { month: monthIdentifier },
            { 
                $set: {
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
        return NextResponse.json({ message: "Error updating targets", error: detailedErrorMessage }, { status: 500 });
    }
}