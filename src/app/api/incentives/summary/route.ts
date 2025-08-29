import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import { getTenantIdOrBail } from '@/lib/tenant';

type IRule = {
  target: { multiplier: number };
  sales: { includeServiceSale: boolean; includeProductSale: boolean; reviewNameValue: number; reviewPhotoValue: number; };
  incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly'; };
};

function getDaysInMonth(year: number, month: number): number { return new Date(year, month + 1, 0).getDate(); }

function calculateIncentiveWithDoubleTarget(achievedValue: number, targetValue: number, rule: IRule, baseForIncentive: number) {
  let incentive = 0;
  const isTargetMet = achievedValue >= targetValue;
  if (isTargetMet) {
    const doubleTargetValue = targetValue * 2;
    if (achievedValue >= doubleTargetValue) {
      incentive = baseForIncentive * rule.incentive.doubleRate;
    } else {
      incentive = baseForIncentive * rule.incentive.rate;
    }
  }
  return { incentive, isTargetMet };
}

export async function GET(request: Request) {
    try {
        await dbConnect();
        const tenantId = getTenantIdOrBail(request as any);
        if (tenantId instanceof NextResponse) return tenantId;

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!startDate || !endDate) {
            return NextResponse.json({ message: 'Start and End dates are required.' }, { status: 400 });
        }

        const dailySales = await DailySale.find({
            tenantId,
            date: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }).populate<{ staff: { _id: string, name: string, salary: number } }>('staff', 'name salary').lean();

        // ✅ ADD `customerCount` TO THE TYPE DEFINITION
        const summaryData: { [staffId: string]: { [date: string]: { incentive: number, sales: number, isTargetMet: boolean, customerCount: number } } } = {};

        for (const sale of dailySales) {
            if (!sale.staff?._id || !sale.appliedRule || !sale.staff.salary || sale.staff.salary <= 0) continue;
            
            const staffId = sale.staff._id.toString();
            const dateString = new Date(sale.date).toISOString().split('T')[0];
            const dailyRuleToUse: IRule = sale.appliedRule;
            const targetDate = new Date(sale.date);
            
            const daysInMonth = getDaysInMonth(targetDate.getUTCFullYear(), targetDate.getUTCMonth());
            const dailyTarget = (sale.staff.salary * dailyRuleToUse.target.multiplier) / daysInMonth;
            const dailyAchieved = (dailyRuleToUse.sales.includeServiceSale ? sale.serviceSale : 0) + (dailyRuleToUse.sales.includeProductSale ? sale.productSale : 0) + (sale.reviewsWithName * dailyRuleToUse.sales.reviewNameValue) + (sale.reviewsWithPhoto * dailyRuleToUse.sales.reviewPhotoValue);
            const dailyBaseForIncentive = dailyRuleToUse.incentive.applyOn === 'serviceSaleOnly' ? sale.serviceSale : dailyAchieved;
            const { incentive, isTargetMet } = calculateIncentiveWithDoubleTarget(dailyAchieved, dailyTarget, dailyRuleToUse, dailyBaseForIncentive);

            if (!summaryData[staffId]) {
                summaryData[staffId] = {};
            }
            summaryData[staffId][dateString] = { 
                incentive, 
                sales: dailyAchieved, 
                isTargetMet,
                // ✅ ADD THE CUSTOMER COUNT TO THE RESPONSE
                customerCount: sale.customerCount || 0 
            };
        }

        return NextResponse.json({ success: true, data: summaryData });

    } catch (error: any) {
        console.error("API GET /api/incentives/summary Error:", error);
        return NextResponse.json({ message: 'An internal server error occurred', error: error.message }, { status: 500 });
    }
}