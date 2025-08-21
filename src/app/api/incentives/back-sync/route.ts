// Replace the entire content of: src/app/api/incentives/back-sync/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Invoice from '@/models/invoice';
import DailySale from '@/models/DailySale';
import IncentiveRule, { IIncentiveRule } from '@/models/IncentiveRule';
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';

type IRuleSnapshot = {
  target: { multiplier: number };
  sales: { includeServiceSale: boolean; includeProductSale: boolean; reviewNameValue: number; reviewPhotoValue: number; };
  incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly'; };
};

// This gives a type to the 'li' parameter later.
type LineItemType = {
  staffId?: mongoose.Types.ObjectId | string;
  itemType: 'service' | 'product' | 'fee';
  finalPrice: number;
};

export async function POST(request: Request) {
  try {
    await dbConnect();
    const tenantId = getTenantIdOrBail(request as any);
    if (tenantId instanceof NextResponse) return tenantId;

    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ message: 'Start Date and End Date are required.' }, { status: 400 });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    let processedRecords = 0;
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        const dayEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
        
        const invoicesForDay = await Invoice.find({
            tenantId,
            createdAt: { $gte: dayStart, $lte: dayEnd }
        }).lean();

        if (invoicesForDay.length === 0) continue;
        
        const activeRuleDb = await IncentiveRule.findOne({
            tenantId, type: 'daily', createdAt: { $lte: dayEnd }
        }).sort({ createdAt: -1 }).lean<IIncentiveRule>();

        // =================================================================================
        // === THE FIX: Replaced the placeholder comments with the actual object creation ===
        // =================================================================================
        const defaultRule: IRuleSnapshot = { target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'totalSaleValue' } };
        
        const ruleSnapshot: IRuleSnapshot = {
            target: { ...defaultRule.target, ...(activeRuleDb?.target || {}) },
            sales: { ...defaultRule.sales, ...(activeRuleDb?.sales || {}) },
            incentive: { ...defaultRule.incentive, ...(activeRuleDb?.incentive || {}) }
        };

        const salesByStaff = new Map<string, { serviceSale: number, productSale: number }>();
        for (const invoice of invoicesForDay) {
          for (const item of (invoice.lineItems || [])) {
            if (!item.staffId) continue;
            const staffId = item.staffId.toString();

            if (!salesByStaff.has(staffId)) {
              salesByStaff.set(staffId, { serviceSale: 0, productSale: 0 });
            }
            const staffTotals = salesByStaff.get(staffId)!;

            if (item.itemType === 'service') {
              staffTotals.serviceSale += item.finalPrice;
            } else if (item.itemType === 'product') {
              staffTotals.productSale += item.finalPrice;
            }
          }
        }

        for (const [staffId, totals] of salesByStaff.entries()) {
            // ====================================================================
            // === THE FIX: Added an explicit type for the 'li' parameter       ===
            // ====================================================================
            const customerCount = new Set(invoicesForDay
                .filter(inv => (inv.lineItems || []).some((li: LineItemType) => li.staffId?.toString() === staffId))
                .map(inv => inv.customerId.toString())
            ).size;


            await DailySale.findOneAndUpdate(
              { staff: staffId, date: dayStart, tenantId },
              {
                $set: {
                  serviceSale: totals.serviceSale,
                  productSale: totals.productSale,
                  customerCount: customerCount,
                  appliedRule: ruleSnapshot,
                  tenantId: tenantId,
                },
                $setOnInsert: { reviewsWithName: 0, reviewsWithPhoto: 0 }
              },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            processedRecords++;
        }
    }

    return NextResponse.json({
      message: `Historical sync complete. Processed and verified ${processedRecords} staff-day records.`,
    }, { status: 200 });

  } catch (error: any) {
    console.error("API POST /api/incentives/back-sync Error:", error);
    return NextResponse.json({ message: 'An internal server error occurred', error: error.message }, { status: 500 });
  }
}