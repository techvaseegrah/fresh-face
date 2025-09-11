// src/app/api/incentives/back-sync/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Invoice from '@/models/invoice';
import DailySale from '@/models/DailySale';
import IncentiveRule, { IIncentiveRule } from '@/models/IncentiveRule';
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';

// ✨ --- FIX: Updated the snapshot type to include all fields ---
type IRuleSnapshot = {
  target: { multiplier: number };
  sales: {
    includeServiceSale: boolean;
    includeProductSale: boolean;
    includePackageSale: boolean;
    includeGiftCardSale: boolean;
    reviewNameValue: number;
    reviewPhotoValue: number;
  };
  incentive: {
    rate: number;
    doubleRate: number;
    applyOn: 'totalSaleValue' | 'serviceSaleOnly';
    packageRate: number;
    giftCardRate: number;
  };
};

type LineItemType = {
  staffId?: mongoose.Types.ObjectId | string;
  itemType: 'service' | 'product' | 'fee' | 'package' | 'gift_card';
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

        // ✨ --- FIX: The default rule and snapshot now include the new fields ---
        const defaultRule: IRuleSnapshot = {
            target: { multiplier: 5 },
            sales: {
                includeServiceSale: true,
                includeProductSale: true,
                includePackageSale: false,
                includeGiftCardSale: false,
                reviewNameValue: 200,
                reviewPhotoValue: 300
            },
            incentive: {
                rate: 0.05,
                doubleRate: 0.10,
                applyOn: 'totalSaleValue',
                packageRate: 0.02,
                giftCardRate: 0.01
            }
        };
        
        const ruleSnapshot: IRuleSnapshot = {
            target: { ...defaultRule.target, ...(activeRuleDb?.target || {}) },
            sales: { ...defaultRule.sales, ...(activeRuleDb?.sales || {}) },
            incentive: { ...defaultRule.incentive, ...(activeRuleDb?.incentive || {}) }
        };

        // ✨ --- FIX: The map now holds all sale types ---
        const salesByStaff = new Map<string, { serviceSale: number, productSale: number, packageSale: number, giftCardSale: number }>();

        for (const invoice of invoicesForDay) {
          for (const item of (invoice.lineItems || [])) {
            if (!item.staffId) continue;
            const staffId = item.staffId.toString();

            // ✨ --- FIX: Initialize the staff totals with all sale types ---
            if (!salesByStaff.has(staffId)) {
              salesByStaff.set(staffId, { serviceSale: 0, productSale: 0, packageSale: 0, giftCardSale: 0 });
            }
            const staffTotals = salesByStaff.get(staffId)!;
            
            // ✨ --- FIX: The logic now checks for and adds package and gift card sales ---
            if (item.itemType === 'service') {
              staffTotals.serviceSale += item.finalPrice;
            } else if (item.itemType === 'product') {
              staffTotals.productSale += item.finalPrice;
            } else if (item.itemType === 'package') {
              staffTotals.packageSale += item.finalPrice;
            } else if (item.itemType === 'gift_card') {
              staffTotals.giftCardSale += item.finalPrice;
            }
          }
        }

        for (const [staffId, totals] of salesByStaff.entries()) {
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
                  // ✨ --- FIX: Save the calculated package and gift card sales to the database ---
                  packageSale: totals.packageSale,
                  giftCardSale: totals.giftCardSale,
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