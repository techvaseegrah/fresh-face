import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IncentiveRule from '@/models/IncentiveRule'; // Ensure this path is correct
import { getTenantIdOrBail } from '@/lib/tenant'; // Ensure this path is correct

export const dynamic = 'force-dynamic';

/**
 * Creates new, timestamped rule versions for ALL FOUR types.
 * This is called when the user clicks "Save" in the incentive settings.
 */
export async function POST(request: Request) {
    try {
        await dbConnect();
        const tenantId = getTenantIdOrBail(request as any);
        if (tenantId instanceof NextResponse) return tenantId;

        const body = await request.json();
        const { daily, monthly, package: packageRule, giftCard: giftCardRule } = body;

        if (!daily || !monthly || !packageRule || !giftCardRule) {
            return NextResponse.json({ message: "Data for all four rule types (daily, monthly, package, giftCard) is required." }, { status: 400 });
        }

        // ✨ --- UPDATE: Construct each rule document to perfectly match the new, unified schema --- ✨

        const newDailyRule = {
            tenantId,
            type: 'daily' as const,
            target: { multiplier: daily.target.multiplier },
            sales: { // This rule uses the full sales configuration
                includeServiceSale: daily.sales.includeServiceSale,
                includeProductSale: daily.sales.includeProductSale,
                includePackageSale: daily.sales.includePackageSale,
                includeGiftCardSale: daily.sales.includeGiftCardSale,
                reviewNameValue: daily.sales.reviewNameValue,
                reviewPhotoValue: daily.sales.reviewPhotoValue,
            },
            incentive: daily.incentive
        };

        const newMonthlyRule = {
            tenantId,
            type: 'monthly' as const,
            target: { multiplier: monthly.target.multiplier },
            sales: monthly.sales, // Monthly rule also uses sales config
            incentive: monthly.incentive
        };

        const newPackageRule = {
            tenantId,
            type: 'package' as const,
            target: { targetValue: packageRule.target.targetValue },
            incentive: packageRule.incentive,
            // Per schema, 'sales' is required, so we add a default/empty object.
            sales: {} 
        };

        const newGiftCardRule = {
            tenantId,
            type: 'giftCard' as const,
            target: { targetValue: giftCardRule.target.targetValue },
            incentive: giftCardRule.incentive,
            // Per schema, 'sales' is required, so we add a default/empty object.
            sales: {}
        };

        // Create four separate, timestamped documents in one database operation
        await IncentiveRule.create([
            newDailyRule,
            newMonthlyRule,
            newPackageRule,
            newGiftCardRule
        ]);

        return NextResponse.json({ message: 'New rule versions created successfully!' }, { status: 201 });

    } catch (error: any) {
        console.error("API POST /api/incentives/rules Error:", error);
        // Provide a more specific error message if it's a validation error
        if (error.name === 'ValidationError') {
            return NextResponse.json({ message: 'Validation Error', details: error.errors }, { status: 400 });
        }
        return NextResponse.json({ message: 'An internal server error occurred while saving the rules.' }, { status: 500 });
    }
}

/**
 * Gets the LATEST rule version for EACH of the four types.
 * This is used to populate the settings page when the user opens it.
 */
export async function GET(request: Request) {
    try {
        await dbConnect();
        const tenantId = getTenantIdOrBail(request as any);
        if (tenantId instanceof NextResponse) return tenantId;

        // Fetch the most recent version of each rule type for this tenant
        const daily = await IncentiveRule.findOne({ tenantId, type: 'daily' }).sort({ createdAt: -1 }).lean();
        const monthly = await IncentiveRule.findOne({ tenantId, type: 'monthly' }).sort({ createdAt: -1 }).lean();
        const packageRule = await IncentiveRule.findOne({ tenantId, type: 'package' }).sort({ createdAt: -1 }).lean();
        const giftCardRule = await IncentiveRule.findOne({ tenantId, type: 'giftCard' }).sort({ createdAt: -1 }).lean();
        
        return NextResponse.json({
            daily,
            monthly,
            package: packageRule,
            giftCard: giftCardRule,
        });

    } catch (error: any) {
        console.error("API GET /api/incentives/rules Error:", error);
        return NextResponse.json({ message: 'An internal server error occurred while fetching rules.' }, { status: 500 });
    }
}