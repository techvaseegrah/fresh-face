// /app/api/incentives/reviews/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import { getTenantIdOrBail } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        await dbConnect();
        const tenantId = getTenantIdOrBail(request as any);
        if (tenantId instanceof NextResponse) return tenantId;

        const { searchParams } = new URL(request.url);
        const staffId = searchParams.get('staffId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!staffId || !startDate || !endDate) {
            return NextResponse.json({ message: 'Staff ID, Start Date, and End Date are required.' }, { status: 400 });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const sales = await DailySale.find({
            tenantId,
            staff: staffId,
            date: { $gte: start, $lte: end }
        }).select('date reviewsWithName reviewsWithPhoto').lean();

        // Remap the data into an object for easy lookup on the frontend
        const reviewData: { [date: string]: { reviewsWithName: number, reviewsWithPhoto: number } } = {};
        
        sales.forEach(sale => {
            const dateString = new Date(sale.date).toISOString().split('T')[0];
            reviewData[dateString] = {
                reviewsWithName: sale.reviewsWithName || 0,
                reviewsWithPhoto: sale.reviewsWithPhoto || 0
            };
        });

        return NextResponse.json({ success: true, data: reviewData });

    } catch (error: any) {
        console.error("API GET /api/incentives/reviews Error:", error);
        return NextResponse.json({ message: 'An internal server error occurred', error: error.message }, { status: 500 });
    }
}