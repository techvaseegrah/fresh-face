import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import IncentiveRule from '@/models/IncentiveRule';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { staffId: string } }) {
  try {
    await dbConnect();
    const { staffId } = params;
    const { searchParams } = new URL(request.url);
    const dateQuery = searchParams.get('date');

    if (!dateQuery) {
      return NextResponse.json({ message: 'Date query parameter is required.' }, { status: 400 });
    }

    const staff = await Staff.findById(staffId);
    if (!staff) return NextResponse.json({ message: 'Staff member not found.' }, { status: 404 });
    if (!staff.salary) return NextResponse.json({ message: 'Cannot calculate: Staff salary is not set.' }, { status: 400 });

    let dailyRule = await IncentiveRule.findOne({ type: 'daily' });
    let monthlyRule = await IncentiveRule.findOne({ type: 'monthly' });
    if (!dailyRule) dailyRule = new IncentiveRule({ type: 'daily' });
    if (!monthlyRule) monthlyRule = new IncentiveRule({ type: 'monthly' });
    
    const targetDate = new Date(dateQuery);
    targetDate.setHours(0, 0, 0, 0);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();

    // --- Incentive 1: Daily Target Calculation ---
    const dailySaleRecord = await DailySale.findOne({ staff: staffId, date: targetDate });
    let dailyResult = {};

    console.log("--- DEBUGGING DAILY CALCULATION ---");
    console.log("Fetched Record from DB:", dailySaleRecord);
    console.log("Daily Rule Being Used:", dailyRule.sales);
    console.log("-------------------------------------");

    if (dailySaleRecord) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const dailyTarget = (staff.salary * dailyRule.target.multiplier) / daysInMonth;
        
        const totalSaleValue = 
            (dailyRule.sales.includeServiceSale ? dailySaleRecord.serviceSale : 0) + 
            (dailyRule.sales.includeProductSale ? dailySaleRecord.productSale : 0) +
            (dailySaleRecord.reviewsWithName * dailyRule.sales.reviewNameValue) +
            (dailySaleRecord.reviewsWithPhoto * dailyRule.sales.reviewPhotoValue);

        let incentive = 0;
        if (totalSaleValue > dailyTarget) {
            const baseForIncentive = dailyRule.incentive.applyOn === 'serviceSaleOnly' 
                ? dailySaleRecord.serviceSale 
                : totalSaleValue;
            incentive = baseForIncentive * dailyRule.incentive.rate;
        }
        dailyResult = { dailyTarget, totalSaleValue, incentive, isTargetMet: totalSaleValue > dailyTarget };
    }

    // --- Incentive 2: Monthly Target Calculation ---
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);
    const monthlySalesData = await DailySale.find({ staff: staffId, date: { $gte: startDate, $lte: endDate } });
    
    const totalMonthlyServiceSale = monthlySalesData.reduce((sum, sale) => sum + sale.serviceSale, 0);
    const totalMonthlyProductSale = monthlySalesData.reduce((sum, sale) => sum + sale.productSale, 0);
    const monthlyTarget = staff.salary * monthlyRule.target.multiplier;

    const totalMonthlySaleForCheck = 
        (monthlyRule.sales.includeServiceSale ? totalMonthlyServiceSale : 0) +
        (monthlyRule.sales.includeProductSale ? totalMonthlyProductSale : 0);

    let monthlyIncentive = 0;
    if (totalMonthlySaleForCheck > monthlyTarget) {
        const baseForIncentive = monthlyRule.incentive.applyOn === 'serviceSaleOnly' ? totalMonthlyServiceSale : totalMonthlySaleForCheck;
        monthlyIncentive = baseForIncentive * monthlyRule.incentive.rate;
    }
    
    const monthlyResult = { monthlyTarget, totalMonthlyServiceSale, incentive: monthlyIncentive, isTargetMet: totalMonthlySaleForCheck > monthlyTarget };

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