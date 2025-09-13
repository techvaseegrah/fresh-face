// src/app/api/incentives/rules/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IncentiveRule from '@/models/IncentiveRule';
import { getTenantIdOrBail } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

// This function creates new, timestamped rule versions for ALL FOUR types.
export async function POST(request: Request) {
    try {
        await dbConnect();
        const tenantId = getTenantIdOrBail(request as any);
        if (tenantId instanceof NextResponse) return tenantId;

        const body = await request.json();
        const { daily, monthly, package: packageRule, giftCard: giftCardRule } = body;

        if (!daily || !monthly || !packageRule || !giftCardRule) {
            return NextResponse.json({ message: "Daily, monthly, package, and gift card rule data are required." }, { status: 400 });
        }

        // ✨ --- FIX: Explicitly construct each rule document to ensure it matches the schema --- ✨
        
        const newDailyRule = {
            tenantId,
            type: 'daily' as const,
            target: { multiplier: daily.target.multiplier },
            sales: daily.sales,
            incentive: daily.incentive
        };

        const newMonthlyRule = {
            tenantId,
            type: 'monthly' as const,
            target: { multiplier: monthly.target.multiplier },
            sales: monthly.sales,
            incentive: monthly.incentive
        };

        const newPackageRule = {
            tenantId,
            type: 'package' as const,
            target: { targetValue: packageRule.target.targetValue },
            incentive: packageRule.incentive,
            // Add default empty sales object to satisfy schema
            sales: {} 
        };

        const newGiftCardRule = {
            tenantId,
            type: 'giftCard' as const,
            target: { targetValue: giftCardRule.target.targetValue },
            incentive: giftCardRule.incentive,
            // Add default empty sales object to satisfy schema
            sales: {}
        };

        // Create four separate, timestamped documents
        await IncentiveRule.create([
            newDailyRule,
            newMonthlyRule,
            newPackageRule,
            newGiftCardRule
        ]);

        return NextResponse.json({ message: 'New rule versions created successfully!' }, { status: 200 });

    } catch (error: any) {
        console.error("API POST /api/incentives/rules Error:", error);
        return NextResponse.json({ message: 'An internal server error occurred while saving the rule.' }, { status: 500 });
    }
}

// This function gets the LATEST rule version for EACH of the four types.
export async function GET(request: Request) {
    try {
        await dbConnect();
        const tenantId = getTenantIdOrBail(request as any);
        if (tenantId instanceof NextResponse) return tenantId;

        const daily = await IncentiveRule.findOne({ tenantId, type: 'daily' }).sort({ createdAt: -1 }).lean();
        const monthly = await IncentiveRule.findOne({ tenantId, type: 'monthly' }).sort({ createdAt: -1 }).lean();
        const packageRule = await IncentiveRule.findOne({ tenantId, type: 'package' }).sort({ createdAt: -1 }).lean();
        const giftCardRule = await IncentiveRule.findOne({ tenantId, type: 'giftCard' }).sort({ createdAt: -1 }).lean();
        
        return NextResponse.json({
            daily: daily,
            monthly: monthly,
            package: packageRule,
            giftCard: giftCardRule,
        });

    } catch (error: any) {
        console.error("API GET /api/incentives/rules Error:", error);
        return NextResponse.json({ message: 'An internal server error occurred while fetching rules.' }, { status: 500 });
    }
}