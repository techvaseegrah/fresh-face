// src/app/api/incentives/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Invoice from '@/models/invoice'; // Import Invoice model
import IncentiveRule, { IIncentiveRule } from '@/models/IncentiveRule';
import { getTenantIdOrBail } from '@/lib/tenant';

// Define a type for the rule snapshot object
type IRuleSnapshot = {
  target: { multiplier: number };
  sales: { includeServiceSale: boolean; includeProductSale: boolean; reviewNameValue: number; reviewPhotoValue: number; };
  incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly'; };
};

export async function POST(request: Request) {
  try {
    await dbConnect();
    const tenantId = getTenantIdOrBail(request as any);
    if (tenantId instanceof NextResponse) return tenantId;

    const body = await request.json();
    // This route is called for ONE staff member at a time when you click "Save & Lock Day"
    const { staffId, date, reviewsWithName = 0, reviewsWithPhoto = 0 } = body;

    if (!staffId || !date) {
      return NextResponse.json({ message: 'Staff ID and date are required.' }, { status: 400 });
    }
    
    const [year, month, day] = date.split('-').map(Number);
    const dayStart = new Date(Date.UTC(year, month - 1, day));
    const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    // --- Step 1: Find the historically correct incentive rule ---
    const activeRuleDb = await IncentiveRule.findOne({
      tenantId,
      type: 'daily',
      createdAt: { $lte: dayEnd } // Find the last rule created on or before this date
    }).sort({ createdAt: -1 }).lean<IIncentiveRule>();

    const defaultRule: IRuleSnapshot = { target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'totalSaleValue' } };
    
    const ruleSnapshot: IRuleSnapshot = {
        target: { ...defaultRule.target, ...(activeRuleDb?.target || {}) },
        sales: { ...defaultRule.sales, ...(activeRuleDb?.sales || {}) },
        incentive: { ...defaultRule.incentive, ...(activeRuleDb?.incentive || {}) }
    };

    // --- Step 2: Sync sales data for this specific staff member on this day ---
    const allInvoicesForDay = await Invoice.find({
      tenantId: tenantId,
      createdAt: { $gte: dayStart, $lte: dayEnd }
    }).lean();

    const totals = { serviceSale: 0, productSale: 0 };
    const customerIds = new Set<string>();

    for (const invoice of allInvoicesForDay) {
        let staffWasInvolvedInThisInvoice = false;
        for (const item of (invoice.lineItems || [])) {
            if (item.staffId?.toString() === staffId) {
                if (item.itemType === 'service') {
                    totals.serviceSale += item.finalPrice;
                } else if (item.itemType === 'product') {
                    totals.productSale += item.finalPrice;
                }
                staffWasInvolvedInThisInvoice = true;
            }
        }
        if (staffWasInvolvedInThisInvoice) {
            customerIds.add(invoice.customerId.toString());
        }
    }

    // --- Step 3: Create or Update the DailySale record with the correct logic ---
    const updatedRecord = await DailySale.findOneAndUpdate(
      { staff: staffId, date: dayStart, tenantId },
      { 
        // $set: Overwrites these fields with the latest, freshly calculated data.
        $set: {
          serviceSale: totals.serviceSale,
          productSale: totals.productSale,
          customerCount: customerIds.size,
          appliedRule: ruleSnapshot, // Locks in the rule
          tenantId: tenantId,
        },
        // $inc: Increments the review counts, adding new values to existing ones.
        $inc: { 
          reviewsWithName: Number(reviewsWithName) || 0,
          reviewsWithPhoto: Number(reviewsWithPhoto) || 0,
        },
      },
      { 
        new: true, // Return the modified document
        upsert: true, // Create the document if it doesn't exist
        setDefaultsOnInsert: true
      }
    );

    return NextResponse.json({ message: 'Daily sales and reviews saved successfully. Rule has been locked in.', data: updatedRecord }, { status: 200 });

  } catch (error: any) {
    console.error("API POST /api/incentives Error:", error);
    return NextResponse.json({ message: 'An internal server error occurred', error: error.message }, { status: 500 });
  }
}