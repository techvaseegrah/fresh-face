// src/app/api/incentives/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Invoice from '@/models/invoice';
import IncentiveRule from '@/models/IncentiveRule'; // Removed IIncentiveRule as it's not directly used
import { getTenantIdOrBail } from '@/lib/tenant';

// This type definition is no longer needed as we build the snapshot differently
// type IRuleSnapshot = { ... };

export async function POST(request: Request) {
  try {
    await dbConnect();
    const tenantId = getTenantIdOrBail(request as any);
    if (tenantId instanceof NextResponse) return tenantId;

    const body = await request.json();
    const { staffId, date, reviewsWithName = 0, reviewsWithPhoto = 0 } = body;

    if (!staffId || !date) {
      return NextResponse.json({ message: 'Staff ID and date are required.' }, { status: 400 });
    }
    
    const [year, month, day] = date.split('-').map(Number);
    const dayStart = new Date(Date.UTC(year, month - 1, day));
    const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    // ✨ --- MODIFICATION: This section now fetches all four rules to create a complete snapshot --- ✨
    const dailyRule = await IncentiveRule.findOne({ tenantId, type: 'daily', createdAt: { $lte: dayEnd } }).sort({ createdAt: -1 }).lean();
    const monthlyRule = await IncentiveRule.findOne({ tenantId, type: 'monthly', createdAt: { $lte: dayEnd } }).sort({ createdAt: -1 }).lean();
    const packageRule = await IncentiveRule.findOne({ tenantId, type: 'package', createdAt: { $lte: dayEnd } }).sort({ createdAt: -1 }).lean();
    const giftCardRule = await IncentiveRule.findOne({ tenantId, type: 'giftCard', createdAt: { $lte: dayEnd } }).sort({ createdAt: -1 }).lean();

    const ruleSnapshot = {
        daily: dailyRule,
        monthly: monthlyRule,
        package: packageRule,
        giftCard: giftCardRule,
    };
    
    // --- Step 2: Sync sales data for this specific staff member on this day ---
    // (This part of your code was already correct and is unchanged)
    const allInvoicesForDay = await Invoice.find({
      tenantId: tenantId,
      createdAt: { $gte: dayStart, $lte: dayEnd }
    }).lean();

    const totals = { serviceSale: 0, productSale: 0, packageSale: 0, giftCardSale: 0 };
    const customerIds = new Set<string>();

    for (const invoice of allInvoicesForDay) {
        let staffWasInvolvedInThisInvoice = false;
        for (const item of (invoice.lineItems || [])) {
            if (item.staffId?.toString() === staffId) {
                if (item.itemType === 'service') {
                    totals.serviceSale += item.finalPrice;
                } else if (item.itemType === 'product') {
                    totals.productSale += item.finalPrice;
                } else if (item.itemType === 'package') {
                    totals.packageSale += item.finalPrice;
                } else if (item.itemType === 'gift_card') {
                    totals.giftCardSale += item.finalPrice;
                }
                staffWasInvolvedInThisInvoice = true;
            }
        }
        if (staffWasInvolvedInThisInvoice) {
            customerIds.add(invoice.customerId.toString());
        }
    }

    // --- Step 3: Create or Update the DailySale record ---
    const updatedRecord = await DailySale.findOneAndUpdate(
      { staff: staffId, date: dayStart, tenantId },
      { 
        $set: {
          serviceSale: totals.serviceSale,
          productSale: totals.productSale,
          packageSale: totals.packageSale,
          giftCardSale: totals.giftCardSale,
          customerCount: customerIds.size,
          // ✨ --- MODIFICATION: Save the new, correct, and complete snapshot --- ✨
          appliedRule: ruleSnapshot,
          tenantId: tenantId,
        },
        $inc: { 
          reviewsWithName: Number(reviewsWithName) || 0,
          reviewsWithPhoto: Number(reviewsWithPhoto) || 0,
        },
      },
      { 
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    return NextResponse.json({ message: 'Daily sales and reviews saved successfully. Rule has been locked in.', data: updatedRecord }, { status: 200 });

  } catch (error: any) {
    console.error("API POST /api/incentives Error:", error);
    return NextResponse.json({ message: 'An internal server error occurred', error: error.message }, { status: 500 });
  }
}