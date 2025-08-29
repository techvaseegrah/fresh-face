import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Invoice from '@/models/invoice'; 
import DailySale from '@/models/DailySale';
import IncentiveRule, { IIncentiveRule } from '@/models/IncentiveRule';
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';

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
    const { date, staffIds } = body;

    if (!date || !staffIds || !Array.isArray(staffIds) || staffIds.length === 0) {
      return NextResponse.json({ message: 'Date and staff IDs are required for sync.' }, { status: 400 });
    }

    const [year, month, day] = date.split('-').map(Number);
    const dayStart = new Date(Date.UTC(year, month - 1, day));
    const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    const activeRuleDb = await IncentiveRule.findOne({
        type: 'daily', tenantId, createdAt: { $lte: dayEnd }
    }).sort({ createdAt: -1 }).lean<IIncentiveRule>();

    const defaultDaily = { target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'totalSaleValue' } };
    const ruleSnapshot = {
        target: { ...defaultDaily.target, ...(activeRuleDb?.target || {}) },
        sales: { ...defaultDaily.sales, ...(activeRuleDb?.sales || {}) },
        incentive: { ...defaultDaily.incentive, ...(activeRuleDb?.incentive || {}) }
    };

    const allInvoicesForDay = await Invoice.find({
      tenantId: tenantId,
      createdAt: { $gte: dayStart, $lte: dayEnd }
    }).lean();

    for (const staffId of staffIds) {
        let serviceSale = 0;
        let productSale = 0;
        const customerIds = new Set<string>();

        for (const invoice of allInvoicesForDay) {
            let staffWorkedOnInvoice = false;
            for (const item of (invoice.lineItems || [] as LineItemType[])) {
                if (item.staffId?.toString() === staffId) {
                    if (item.itemType === 'service') serviceSale += item.finalPrice;
                    if (item.itemType === 'product') productSale += item.finalPrice;
                    staffWorkedOnInvoice = true;
                }
            }
            if (staffWorkedOnInvoice) {
                customerIds.add(invoice.customerId.toString());
            }
        }
        
        await DailySale.findOneAndUpdate(
          { staff: staffId, date: dayStart, tenantId },
          {
            $set: {
              serviceSale, productSale, customerCount: customerIds.size,
              appliedRule: ruleSnapshot, tenantId: tenantId,
            },
            $setOnInsert: { reviewsWithName: 0, reviewsWithPhoto: 0 }
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
    }

    return NextResponse.json({
      message: `Incentive data automatically updated for ${staffIds.length} staff member(s).`,
    }, { status: 200 });
  } catch (error: any) {
    console.error("API POST /api/incentives/sync-from-billing Error:", error);
    return NextResponse.json({ message: 'An internal server error occurred', error: error.message }, { status: 500 });
  }
}