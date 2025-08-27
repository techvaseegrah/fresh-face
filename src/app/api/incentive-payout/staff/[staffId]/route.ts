import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale, { IDailySale } from '@/models/DailySale';
import IncentivePayout from '@/models/IncentivePayout';
import Staff from '@/models/staff';
import IncentiveRule from '@/models/IncentiveRule';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// --- (Helper functions and interfaces can remain the same) ---
interface ICalculationRule {
  target: { multiplier: number };
  sales: { includeServiceSale: boolean; includeProductSale: boolean; reviewNameValue: number; reviewPhotoValue: number; };
  incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly'; };
}
function getDaysInMonth(year: number, month: number): number { return new Date(year, month + 1, 0).getDate(); }
function calculateIncentive(achievedValue: number, targetValue: number, rule: ICalculationRule, baseForIncentive: number): number {
  if (achievedValue < targetValue) return 0;
  const doubleTargetValue = targetValue * 2;
  const rateToApply = achievedValue >= doubleTargetValue ? rule.incentive.doubleRate : rule.incentive.rate;
  return baseForIncentive * rateToApply;
}

// --- Main GET Handler ---
export async function GET(request: Request, { params }: { params: { staffId: string } }) {
  try {
    // ✅ THE FIX: Get the session directly on the server to find the tenantId
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ message: 'Tenant identification failed. Not authenticated or tenant missing.' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    await dbConnect();
    const { staffId } = params;

    const staff = await Staff.findOne({ _id: staffId, tenantId }).lean();
    if (!staff || !staff.salary || staff.salary <= 0) {
      return NextResponse.json({ message: 'Staff member not found or their salary is not set.' }, { status: 404 });
    }

    // --- 1. Calculate Total Earned Incentives ---
    let totalEarned = 0;
    const allSalesRecords = await DailySale.find({ staff: staffId, tenantId }).sort({ date: 1 }).lean<IDailySale[]>();

    // Calculate daily incentives
    for (const record of allSalesRecords) {
      if (!record.appliedRule) continue; 
      const dailyRule = record.appliedRule as ICalculationRule;
      const recordDate = new Date(record.date);
      const daysInMonth = getDaysInMonth(recordDate.getUTCFullYear(), recordDate.getUTCMonth());
      const dailyTarget = (staff.salary * dailyRule.target.multiplier) / daysInMonth;
      const dailyAchievedValue = (dailyRule.sales.includeServiceSale ? record.serviceSale : 0) + (dailyRule.sales.includeProductSale ? record.productSale : 0) + ((record.reviewsWithName || 0) * dailyRule.sales.reviewNameValue) + ((record.reviewsWithPhoto || 0) * dailyRule.sales.reviewPhotoValue);
      const dailyBaseForIncentive = dailyRule.incentive.applyOn === 'serviceSaleOnly' ? record.serviceSale : dailyAchievedValue;
      totalEarned += calculateIncentive(dailyAchievedValue, dailyTarget, dailyRule, dailyBaseForIncentive);
    }

    // Calculate monthly incentives
    const salesByMonth: { [key: string]: { serviceSale: number, productSale: number } } = {};
    allSalesRecords.forEach(record => {
      const recordDate = new Date(record.date);
      const monthKey = `${recordDate.getUTCFullYear()}-${recordDate.getUTCMonth()}`;
      if (!salesByMonth[monthKey]) salesByMonth[monthKey] = { serviceSale: 0, productSale: 0 };
      salesByMonth[monthKey].serviceSale += record.serviceSale || 0;
      salesByMonth[monthKey].productSale += record.productSale || 0;
    });

    for (const monthKey in salesByMonth) {
        const [year, month] = monthKey.split('-').map(Number);
        const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
        const monthlyRuleDb = await IncentiveRule.findOne({ tenantId, type: 'monthly', createdAt: { $lte: endOfMonth } }).sort({ createdAt: -1 }).lean<ICalculationRule>();
        if (monthlyRuleDb) {
            const monthlyTarget = staff.salary * monthlyRuleDb.target.multiplier;
            const monthlyAchievedValue = (monthlyRuleDb.sales.includeServiceSale ? salesByMonth[monthKey].serviceSale : 0) + (monthlyRuleDb.sales.includeProductSale ? salesByMonth[monthKey].productSale : 0);
            const monthlyBaseForIncentive = monthlyRuleDb.incentive.applyOn === 'serviceSaleOnly' ? salesByMonth[monthKey].serviceSale : monthlyAchievedValue;
            totalEarned += calculateIncentive(monthlyAchievedValue, monthlyTarget, monthlyRuleDb, monthlyBaseForIncentive);
        }
    }

    // --- 2. Calculate Total Paid Incentives ---
    const approvedPayouts = await IncentivePayout.find({ staff: staffId, tenantId, status: 'approved' }).lean();
    const totalPaid = approvedPayouts.reduce((sum, payout) => sum + payout.amount, 0);

    // --- 3. Calculate the balance ---
    const balance = totalEarned - totalPaid;

    return NextResponse.json({
      totalEarned: parseFloat(totalEarned.toFixed(2)),
      totalPaid: parseFloat(totalPaid.toFixed(2)),
      balance: parseFloat(balance.toFixed(2)),
    });

  } catch (error: any) {
    console.error("API Error in /incentive-payout/staff/[staffId]:", error);
    return NextResponse.json({ message: 'An error occurred while fetching the staff summary.', error: error.message }, { status: 500 });
  }
}