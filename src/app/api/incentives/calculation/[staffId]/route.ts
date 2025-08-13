import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import IncentiveRule, { IIncentiveRule } from '@/models/IncentiveRule'; // Assuming monthly still uses a live rule
import { getTenantIdOrBail } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

type IRule = {
  target: { multiplier: number };
  sales: { includeServiceSale: boolean; includeProductSale: boolean; reviewNameValue: number; reviewPhotoValue: number; };
  incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly'; };
};

function getDaysInMonth(year: number, month: number): number { return new Date(year, month + 1, 0).getDate(); }
function calculateIncentiveWithDoubleTarget(achievedValue: number, targetValue: number, rule: IRule, baseForIncentive: number) {
  let incentive = 0; let appliedRate = 0;
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

export async function GET(request: Request, { params }: { params: { staffId: string } }) {
  try {
    await dbConnect();
    const tenantId = getTenantIdOrBail(request as any);
    if (tenantId instanceof NextResponse) return tenantId;

    const { staffId } = params;
    const { searchParams } = new URL(request.url);
    const dateQuery = searchParams.get('date');

    if (!dateQuery) {
        return NextResponse.json({ message: 'Date query parameter is required.' }, { status: 400 });
    }

    const staff = await Staff.findOne({ _id: staffId, tenantId }).lean();
    if (!staff || !staff.salary || staff.salary <= 0) {
        return NextResponse.json({ message: 'Staff member not found or salary is not set.' }, { status: 404 });
    }
    
    const [year, month, day] = dateQuery.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    
    // --- Step 1: Find the saved DailySale record. This is now the ONLY source of truth. ---
    const dailySaleRecord = await DailySale.findOne({ staff: staffId, date: targetDate, tenantId }).lean();

    // ✅ THE FINAL FIX: If there's no saved record or no rule snapshot, DO NOT CALCULATE.
    if (!dailySaleRecord || !dailySaleRecord.appliedRule) {
        return NextResponse.json({
            message: "No saved incentive data found for this day. Please use the 'Save Reviews' form to sync and lock in the data first."
        }, { status: 404 }); // Use 404 Not Found status
    }

    // --- Step 2: Use the locked-in snapshot for calculation. ---
    const dailyRuleToUse: IRule = dailySaleRecord.appliedRule;
    const ruleUsedSource = "Historical Snapshot";

    // Get sales data directly from the saved record
    const aggregatedSales = {
        serviceSale: dailySaleRecord.serviceSale || 0,
        productSale: dailySaleRecord.productSale || 0,
    };
    const reviewsWithName = dailySaleRecord.reviewsWithName || 0;
    const reviewsWithPhoto = dailySaleRecord.reviewsWithPhoto || 0;
    
    const daysInMonth = getDaysInMonth(targetDate.getUTCFullYear(), targetDate.getUTCMonth());
    const dailyTarget = (staff.salary * dailyRuleToUse.target.multiplier) / daysInMonth;
    const dailyAchievedValue = (dailyRuleToUse.sales.includeServiceSale ? aggregatedSales.serviceSale : 0) + (dailyRuleToUse.sales.includeProductSale ? aggregatedSales.productSale : 0) + (reviewsWithName * dailyRuleToUse.sales.reviewNameValue) + (reviewsWithPhoto * dailyRuleToUse.sales.reviewPhotoValue);
    const dailyBaseForIncentive = dailyRuleToUse.incentive.applyOn === 'serviceSaleOnly' ? aggregatedSales.serviceSale : dailyAchievedValue;
    const { incentive, isTargetMet, appliedRate } = calculateIncentiveWithDoubleTarget(dailyAchievedValue, dailyTarget, dailyRuleToUse, dailyBaseForIncentive);
    const dailyCalculationResult = { targetValue: dailyTarget, totalSaleValue: dailyAchievedValue, incentiveAmount: incentive, isTargetMet, appliedRate, ruleUsed: ruleUsedSource };

    // ... (Monthly calculation can remain as is, since it's a different calculation)
    const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    const monthlyRuleDb = await IncentiveRule.findOne({ tenantId, type: 'monthly', createdAt: { $lte: dayEnd } }).sort({ createdAt: -1 }).lean<IIncentiveRule>();
    const monthStart = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1));
    const monthlySalesData = await DailySale.find({ staff: staffId, date: { $gte: monthStart, $lte: dayEnd }, tenantId }).lean();
    const totalMonthlyAchieved = monthlySalesData.reduce((acc, sale) => ({ serviceSale: acc.serviceSale + (sale.serviceSale || 0), productSale: acc.productSale + (sale.productSale || 0) }), { serviceSale: 0, productSale: 0});
    // ... rest of monthly logic ...
    const monthlyTarget = staff.salary * (monthlyRuleDb?.target.multiplier || 5);
    const monthlyAchievedValue = (monthlyRuleDb?.sales.includeServiceSale !== false ? totalMonthlyAchieved.serviceSale : 0) + (monthlyRuleDb?.sales.includeProductSale === true ? totalMonthlyAchieved.productSale : 0);
    const monthlyBaseForIncentive = monthlyRuleDb?.incentive.applyOn === 'serviceSaleOnly' ? totalMonthlyAchieved.serviceSale : monthlyAchievedValue;
    const { incentive: monthlyIncentive, isTargetMet: isMonthlyTargetMet, appliedRate: monthlyAppliedRate } = calculateIncentiveWithDoubleTarget(monthlyAchievedValue, monthlyTarget, (monthlyRuleDb || {}) as IRule, monthlyBaseForIncentive);
    const monthlyResult = { targetValue: monthlyTarget, totalSaleValue: monthlyAchievedValue, incentiveAmount: monthlyIncentive, isTargetMet: isMonthlyTargetMet, appliedRate: monthlyAppliedRate };


    return NextResponse.json({
        staffName: staff.name,
        calculationDate: targetDate.toISOString().split('T')[0],
        incentive1_daily: dailyCalculationResult,
        incentive2_monthly: monthlyResult,
    });

  } catch (error: any) {
    console.error("--- FATAL ERROR in calculation ---", error);
    return NextResponse.json({ message: 'An internal server error occurred.', error: error.message }, { status: 500 });
  }
}