// Replace the entire content of: src/app/api/incentives/report/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale, { IDailySale } from '@/models/DailySale';
import Staff, { IStaff } from '@/models/staff';
import IncentiveRule, { IIncentiveRule } from '@/models/IncentiveRule';
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';

// Define the shape of a rule object for calculations
type IRule = {
  target: { multiplier: number };
  sales: { includeServiceSale: boolean; includeProductSale: boolean; reviewNameValue: number; reviewPhotoValue: number; };
  incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly'; };
};

// Helper calculation functions (these are correct)
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

export async function POST(request: Request) {
  try {
    await dbConnect();
    const tenantId = getTenantIdOrBail(request as any);
    if (tenantId instanceof NextResponse) return tenantId;

    const body = await request.json();
    const { startDate, endDate } = body;
    if (!startDate || !endDate) {
      return NextResponse.json({ message: 'Start and End date are required.' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const [dailySales, allStaff, monthlyRules] = await Promise.all([
      DailySale.find({ tenantId, date: { $gte: start, $lte: end } }).populate<{ staff: IStaff }>('staff', 'name salary').lean(),
      Staff.find({ tenantId }).lean(),
      IncentiveRule.find({ tenantId, type: 'monthly' }).sort({ createdAt: -1 }).lean()
    ]);

    const staffMap = new Map(allStaff.map(s => [s._id.toString(), s]));
    
    const dailyReport = [];
    const staffTotals = new Map<string, { name: string; totalAchieved: number; totalIncentive: number }>();
    const monthlyDataAgg = new Map<string, { serviceSale: number, productSale: number, staffId: string, month: string, salary: number }>();

    for (const sale of dailySales) {
      if (!sale.staff?._id || !sale.appliedRule) continue;
      const staffId = sale.staff._id.toString();
      const staffMember = staffMap.get(staffId);
      if (!staffMember || !staffMember.salary || staffMember.salary <= 0) continue;

      const dailyRuleToUse: IRule = sale.appliedRule;
      const targetDate = new Date(sale.date);
      const daysInMonth = getDaysInMonth(targetDate.getUTCFullYear(), targetDate.getUTCMonth());
      const dailyTarget = (staffMember.salary * dailyRuleToUse.target.multiplier) / daysInMonth;
      const dailyAchieved = (dailyRuleToUse.sales.includeServiceSale ? sale.serviceSale : 0) + (dailyRuleToUse.sales.includeProductSale ? sale.productSale : 0) + (sale.reviewsWithName * dailyRuleToUse.sales.reviewNameValue) + (sale.reviewsWithPhoto * dailyRuleToUse.sales.reviewPhotoValue);
      const dailyBaseForIncentive = dailyRuleToUse.incentive.applyOn === 'serviceSaleOnly' ? sale.serviceSale : dailyAchieved;
      const { incentive, isTargetMet, appliedRate } = calculateIncentiveWithDoubleTarget(dailyAchieved, dailyTarget, dailyRuleToUse, dailyBaseForIncentive);

      dailyReport.push({
        Date: targetDate.toISOString().split('T')[0],
        'Staff Name': staffMember.name,
        'Target (₹)': dailyTarget.toFixed(2),
        'Achieved (₹)': dailyAchieved.toFixed(2),
        'Target Met': isTargetMet ? 'Yes' : 'No',
        'Applied Rate': appliedRate,
        'Incentive (₹)': incentive.toFixed(2),
      });

      if (!staffTotals.has(staffId)) {
        staffTotals.set(staffId, { name: staffMember.name, totalAchieved: 0, totalIncentive: 0 });
      }
      const currentTotals = staffTotals.get(staffId)!;
      currentTotals.totalAchieved += dailyAchieved;
      currentTotals.totalIncentive += incentive;
      
      const monthKey = `${targetDate.getUTCFullYear()}-${String(targetDate.getUTCMonth() + 1).padStart(2, '0')}`;
      const monthlyAggKey = `${staffId}-${monthKey}`;
      if (!monthlyDataAgg.has(monthlyAggKey)) {
          monthlyDataAgg.set(monthlyAggKey, { serviceSale: 0, productSale: 0, staffId, month: monthKey, salary: staffMember.salary });
      }
      const currentMonthlyAgg = monthlyDataAgg.get(monthlyAggKey)!;
      currentMonthlyAgg.serviceSale += sale.serviceSale;
      currentMonthlyAgg.productSale += sale.productSale;
    }

    const monthlyReport = [];
    for (const [key, agg] of monthlyDataAgg.entries()) {
      const staffMember = staffMap.get(agg.staffId);
      if(!staffMember) continue;
      
      const monthEndDate = new Date(new Date(agg.month + "-01").getFullYear(), new Date(agg.month + "-01").getMonth() + 1, 0, 23, 59, 59, 999);
      const activeMonthlyRule = monthlyRules.find(r => new Date(r.createdAt) <= monthEndDate);
      if (!activeMonthlyRule) continue;

      // ✅ THE FIX: Create a clean, plain object that matches the IRule type.
      // This removes the type error by ensuring the object is in the correct shape.
      const ruleForCalc: IRule = {
        target: activeMonthlyRule.target,
        sales: activeMonthlyRule.sales,
        incentive: activeMonthlyRule.incentive,
      };

      const monthlyTarget = agg.salary * ruleForCalc.target.multiplier;
      const monthlyAchieved = (ruleForCalc.sales.includeServiceSale ? agg.serviceSale : 0) + (ruleForCalc.sales.includeProductSale ? agg.productSale : 0);
      const monthlyBaseForIncentive = ruleForCalc.incentive.applyOn === 'serviceSaleOnly' ? agg.serviceSale : monthlyAchieved;
      const { incentive, isTargetMet } = calculateIncentiveWithDoubleTarget(monthlyAchieved, monthlyTarget, ruleForCalc, monthlyBaseForIncentive);

      monthlyReport.push({
        Month: agg.month,
        'Staff Name': staffMember.name,
        'Target (₹)': monthlyTarget.toFixed(2),
        'Achieved (₹)': monthlyAchieved.toFixed(2),
        'Target Met': isTargetMet ? 'Yes' : 'No',
        'Incentive (₹)': incentive.toFixed(2)
      });
    }

    const staffSummary = Array.from(staffTotals.values()).map(s => ({
      'Staff Name': s.name,
      'Total Achieved (₹)': s.totalAchieved.toFixed(2),
      'Total Incentive (₹)': s.totalIncentive.toFixed(2)
    }));
    
    return NextResponse.json({ 
        success: true, 
        data: { dailyReport, monthlyReport, staffSummary } 
    });

  } catch (error: any) {
    console.error("API POST /api/incentives/report Error:", error);
    return NextResponse.json({ message: 'An internal server error occurred', error: error.message }, { status: 500 });
  }
}