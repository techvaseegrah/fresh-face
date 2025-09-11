// /app/api/incentive-payout/staff/[staffId]/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import IncentiveRule from '@/models/IncentiveRule';
import IncentivePayout from '@/models/IncentivePayout';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// --- TYPE DEFINITIONS ---
type DailyRule = {
  target: { multiplier: number };
  sales: { includeServiceSale: boolean; includeProductSale: boolean; reviewNameValue: number; reviewPhotoValue: number; };
  incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly'; };
};
type MonthlyRule = {
  target: { multiplier: number };
  sales: { includeServiceSale: boolean; includeProductSale: boolean; };
  incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly'; };
}
type FixedTargetRule = {
    target: { targetValue: number };
    incentive: { rate: number; doubleRate: number };
}

// --- HELPER FUNCTIONS ---
function getDaysInMonth(year: number, month: number): number { return new Date(year, month + 1, 0).getDate(); }

function calculateIncentive(achievedValue: number, targetValue: number, rate: number, doubleRate: number, baseForIncentive: number) {
    let incentive = 0;
    if (achievedValue >= targetValue && targetValue > 0) {
        const doubleTargetValue = targetValue * 2;
        incentive = baseForIncentive * (achievedValue >= doubleTargetValue ? doubleRate : rate);
    }
    return incentive;
}

// Helper to find the correct historical rule from a pre-fetched list
function findHistoricalRule(rules: any[], timestamp: Date) {
    if (!rules || rules.length === 0) return null;
    // Find the most recent rule created at or before the given timestamp
    return rules.find(rule => new Date(rule.createdAt) <= timestamp);
}

// Helper to calculate all CUMULATIVE incentives based on a set of sales records
function calculateTotalCumulativeIncentive(salesUpToDate: any[], staff: any, rules: any) {
    let totalIncentive = 0;
    if (rules.monthly) {
        const rule = rules.monthly as MonthlyRule;
        const totalService = salesUpToDate.reduce((sum, s) => sum + s.serviceSale, 0);
        const totalProduct = salesUpToDate.reduce((sum, s) => sum + s.productSale, 0);
        const target = staff.salary * rule.target.multiplier;
        const achieved = (rule.sales.includeServiceSale ? totalService : 0) + (rule.sales.includeProductSale ? totalProduct : 0);
        const base = rule.incentive.applyOn === 'serviceSaleOnly' ? totalService : achieved;
        totalIncentive += calculateIncentive(achieved, target, rule.incentive.rate, rule.incentive.doubleRate, base);
    }
    if (rules.package) {
        const rule = rules.package as FixedTargetRule;
        const totalPackage = salesUpToDate.reduce((sum, s) => sum + s.packageSale, 0);
        const target = rule.target.targetValue;
        totalIncentive += calculateIncentive(totalPackage, target, rule.incentive.rate, rule.incentive.doubleRate, totalPackage);
    }
    if (rules.giftCard) {
        const rule = rules.giftCard as FixedTargetRule;
        const totalGiftCard = salesUpToDate.reduce((sum, s) => sum + s.giftCardSale, 0);
        const target = rule.target.targetValue;
        totalIncentive += calculateIncentive(totalGiftCard, target, rule.incentive.rate, rule.incentive.doubleRate, totalGiftCard);
    }
    return totalIncentive;
}


// --- Main GET Handler ---
export async function GET(request: Request, { params }: { params: { staffId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ message: 'Not authenticated or tenant missing.' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;
    const { staffId } = params;

    await dbConnect();

    const staff = await Staff.findOne({ _id: staffId, tenantId }).lean();
    if (!staff || !staff.salary || staff.salary <= 0) {
      return NextResponse.json({ message: 'Staff member not found or their salary is not set.' }, { status: 404 });
    }

    // --- 1. Fetch ALL data required for a full historical recalculation ---
    const allSales = await DailySale.find({ tenantId, staff: staffId }).sort({ date: 'asc' }).lean();
    const allRules = {
        daily: await IncentiveRule.find({ tenantId, type: 'daily' }).sort({ createdAt: -1 }).lean(),
        monthly: await IncentiveRule.find({ tenantId, type: 'monthly' }).sort({ createdAt: -1 }).lean(),
        package: await IncentiveRule.find({ tenantId, type: 'package' }).sort({ createdAt: -1 }).lean(),
        giftCard: await IncentiveRule.find({ tenantId, type: 'giftCard' }).sort({ createdAt: -1 }).lean(),
    };
    const approvedPayouts = await IncentivePayout.find({ staff: staffId, tenantId, status: 'approved' }).lean();
    
    let totalEarned = 0;
    let lastCumulativeIncentive = 0;
    let salesUpToYesterday: any[] = [];

    // --- 2. Iterate through sales chronologically (day by day) ---
    for (let i = 0; i < allSales.length; i++) {
        const currentSale = allSales[i];
        const saleDate = new Date(currentSale.date);

        // --- Calculate Daily Incentive ---
        let dailyIncentive = 0;
        const dailyRule = findHistoricalRule(allRules.daily, saleDate) as DailyRule | undefined;
        if (dailyRule) {
            const daysInMonth = getDaysInMonth(saleDate.getFullYear(), saleDate.getMonth());
            const target = (staff.salary * dailyRule.target.multiplier) / daysInMonth;
            const reviewBonus = (currentSale.reviewsWithName * dailyRule.sales.reviewNameValue) + (currentSale.reviewsWithPhoto * dailyRule.sales.reviewPhotoValue);
            const achieved = (dailyRule.sales.includeServiceSale ? currentSale.serviceSale : 0) + (dailyRule.sales.includeProductSale ? currentSale.productSale : 0) + reviewBonus;
            const base = dailyRule.incentive.applyOn === 'serviceSaleOnly' ? currentSale.serviceSale : achieved;
            dailyIncentive = calculateIncentive(achieved, target, dailyRule.incentive.rate, dailyRule.incentive.doubleRate, base);
        }

        // --- Calculate Cumulative Incentive Delta ---
        const salesUpToToday = [...salesUpToYesterday, currentSale];
        const historicalTimestamp = new Date(currentSale.createdAt);
        const relevantRules = {
            monthly: findHistoricalRule(allRules.monthly, historicalTimestamp),
            package: findHistoricalRule(allRules.package, historicalTimestamp),
            giftCard: findHistoricalRule(allRules.giftCard, historicalTimestamp),
        };

        const totalIncentiveToday = calculateTotalCumulativeIncentive(salesUpToToday, staff, relevantRules);
        const cumulativeIncentiveEarnedToday = totalIncentiveToday - lastCumulativeIncentive;
        
        // --- Add this day's total earnings to the grand total ---
        totalEarned += dailyIncentive + cumulativeIncentiveEarnedToday;

        // --- Update trackers for the next day's calculation ---
        lastCumulativeIncentive = totalIncentiveToday;
        salesUpToYesterday = salesUpToToday;
    }


    // --- 3. Final calculation of paid amount and balance ---
    const totalPaid = approvedPayouts.reduce((sum, payout) => sum + payout.amount, 0);
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