// Replace the entire content of: src/app/api/incentives/sync-from-billing/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
// =======================================================================
// THE FIX: Removed the import for { ILineItem } which does not exist
// =======================================================================
import Invoice from '@/models/invoice'; 
import DailySale from '@/models/DailySale';
import IncentiveRule, { IIncentiveRule } from '@/models/IncentiveRule';
import Staff from '@/models/staff';
import { getTenantIdOrBail } from '@/lib/tenant';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import mongoose from 'mongoose';

// We will use this local type definition because ILineItem is not exported from the model file.
// This gives a type to the 'li' parameter later. This part is correct.
type LineItemType = {
  staffId?: mongoose.Types.ObjectId | string;
  itemType: 'service' | 'product' | 'fee';
  finalPrice: number;
  // Add other properties if needed for type safety
};


async function checkPermissions(permission: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role?.permissions || !hasPermission(session.user.role.permissions, permission)) {
    return { error: 'You do not have permission to perform this action.', status: 403 };
  }
  return null;
}


export async function POST(request: Request) {
  const permissionCheck = await checkPermissions(PERMISSIONS.STAFF_INCENTIVES_MANAGE);
  if (permissionCheck) {
    return NextResponse.json({ success: false, message: permissionCheck.error }, { status: permissionCheck.status });
  }

  try {
    await dbConnect();
    const tenantId = getTenantIdOrBail(request as any);
    if (tenantId instanceof NextResponse) return tenantId;

    const body = await request.json();
    const { date } = body;

    if (!date) {
      return NextResponse.json({ message: 'A date is required.' }, { status: 400 });
    }

    const [year, month, day] = date.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, day));
    const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    const invoicesForDay = await Invoice.find({
      tenantId: tenantId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).lean();

    if (invoicesForDay.length === 0) {
      return NextResponse.json({ message: 'No billing data found for the selected date. Nothing to sync.' }, { status: 200 });
    }

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

    const activeRuleDb = await IncentiveRule.findOne({
        type: 'daily', tenantId, createdAt: { $lte: endDate }
    }).sort({ createdAt: -1 }).lean<IIncentiveRule>();

    const defaultDaily = { target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'totalSaleValue' } };
    const ruleSnapshot = {
        target: { ...defaultDaily.target, ...(activeRuleDb?.target || {}) },
        sales: { ...defaultDaily.sales, ...(activeRuleDb?.sales || {}) },
        incentive: { ...defaultDaily.incentive, ...(activeRuleDb?.incentive || {}) }
    };
    
    let processedRecords = 0;
    for (const [staffId, totals] of salesByStaff.entries()) {
        const customerCount = new Set(invoicesForDay
            .filter(inv => (inv.lineItems || []).some((li: LineItemType) => li.staffId?.toString() === staffId))
            .map(inv => inv.customerId.toString())
        ).size;

        await DailySale.findOneAndUpdate(
          { staff: staffId, date: startDate, tenantId },
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
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        processedRecords++;
    }

    return NextResponse.json({
      message: `Sales data synchronized successfully for ${processedRecords} staff member(s).`,
    }, { status: 200 });

  } catch (error: any) {
    console.error("API POST /api/incentives/sync-from-billing Error:", error);
    return NextResponse.json({ message: 'An internal server error occurred', error: error.message }, { status: 500 });
  }
}