// /app/api/incentives/calculation/[staffId]/route.ts - FINAL CORRECTED VERSION

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import IncentiveRule, { IIncentiveRule } from '@/models/IncentiveRule';
import { getTenantIdOrBail } from '@/lib/tenant';

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

    if (!dateQuery) return NextResponse.json({ message: 'Date is required.' }, { status: 400 });

    const staff = await Staff.findOne({ _id: staffId, tenantId }).lean();
    if (!staff || !staff.salary || staff.salary <= 0) return NextResponse.json({ message: 'Staff member not found or salary is not set.' }, { status: 404 });
    
    const [year, month, day] = dateQuery.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    
    const dailySaleRecord = await DailySale.findOne({ staff: staffId, date: targetDate, tenantId }).lean();

    const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    const activeRuleDb = await IncentiveRule.findOne({ tenantId, type: 'daily', createdAt: { $lte: dayEnd } }).sort({ createdAt: -1 }).lean<IIncentiveRule>();
    const defaultRule: IRule = { target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'totalSaleValue' } };
    
    const ruleForCalc: IRule = activeRuleDb ? {
        target: { ...defaultRule.target, ...(activeRuleDb.target || {}) },
        sales: { ...defaultRule.sales, ...(activeRuleDb.sales || {}) },
        incentive: { ...defaultRule.incentive, ...(activeRuleDb.incentive || {}) },
    } : defaultRule;

    const dailyRuleToUse: IRule = dailySaleRecord?.appliedRule || ruleForCalc;
    const ruleUsedSource = dailySaleRecord?.appliedRule ? "Recorded" : "Current Rule (No Sales Recorded)";
    const serviceSale = dailySaleRecord?.serviceSale || 0;
    const productSale = dailySaleRecord?.productSale || 0;
    const reviewsWithName = dailySaleRecord?.reviewsWithName || 0;
    const reviewsWithPhoto = dailySaleRecord?.reviewsWithPhoto || 0;
    
    const daysInMonth = getDaysInMonth(targetDate.getUTCFullYear(), targetDate.getUTCMonth());
    const dailyTarget = (staff.salary * dailyRuleToUse.target.multiplier) / daysInMonth;
    const dailyAchievedValue = (dailyRuleToUse.sales.includeServiceSale ? serviceSale : 0) + (dailyRuleToUse.sales.includeProductSale ? productSale : 0) + (reviewsWithName * dailyRuleToUse.sales.reviewNameValue) + (reviewsWithPhoto * dailyRuleToUse.sales.reviewPhotoValue);
    const dailyBaseForIncentive = dailyRuleToUse.incentive.applyOn === 'serviceSaleOnly' ? serviceSale : dailyAchievedValue;
    const { incentive, isTargetMet, appliedRate } = calculateIncentiveWithDoubleTarget(dailyAchievedValue, dailyTarget, dailyRuleToUse, dailyBaseForIncentive);
    const dailyCalculationResult = { 
        targetValue: dailyTarget, totalSaleValue: serviceSale + productSale, incentiveAmount: incentive, 
        isTargetMet, appliedRate, ruleUsed: ruleUsedSource 
    };

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthlySalesData = await DailySale.find({ staff: staffId, date: { $gte: monthStart, $lte: dayEnd }, tenantId }).lean();
    const totalMonthlyServiceSale = monthlySalesData.reduce((sum, sale) => sum + (sale.serviceSale || 0), 0);
    const totalMonthlyProductSale = monthlySalesData.reduce((sum, sale) => sum + (sale.productSale || 0), 0);
    
    // ✅ FIX: Corrected typo from `IIn-centiveRule` to `IIncentiveRule`
    const monthlyRuleDb = await IncentiveRule.findOne({ tenantId, type: 'monthly', createdAt: { $lte: dayEnd } }).sort({ createdAt: -1 }).lean<IIncentiveRule>();
    
    const monthlyTarget = staff.salary * (monthlyRuleDb?.target?.multiplier || 5);
    const monthlyAchievedValue = (monthlyRuleDb?.sales?.includeServiceSale !== false ? totalMonthlyServiceSale : 0) + (monthlyRuleDb?.sales?.includeProductSale === true ? totalMonthlyProductSale : 0);
    const monthlyBaseForIncentive = monthlyRuleDb?.incentive?.applyOn === 'serviceSaleOnly' ? totalMonthlyServiceSale : monthlyAchievedValue;
    const { incentive: monthlyIncentive, isTargetMet: isMonthlyTargetMet, appliedRate: monthlyAppliedRate } = calculateIncentiveWithDoubleTarget(monthlyAchievedValue, monthlyTarget, (monthlyRuleDb || defaultRule) as IRule, monthlyBaseForIncentive);
    const monthlyResult = { targetValue: monthlyTarget, totalSaleValue: monthlyAchievedValue, incentiveAmount: monthlyIncentive, isTargetMet: isMonthlyTargetMet, appliedRate: monthlyAppliedRate };

    return NextResponse.json({
        staffName: staff.name, calculationDate: targetDate.toISOString().split('T')[0],
        incentive1_daily: dailyCalculationResult, incentive2_monthly: monthlyResult,
    });
  } catch (error: any) {
    console.error("--- FATAL ERROR in calculation ---", error);
    return NextResponse.json({ message: 'An internal server error occurred.', error: error.message }, { status: 500 });
  }
}