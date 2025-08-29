import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import Invoice from '@/models/invoice'; // <-- Import Invoice model
import IncentiveRule, { IIncentiveRule } from '@/models/IncentiveRule'; // <-- Import Rule model
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

// --- Re-usable Helper Functions ---
function getDaysInMonth(year: number, month: number): number { return new Date(year, month + 1, 0).getDate(); }

function calculateIncentive(achievedValue: number, targetValue: number, rule: any, baseForIncentive: number) {
  let incentive = 0;
  let appliedRate = 0;
  const isTargetMet = achievedValue >= targetValue;

  if (isTargetMet) {
    const doubleTargetValue = targetValue * 2;
    if (achievedValue >= doubleTargetValue) {
      appliedRate = rule.incentive.doubleRate;
      incentive = baseForIncentive * rule.incentive.doubleRate;
    } else {
      appliedRate = rule.incentive.rate;
      incentive = baseForIncentive * rule.incentive.rate;
    }
  }
  return { incentive, isTargetMet, appliedRate };
}

export async function GET(request: Request) {
    try {
        await dbConnect();
        const tenantId = getTenantIdOrBail(request as any);
        if (tenantId instanceof NextResponse) return tenantId;

        const { searchParams } = new URL(request.url);
        const startDateStr = searchParams.get('startDate');
        const endDateStr = searchParams.get('endDate');

        if (!startDateStr || !endDateStr) {
            return NextResponse.json({ message: 'Start and End Date are required.' }, { status: 400 });
        }
        
        const start = new Date(startDateStr);
        const end = new Date(endDateStr);

        // =================================================================================
        // === 🚀 CORE FIX: AUTOMATIC JUST-IN-TIME SYNC FROM BILLING ========================
        // =================================================================================
        // 1. Find all paid invoices within the date range
        const invoices = await Invoice.find({ tenantId, createdAt: { $gte: start, $lte: end } }).lean();
        const salesToSync = new Map<string, { serviceSale: number, productSale: number }>();

        // 2. Aggregate sales data by staff and day
        for (const invoice of invoices) {
            for (const item of (invoice.lineItems || [])) {
                if (!item.staffId) continue;
                const dateStr = (invoice.createdAt as Date).toISOString().split('T')[0];
                const key = `${item.staffId.toString()}-${dateStr}`;

                const totals = salesToSync.get(key) || { serviceSale: 0, productSale: 0 };
                if (item.itemType === 'service') totals.serviceSale += item.finalPrice;
                else if (item.itemType === 'product') totals.productSale += item.finalPrice;
                salesToSync.set(key, totals);
            }
        }
        
        // 3. Update or create DailySale records with the latest sales data
        const syncPromises = [];
        for (const [key, totals] of salesToSync.entries()) {
            const [staffId, dateStr] = key.split('-');
            const syncDate = new Date(dateStr);

            // Find the correct rule that was active on that day
            const activeRuleDb = await IncentiveRule.findOne({ tenantId, type: 'daily', createdAt: { $lte: new Date(syncDate.getTime() + 86400000) } }).sort({ createdAt: -1 }).lean<IIncentiveRule>();
            const defaultRule = { target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'totalSaleValue' } };
            const ruleSnapshot = {
                target: { ...defaultRule.target, ...(activeRuleDb?.target || {}) },
                sales: { ...defaultRule.sales, ...(activeRuleDb?.sales || {}) },
                incentive: { ...defaultRule.incentive, ...(activeRuleDb?.incentive || {}) }
            };

            const promise = DailySale.findOneAndUpdate(
                { staff: new mongoose.Types.ObjectId(staffId), date: syncDate, tenantId },
                { 
                    $set: {
                        serviceSale: totals.serviceSale,
                        productSale: totals.productSale,
                        appliedRule: ruleSnapshot, // Snapshot the rule during sync
                    },
                    $setOnInsert: { reviewsWithName: 0, reviewsWithPhoto: 0 } // Only set reviews if creating new
                },
                { upsert: true, new: true }
            );
            syncPromises.push(promise);
        }
        await Promise.all(syncPromises);
        // =================================================================================
        // === ✅ SYNC COMPLETE: Now proceed with calculation using the updated data =======
        // =================================================================================

        // 4. Fetch all staff and the now-synced DailySale records
        const staffList = await Staff.find({ tenantId }).select('name salary').lean();
        const staffMap = new Map(staffList.map(s => [s._id.toString(), s]));
        const staffResult = staffList.map(s => ({ id: s._id.toString(), name: s.name, hasSalary: !!s.salary && s.salary > 0 }));
        
        const salesData = await DailySale.find({ tenantId, date: { $gte: start, $lte: end } }).lean();
        const salesByStaffAndDate: { [staffId: string]: { [date: string]: any } } = {};

        // 5. Calculate daily incentive for the UI
        for (const sale of salesData) {
            const staffId = sale.staff.toString();
            const staffMember = staffMap.get(staffId);
            const dateObj = new Date(sale.date);
            const dateStr = dateObj.toISOString().split('T')[0];

            if (!salesByStaffAndDate[staffId]) salesByStaffAndDate[staffId] = {};
            
            let calculationResult = {};
            if (staffMember && staffMember.salary && sale.appliedRule) {
                const rule = sale.appliedRule;
                const daysInMonth = getDaysInMonth(dateObj.getUTCFullYear(), dateObj.getUTCMonth());
                const dailyTarget = (staffMember.salary * rule.target.multiplier) / daysInMonth;
                const achievedValue = (rule.sales.includeServiceSale ? (sale.serviceSale || 0) : 0) + (rule.sales.includeProductSale ? (sale.productSale || 0) : 0) + ((sale.reviewsWithName || 0) * (rule.sales.reviewNameValue || 0)) + ((sale.reviewsWithPhoto || 0) * (rule.sales.reviewPhotoValue || 0));
                const baseForIncentive = rule.incentive.applyOn === 'serviceSaleOnly' ? (sale.serviceSale || 0) : achievedValue;
                const { incentive, isTargetMet, appliedRate } = calculateIncentive(achievedValue, dailyTarget, rule, baseForIncentive);
                calculationResult = { dailyTarget, totalAchievedValue: achievedValue, incentiveAmount: incentive, isTargetMet, appliedRate };
            }

            salesByStaffAndDate[staffId][dateStr] = {
                serviceSale: sale.serviceSale || 0, productSale: sale.productSale || 0,
                reviewsWithName: sale.reviewsWithName || 0, reviewsWithPhoto: sale.reviewsWithPhoto || 0,
                appliedRule: sale.appliedRule, ...calculationResult
            };
        }

        return NextResponse.json({ staff: staffResult, sales: salesByStaffAndDate });

    } catch (error: any) {
        console.error("API GET /weekly-summary Error:", error);
        return NextResponse.json({ message: 'An internal server error occurred.', error: error.message }, { status: 500 });
    }
}