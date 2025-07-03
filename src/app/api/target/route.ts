// src/app/api/target/route.ts - KEEP THIS VERSION

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import TargetSheet from '@/models/TargetSheet';
import Invoice from '@/models/invoice';
import Appointment from '@/models/Appointment';

export const dynamic = 'force-dynamic'; // This is important

export async function GET(request: Request) { // Added request to access URL
    // Log the incoming request to see the cache-buster
    console.log("GET /api/target called with URL:", request.url);
    // ... rest of your GET handler is correct ...
    await dbConnect();
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const monthIdentifier = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let targetSheet = await TargetSheet.findOne({ month: monthIdentifier });
        if (!targetSheet) {
            targetSheet = new TargetSheet({ month: monthIdentifier, target: {} });
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
            { $match: { createdAt: { $gte: startOfMonth, $lte: endOfMonth }, paymentStatus: 'Paid' } },
            { $group: { _id: null, totalService: { $sum: '$serviceTotal' }, totalRetail: { $sum: '$productTotal' }, totalBills: { $sum: 1 }, totalGrandAmount: { $sum: '$grandTotal' } } }
        ]);
        const achievedAppointmentsCount = await Appointment.countDocuments({
            createdAt: { $gte: startOfMonth, $lte: endOfMonth },
            status: { $nin: ['Cancelled', 'No-Show'] }
        });
        const achievedResult = invoiceAggregation[0] || {};
        const achievedNetSales = (achievedResult.totalService || 0) + (achievedResult.totalRetail || 0);
        const achieved = {
            service: achievedResult.totalService || 0,
            retail: achievedResult.totalRetail || 0,
            bills: achievedResult.totalBills || 0,
            netSales: achievedNetSales,
            abv: (achievedResult.totalBills > 0) ? ((achievedResult.totalGrandAmount || 0) / achievedResult.totalBills) : 0,
            callbacks: 0,
            appointments: achievedAppointmentsCount,
        };
        const daysInMonth = endOfMonth.getDate();
        const dayOfMonth = now.getDate();
        const projectionFactor = dayOfMonth > 0 ? daysInMonth / dayOfMonth : 0;
        const headingTo = {
            service: (achieved.service ?? 0) * projectionFactor,
            retail: (achieved.retail ?? 0) * projectionFactor,
            bills: (achieved.bills ?? 0) * projectionFactor,
            netSales: (achieved.netSales ?? 0) * projectionFactor,
            abv: achieved.abv ?? 0,
            callbacks: (achieved.callbacks ?? 0) * projectionFactor,
            appointments: (achieved.appointments ?? 0) * projectionFactor,
        };
        const responseData = {
            _id: targetSheet._id ? targetSheet._id.toString() : 'new',
            month: targetSheet.month,
            summary: { target: targets, achieved: achieved, headingTo: headingTo }
        };
        return NextResponse.json(responseData);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
        console.error("API Error GET /api/target:", error);
        return NextResponse.json({ message: "Error fetching data", error: errorMessage }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    await dbConnect();
    try {
        const body = await request.json();
        console.log("SERVER RECEIVED IN PUT /api/target:", body);
        const now = new Date();
        const monthIdentifier = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let targetSheet = await TargetSheet.findOne({ month: monthIdentifier });
        if (!targetSheet) {
            targetSheet = new TargetSheet({ month: monthIdentifier, target: {} });
        }
        targetSheet.target.service = Number(body.service) || 0;
        targetSheet.target.retail = Number(body.retail) || 0;
        targetSheet.target.bills = Number(body.bills) || 0;
        targetSheet.target.abv = Number(body.abv) || 0;
        targetSheet.target.callbacks = Number(body.callbacks) || 0;
        targetSheet.target.appointments = Number(body.appointments) || 0;
        const savedSheet = await targetSheet.save();
        return NextResponse.json(savedSheet);
    } catch (error) {
        console.error("API Error PUT /api/target: [CRITICAL]", error);
        let detailedErrorMessage = "An unknown server error occurred.";
        if (error instanceof Error) {
            if (error.name === 'ValidationError') {
                const validationErrors = Object.values((error as any).errors).map((err: any) => err.message);
                detailedErrorMessage = `Database Validation Failed: ${validationErrors.join(', ')}`;
            } else {
                detailedErrorMessage = error.message;
            }
        }
        return NextResponse.json({ message: detailedErrorMessage, error: "Error updating targets" }, { status: 500 });
    }
}