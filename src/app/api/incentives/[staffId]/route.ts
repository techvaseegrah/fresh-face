// app/api/incentives/calculation/[staffId]/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale, { IDailySale } from '@/models/DailySale';
import Staff from '@/models/staff';
import IncentiveRule from '@/models/IncentiveRule';

export const dynamic = 'force-dynamic';

// Define the rule interface here to ensure type safety within this file
interface IRule {
  type: 'daily' | 'monthly';
  target: { multiplier: number };
  sales: { includeServiceSale: boolean; includeProductSale: boolean; reviewNameValue: number; reviewPhotoValue: number; };
  incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly'; };
}

// Helper functions (unchanged)
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function calculateIncentiveWithDoubleTarget(achievedValue: number, targetValue: number, rule: IRule, baseForIncentive: number) {
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

export async function GET(request: Request, { params }: { params: { staffId: string } }) {
  try {
    await dbConnect();
    const { staffId } = params;
    const { searchParams } = new URL(request.url);
    const dateQuery = searchParams.get('date');

    if (!dateQuery) {
      return NextResponse.json({ message: 'Date query parameter is required.' }, { status: 400 });
    }

    const staff = await Staff.findById(staffId).lean();
    if (!staff) return NextResponse.json({ message: 'Staff member not found.' }, { status: 404 });
    if (!staff.salary) return NextResponse.json({ message: 'Cannot calculate: Staff salary is not set.' }, { status: 400 });

    const [year, month, day] = dateQuery.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));

    const dailySaleRecord = await DailySale.findOne({ staff: staffId, date: targetDate }).lean<IDailySale>();
    
    // Rename to avoid confusion with the monthly result object
    let dailyCalculationResult = {};

    if (dailySaleRecord) {
      // ✨ --- START: THIS IS THE CRITICAL CHANGE ---
      // This logic now correctly uses the snapshotted rule from your model.
      let dailyRuleToUse: IRule;
      let ruleUsedSource = '';

      if (dailySaleRecord.appliedRule && dailySaleRecord.appliedRule.target) {
        // PRIORITY 1: A rule was snapshotted on the record. ALWAYS use this for consistency.
        ruleUsedSource = 'Snapshotted Rule (Historical)';
        dailyRuleToUse = { type: 'daily', ...dailySaleRecord.appliedRule };
      } else {
        // PRIORITY 2 (FALLBACK): For old data without a snapshot.
        console.warn(`[Incentive Calc] Fallback rule used for staff ${staffId} on ${dateQuery}. Record is missing 'appliedRule'.`);
        ruleUsedSource = 'Current Rule (Fallback)';
        const defaultDaily: IRule = { type: 'daily', target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'totalSaleValue' } };
        const dailyRuleDb = await IncentiveRule.findOne({ type: 'daily' }).lean<IRule>();
        // Merge DB rule with default to prevent crashes if a field is missing
        dailyRuleToUse = dailyRuleDb ? { ...defaultDaily, ...dailyRuleDb, sales: {...defaultDaily.sales, ...(dailyRuleDb.sales || {})}, incentive: { ...defaultDaily.incentive, ...(dailyRuleDb.incentive || {}) } } : defaultDaily;
      }
      // ✨ --- END: CRITICAL CHANGE ---

      const daysInMonth = getDaysInMonth(targetDate.getUTCFullYear(), targetDate.getUTCMonth());
      const dailyTarget = (staff.salary * dailyRuleToUse.target.multiplier) / daysInMonth;

      const dailyAchievedValue =
        (dailyRuleToUse.sales.includeServiceSale ? dailySaleRecord.serviceSale : 0) +
        (dailyRuleToUse.sales.includeProductSale ? dailySaleRecord.productSale : 0) +
        (dailySaleRecord.reviewsWithName * dailyRuleToUse.sales.reviewNameValue) +
        (dailySaleRecord.reviewsWithPhoto * dailyRuleToUse.sales.reviewPhotoValue);

      const dailyBaseForIncentive = dailyRuleToUse.incentive.applyOn === 'serviceSaleOnly'
        ? dailySaleRecord.serviceSale
        : dailyAchievedValue;
      
      const { incentive, isTargetMet, appliedRate } = calculateIncentiveWithDoubleTarget(dailyAchievedValue, dailyTarget, dailyRuleToUse, dailyBaseForIncentive);
      
      dailyCalculationResult = { 
        targetValue: dailyTarget, 
        totalSaleValue: dailyAchievedValue, // Renamed for clarity on the frontend
        incentiveAmount: incentive,
        isTargetMet, 
        appliedRate,
        ruleUsedSource // Essential for debugging!
      };
    }

    // --- Incentive 2: Monthly Target Calculation (No changes needed here) ---
    const defaultMonthly: IRule = { type: 'monthly', target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: false, reviewNameValue: 0, reviewPhotoValue: 0 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'serviceSaleOnly' } };
    const monthlyRuleDb = await IncentiveRule.findOne({ type: 'monthly' }).lean<IRule>();
    const monthlyRule: IRule = monthlyRuleDb ? { ...defaultMonthly, ...monthlyRuleDb, sales: {...defaultMonthly.sales, ...(monthlyRuleDb.sales || {})}, incentive: { ...defaultMonthly.incentive, ...(monthlyRuleDb.incentive || {}) } } : defaultMonthly;
    
    const startDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1));
    const endDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 0, 23, 59, 59));
    
    const monthlySalesData = await DailySale.find({ staff: staffId, date: { $gte: startDate, $lte: endDate } }).lean();
    
    const totalMonthlyServiceSale = monthlySalesData.reduce((sum, sale) => sum + sale.serviceSale, 0);
    const totalMonthlyProductSale = monthlySalesData.reduce((sum, sale) => sum + sale.productSale, 0);
    const monthlyTarget = staff.salary * monthlyRule.target.multiplier;

    const monthlyAchievedValue = (monthlyRule.sales.includeServiceSale ? totalMonthlyServiceSale : 0) + (monthlyRule.sales.includeProductSale ? totalMonthlyProductSale : 0);
    const monthlyBaseForIncentive = monthlyRule.incentive.applyOn === 'serviceSaleOnly' ? totalMonthlyServiceSale : monthlyAchievedValue;
    
    const { incentive: monthlyIncentive, isTargetMet: isMonthlyTargetMet, appliedRate: monthlyAppliedRate } = calculateIncentiveWithDoubleTarget(monthlyAchievedValue, monthlyTarget, monthlyRule, monthlyBaseForIncentive);
    
    const monthlyResult = { 
      monthlyTarget: monthlyTarget, // Renamed for clarity
      totalMonthlyServiceSale: totalMonthlyServiceSale, // Renamed for clarity
      incentiveAmount: monthlyIncentive, 
      isTargetMet: isMonthlyTargetMet, 
      appliedRate: monthlyAppliedRate, 
    };

    return NextResponse.json({
      staffName: staff.name,
      calculationDate: targetDate.toISOString().split('T')[0],
      incentive1_daily: dailyCalculationResult,
      incentive2_monthly: monthlyResult,
    });

  } catch (error: any) {
    console.error("API GET /incentives/calculation/[staffId] Error:", error);
    return NextResponse.json({ message: 'An internal server error occurred.', error: error.message }, { status: 500 });
  }
}