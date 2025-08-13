import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Invoice from '@/models/invoice'; // Import Invoice model
import IncentiveRule, { IIncentiveRule } from '@/models/IncentiveRule';
import { getTenantIdOrBail } from '@/lib/tenant';

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

    // This logic to find the historical rule is correct.
    const activeRuleDb = await IncentiveRule.findOne({
      tenantId,
      type: 'daily',
      createdAt: { $lte: dayEnd }
    }).sort({ createdAt: -1 }).lean<IIncentiveRule>();

    const defaultRule: IRuleSnapshot = { target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'totalSaleValue' } };
    
    const ruleSnapshot: IRuleSnapshot = {
        target: { ...defaultRule.target, ...(activeRuleDb?.target || {}) },
        sales: { ...defaultRule.sales, ...(activeRuleDb?.sales || {}) },
        incentive: { ...defaultRule.incentive, ...(activeRuleDb?.incentive || {}) }
    };

    // 1. Fetch ALL invoices for the day for the entire tenant.
    const allInvoicesForDay = await Invoice.find({
      tenantId: tenantId,
      createdAt: { $gte: dayStart, $lte: dayEnd }
    }).lean();

    // 2. Initialize totals and customer tracking for the SPECIFIC staff member being saved.
    const totals = { serviceSale: 0, productSale: 0 };
    const customerIds = new Set<string>();

    // 3. Loop through every invoice and every line item.
    for (const invoice of allInvoicesForDay) {
        let staffWasInvolvedInThisInvoice = false;
        for (const item of (invoice.lineItems || [])) {
            // 4. Check if THIS line item belongs to the staff member we are currently saving for.
            if (item.staffId?.toString() === staffId) {
                if (item.itemType === 'service') {
                    totals.serviceSale += item.finalPrice;
                } else if (item.itemType === 'product') {
                    totals.productSale += item.finalPrice;
                }
                // Mark that this staff member worked on this invoice
                staffWasInvolvedInThisInvoice = true;
            }
        }
        // 5. If they worked on the invoice, add the customer to their unique customer count for the day.
        if (staffWasInvolvedInThisInvoice) {
            customerIds.add(invoice.customerId.toString());
        }
    }

    // --- Create or Update the DailySale record with the CORRECT, isolated totals ---
    const updatedRecord = await DailySale.findOneAndUpdate(
      { staff: staffId, date: dayStart, tenantId },
      { 
        // $set ensures we are overwriting any previous incorrect data for the day with a fresh, accurate calculation.
        $set: {
          serviceSale: totals.serviceSale,
          productSale: totals.productSale,
          customerCount: customerIds.size,
          appliedRule: ruleSnapshot,
          tenantId: tenantId,
        },
        // $inc correctly adds the new review counts to any existing ones.
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