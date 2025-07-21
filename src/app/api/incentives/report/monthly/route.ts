// File: src/app/api/incentives/report/monthly/route.ts
// THIS API HANDLES THE DATE RANGE REPORT (CORRECTED LOGIC)

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import IncentiveRule from '@/models/IncentiveRule';

export const dynamic = 'force-dynamic';

// --- Helper Functions ---
interface IRule {
  type: 'daily' | 'monthly';
  target: { multiplier: number };
  sales: { includeServiceSale: boolean; includeProductSale: boolean; reviewNameValue: number; reviewPhotoValue: number; };
  incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly'; };
}

function calculateIncentiveWithDoubleTarget(achievedValue: number, targetValue: number, rule: IRule, baseForIncentive: number) {
  let incentive = 0; let appliedRate = 0; const isTargetMet = achievedValue >= targetValue;
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

// --- Main GET Handler for Date Range ---
export async function GET(request: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const startDateQuery = searchParams.get('startDate');
    const endDateQuery = searchParams.get('endDate');

    if (!startDateQuery || !endDateQuery) {
      return NextResponse.json({ message: 'Both startDate and endDate query parameters are required.' }, { status: 400 });
    }

    const startDate = new Date(startDateQuery);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(endDateQuery);
    endDate.setUTCHours(23, 59, 59, 999);
    
    const allStaff = await Staff.find({ salary: { $exists: true, $gt: 0 } }).lean();
    if (!allStaff.length) { return NextResponse.json({ data: [], message: 'No staff with salary found.' }, { status: 200 }); }

    const defaultDaily: IRule = { type: 'daily', target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'totalSaleValue' } };
    const defaultMonthly: IRule = { type: 'monthly', target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: false, reviewNameValue: 0, reviewPhotoValue: 0 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'serviceSaleOnly' } };
    const dailyRuleDb = await IncentiveRule.findOne({ type: 'daily' }).lean<IRule>();
    const monthlyRuleDb = await IncentiveRule.findOne({ type: 'monthly' }).lean<IRule>();
    const dailyRule: IRule = dailyRuleDb ? { ...defaultDaily, ...dailyRuleDb, incentive: { ...defaultDaily.incentive, ...dailyRuleDb.incentive } } : defaultDaily;
    const monthlyRule: IRule = monthlyRuleDb ? { ...defaultMonthly, ...monthlyRuleDb, incentive: { ...defaultMonthly.incentive, ...monthlyRuleDb.incentive } } : defaultMonthly;
    
    const reportData = [];
    for (const staff of allStaff) {
      if (!staff.salary) continue;

      const staffSales = await DailySale.find({ staff: staff._id, date: { $gte: startDate, $lte: endDate } }).lean();
      if (staffSales.length === 0) continue; 
      
      // MODIFIED: Aggregators for daily and monthly calculations
      let totalDailyTargetInRange = 0;
      let totalDailyAchievedInRange = 0;
      let totalDailyIncentiveInRange = 0;
      let totalRangeServiceSale = 0;
      let totalRangeProductSale = 0;

      for (const sale of staffSales) {
        const daysInSaleMonth = new Date(sale.date.getUTCFullYear(), sale.date.getUTCMonth() + 1, 0).getDate();
        
        // --- Daily calculation for each day in the range ---
        const dailyTarget = (staff.salary * dailyRule.target.multiplier) / daysInSaleMonth;
        const dailyAchievedValue = (dailyRule.sales.includeServiceSale ? sale.serviceSale : 0) + (dailyRule.sales.includeProductSale ? sale.productSale : 0) + (sale.reviewsWithName * dailyRule.sales.reviewNameValue) + (sale.reviewsWithPhoto * dailyRule.sales.reviewPhotoValue);
        const dailyBaseForIncentive = dailyRule.incentive.applyOn === 'serviceSaleOnly' ? sale.serviceSale : dailyAchievedValue;
        const { incentive: dailyIncentive } = calculateIncentiveWithDoubleTarget(dailyAchievedValue, dailyTarget, dailyRule, dailyBaseForIncentive);

        // Aggregate daily figures
        totalDailyTargetInRange += dailyTarget;
        totalDailyAchievedInRange += dailyAchievedValue;
        totalDailyIncentiveInRange += dailyIncentive;
        
        // Aggregate sales for the monthly calculation
        totalRangeServiceSale += sale.serviceSale;
        totalRangeProductSale += sale.productSale;
      }

      // --- Monthly calculation for the entire date range ---
      const monthlyTargetValue = staff.salary * monthlyRule.target.multiplier;
      const monthlyAchievedValue = (monthlyRule.sales.includeServiceSale ? totalRangeServiceSale : 0) + (monthlyRule.sales.includeProductSale ? totalRangeProductSale : 0);
      const monthlyBaseForIncentive = monthlyRule.incentive.applyOn === 'serviceSaleOnly' ? totalRangeServiceSale : monthlyAchievedValue;
      const { incentive: monthlyIncentive, isTargetMet: isMonthlyTargetMet } = calculateIncentiveWithDoubleTarget(monthlyAchievedValue, monthlyTargetValue, monthlyRule, monthlyBaseForIncentive);

      // MODIFIED: Construct the response object in the format the frontend expects
      reportData.push({
        staffName: staff.name,
        incentive1_daily: {
          targetValue: totalDailyTargetInRange,
          totalSaleValue: totalDailyAchievedInRange,
          incentiveAmount: totalDailyIncentiveInRange,
          isTargetMet: totalDailyIncentiveInRange > 0, // A simple check if any daily incentive was earned
        },
        incentive2_monthly: {
          monthlyTarget: monthlyTargetValue,
          totalMonthlyServiceSale: monthlyAchievedValue,
          incentiveAmount: monthlyIncentive,
          isTargetMet: isMonthlyTargetMet
        },
      });
    }
    
    return NextResponse.json({ data: reportData });

  } catch (error: any) {
    console.error("API GET /report/monthly (Date Range) Error:", error);
    return NextResponse.json({ message: 'An internal server error occurred.', error: error.message }, { status: 500 });
  }
}