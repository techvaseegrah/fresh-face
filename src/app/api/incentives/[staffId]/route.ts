  import { NextResponse } from 'next/server';
  import dbConnect from '@/lib/mongodb';
  import DailySale from '@/models/DailySale';
  import Staff from '@/models/staff';
  import IncentiveRule from '@/models/IncentiveRule';

  export const dynamic = 'force-dynamic';

  // A strong interface for our Rule object.
  interface IRule {
    type: 'daily' | 'monthly';
    target: { multiplier: number };
    sales: {
      includeServiceSale: boolean;
      includeProductSale: boolean;
      reviewNameValue: number;
      reviewPhotoValue: number;
    };
    incentive: {
      rate: number;
      doubleRate: number;
      applyOn: 'totalSaleValue' | 'serviceSaleOnly';
    };
  }

  // HELPER FUNCTION: Get actual days in a specific month
  function getDaysInMonth(year: number, month: number): number {
    // month is 0-indexed (0 = January, 11 = December)
    return new Date(year, month + 1, 0).getDate();
  }

  // HELPER FUNCTION: Calculates incentive, applying a double rate if the double target is met.
  function calculateIncentiveWithDoubleTarget(
    achievedValue: number,
    targetValue: number,
    rule: IRule,
    baseForIncentive: number
  ) {
    let incentive = 0;
    let appliedRate = 0;
    const isTargetMet = achievedValue >= targetValue;

    if (isTargetMet) {
      const doubleTargetValue = targetValue * 2;
      // Check if the double target is achieved
      if (achievedValue >= doubleTargetValue) {
        appliedRate = rule.incentive.doubleRate;
        incentive = baseForIncentive * rule.incentive.doubleRate;
      } else {
        // If only the single target is met
        appliedRate = rule.incentive.rate;
        incentive = baseForIncentive * rule.incentive.rate;
      }
    }

    return { incentive, isTargetMet, appliedRate };
  }

  // MAIN GET HANDLER: Fetches data and calculates incentives for a specific staff member and date.
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

      // Define complete default rules as a fallback.
      const defaultDaily: IRule = { type: 'daily', target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'totalSaleValue' } };
      const defaultMonthly: IRule = { type: 'monthly', target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: false, reviewNameValue: 0, reviewPhotoValue: 0 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'serviceSaleOnly' } };
      
      // Fetch rules from DB, correctly typed as `IRule | null`.
      const dailyRuleDb = await IncentiveRule.findOne({ type: 'daily' }).lean<IRule>();
      const monthlyRuleDb = await IncentiveRule.findOne({ type: 'monthly' }).lean<IRule>();

      // Merge default rules with DB rules
      const dailyRule: IRule = dailyRuleDb ? {
          ...defaultDaily,
          ...dailyRuleDb,
          incentive: {
              ...defaultDaily.incentive,
              ...(dailyRuleDb.incentive || {}),
          },
      } : defaultDaily;

      const monthlyRule: IRule = monthlyRuleDb ? {
          ...defaultMonthly,
          ...monthlyRuleDb,
          incentive: {
              ...defaultMonthly.incentive,
              ...(monthlyRuleDb.incentive || {}),
          },
      } : defaultMonthly;
      
      // Use timezone-safe date parsing to match the DB record correctly.
      const [year, month, day] = dateQuery.split('-').map(Number);
      const targetDate = new Date(Date.UTC(year, month - 1, day));

      // --- Incentive 1: Daily Target Calculation ---
      const dailySaleRecord = await DailySale.findOne({ staff: staffId, date: targetDate });
      let dailyResult = {};

      if (dailySaleRecord) {
          // Get the actual days in the target month (28, 29, 30, or 31)
          const daysInMonth = getDaysInMonth(targetDate.getUTCFullYear(), targetDate.getUTCMonth());
          
          // Calculate daily target based on actual days in the month
          const dailyTarget = (staff.salary * dailyRule.target.multiplier) / daysInMonth;
          
          console.log(`Month: ${targetDate.getUTCMonth() + 1}/${targetDate.getUTCFullYear()}`);
          console.log(`Days in month: ${daysInMonth}`);
          console.log(`Staff salary: ${staff.salary}`);
          console.log(`Daily rule multiplier: ${dailyRule.target.multiplier}`);
          console.log(`Daily target: ${dailyTarget}`);
          
          const dailyAchievedValue = 
              (dailyRule.sales.includeServiceSale ? dailySaleRecord.serviceSale : 0) + 
              (dailyRule.sales.includeProductSale ? dailySaleRecord.productSale : 0) +
              (dailySaleRecord.reviewsWithName * dailyRule.sales.reviewNameValue) +
              (dailySaleRecord.reviewsWithPhoto * dailyRule.sales.reviewPhotoValue);

          const dailyBaseForIncentive = dailyRule.incentive.applyOn === 'serviceSaleOnly' 
              ? dailySaleRecord.serviceSale 
              : dailyAchievedValue;
          
          const { incentive, isTargetMet, appliedRate } = calculateIncentiveWithDoubleTarget(dailyAchievedValue, dailyTarget, dailyRule, dailyBaseForIncentive);
          
          dailyResult = { 
              targetValue: dailyTarget, 
              achievedValue: dailyAchievedValue, 
              incentiveAmount: incentive,
              isTargetMet, 
              appliedRate,
              daysInMonth // Add this for debugging
          };
      }

      // --- Incentive 2: Monthly Target Calculation ---
      const startDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1));
      const endDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 0, 23, 59, 59));
      
      const monthlySalesData = await DailySale.find({ staff: staffId, date: { $gte: startDate, $lte: endDate } });
      
      const totalMonthlyServiceSale = monthlySalesData.reduce((sum, sale) => sum + sale.serviceSale, 0);
      const totalMonthlyProductSale = monthlySalesData.reduce((sum, sale) => sum + sale.productSale, 0);
      const monthlyTarget = staff.salary * monthlyRule.target.multiplier;

      const monthlyAchievedValue = (monthlyRule.sales.includeServiceSale ? totalMonthlyServiceSale : 0) + (monthlyRule.sales.includeProductSale ? totalMonthlyProductSale : 0);
      const monthlyBaseForIncentive = monthlyRule.incentive.applyOn === 'serviceSaleOnly' ? totalMonthlyServiceSale : monthlyAchievedValue;
      
      const { incentive: monthlyIncentive, isTargetMet: isMonthlyTargetMet, appliedRate: monthlyAppliedRate } = calculateIncentiveWithDoubleTarget(monthlyAchievedValue, monthlyTarget, monthlyRule, monthlyBaseForIncentive);
      
      const monthlyResult = { 
          targetValue: monthlyTarget, 
          achievedValue: monthlyAchievedValue, 
          incentiveAmount: monthlyIncentive, 
          isTargetMet: isMonthlyTargetMet, 
          appliedRate: monthlyAppliedRate, 
          totalMonthlyServiceSale 
      };

      // Return the final, correctly calculated data.
      return NextResponse.json({
        staffName: staff.name,
        calculationDate: targetDate.toISOString().split('T')[0],
        incentive1_daily: dailyResult,
        incentive2_monthly: monthlyResult,
      });

    } catch (error: any) {
      console.error("API GET /incentives/[staffId] Error:", error);
      return NextResponse.json({ message: 'An internal server error occurred during calculation.', error: error.message }, { status: 500 });
    }
  }