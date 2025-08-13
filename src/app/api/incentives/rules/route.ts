import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IncentiveRule from '@/models/IncentiveRule';
import { getTenantIdOrBail } from '@/lib/tenant';

// This function ONLY creates new, timestamped rule versions.
export async function POST(request: Request) {
    try {
        await dbConnect();
        const tenantId = getTenantIdOrBail(request as any);
        if (tenantId instanceof NextResponse) return tenantId;

        const body = await request.json();
        const { daily, monthly } = body;

        if (!daily || !monthly) {
            return NextResponse.json({ message: "Daily and monthly rule data are required." }, { status: 400 });
        }

        // ✅ THE FIX: Create clean rule objects, picking only the required fields.
        // This prevents Mongoose errors from extra fields like `_id` sent from the client.
        const newDailyData = {
            tenantId,
            type: 'daily',
            target: {
                multiplier: daily.target.multiplier
            },
            sales: {
                includeServiceSale: daily.sales.includeServiceSale,
                includeProductSale: daily.sales.includeProductSale,
                reviewNameValue: daily.sales.reviewNameValue,
                reviewPhotoValue: daily.sales.reviewPhotoValue
            },
            incentive: {
                rate: daily.incentive.rate,
                doubleRate: daily.incentive.doubleRate,
                applyOn: daily.incentive.applyOn
            }
        };

        const newMonthlyData = {
            tenantId,
            type: 'monthly',
            target: {
                multiplier: monthly.target.multiplier
            },
            sales: {
                includeServiceSale: monthly.sales.includeServiceSale,
                includeProductSale: monthly.sales.includeProductSale,
                reviewNameValue: monthly.sales.reviewNameValue,
                reviewPhotoValue: monthly.sales.reviewPhotoValue
            },
            incentive: {
                rate: monthly.incentive.rate,
                doubleRate: monthly.incentive.doubleRate,
                applyOn: monthly.incentive.applyOn
            }
        };

        // Create new, timestamped versions using the clean data.
        await IncentiveRule.create(newDailyData);
        await IncentiveRule.create(newMonthlyData);

        return NextResponse.json({ message: 'New rule versions created successfully!' }, { status: 200 });

    } catch (error: any) {
        // Log the actual error on the server for debugging
        console.error("API POST /api/incentives/rules Error:", error);
        // Send a generic message to the client
        return NextResponse.json({ message: 'An internal server error occurred while saving the rule.' }, { status: 500 });
    }
}

// This function gets the LATEST rule version to display in the settings modal.
// This part of the code was already correct.
export async function GET(request: Request) {
    try {
        await dbConnect();
        const tenantId = getTenantIdOrBail(request as any);
        if (tenantId instanceof NextResponse) return tenantId;

        // Find the latest rule by getting the one with the newest `createdAt` timestamp.
        const daily = await IncentiveRule.findOne({ tenantId, type: 'daily' }).sort({ createdAt: -1 });
        const monthly = await IncentiveRule.findOne({ tenantId, type: 'monthly' }).sort({ createdAt: -1 });
        
        const defaultRule = { target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'totalSaleValue' }};
        const defaultMonthlyRule = { ...defaultRule, sales: {...defaultRule.sales, includeProductSale: false }, incentive: {...defaultRule.incentive, applyOn: 'serviceSaleOnly' }};

        return NextResponse.json({
            daily: daily || defaultRule,
            monthly: monthly || defaultMonthlyRule,
        });

    } catch (error: any) {
        console.error("API GET /api/incentives/rules Error:", error);
        return NextResponse.json({ message: 'An internal server error occurred while fetching rules.' }, { status: 500 });
    }
}