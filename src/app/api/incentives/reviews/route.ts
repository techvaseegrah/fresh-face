// /app/api/incentives/reviews/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import { getTenantIdOrBail } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

// This GET function should already exist in your file
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


// ✨ --- THIS IS THE FIX --- ✨
// Add this new POST function to the same file to handle saving the review counts.
export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        const tenantId = getTenantIdOrBail(request as any);
        if (tenantId instanceof NextResponse) return tenantId;

        const { staffId, reviews } = await request.json();

        if (!staffId || !reviews || typeof reviews !== 'object') {
            return NextResponse.json({ message: 'Staff ID and reviews object are required.' }, { status: 400 });
        }

        // Prepare bulk operations to update or create records efficiently
        const bulkOps = Object.entries(reviews).map(([dateString, reviewData]: [string, any]) => {
            const date = new Date(dateString);
            
            return {
                updateOne: {
                    filter: {
                        tenantId,
                        staff: staffId,
                        date: date
                    },
                    // Set the new review values
                    update: {
                        $set: {
                            reviewsWithName: Number(reviewData.reviewsWithName) || 0,
                            reviewsWithPhoto: Number(reviewData.reviewsWithPhoto) || 0
                        },
                        // If a record for this day does not exist, create it with default values
                        $setOnInsert: {
                            tenantId,
                            staff: staffId,
                            date: date,
                            serviceSale: 0,
                            productSale: 0,
                            packageSale: 0,
                            giftCardSale: 0,
                            customerCount: 0,
                        }
                    },
                    upsert: true // This is the key: it creates the document if it doesn't exist
                }
            };
        });

        if (bulkOps.length > 0) {
            await DailySale.bulkWrite(bulkOps);
        }

        return NextResponse.json({ success: true, message: 'Review counts updated successfully.' });

    } catch (error: any) {
        console.error("API POST /api/incentives/reviews Error:", error);
        return NextResponse.json({ message: 'An internal server error occurred', error: error.message }, { status: 500 });
    }
}