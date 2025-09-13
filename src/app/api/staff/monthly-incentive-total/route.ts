// /api/staff/monthly-incentive-total/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Staff from '@/models/staff';
import DailySale from '@/models/DailySale';
import IncentiveRule from '@/models/IncentiveRule';
import { startOfMonth, endOfMonth } from 'date-fns';

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
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const calculateIncentive = (achieved: number, target: number, rate: number, doubleRate: number, base: number) => {
    if (achieved < target || target <= 0) return { incentive: 0, isTargetMet: false, appliedRate: 0 };
    const doubleTarget = target * 2;
    const appliedRate = achieved >= doubleTarget ? doubleRate : rate;
    return { incentive: base * appliedRate, isTargetMet: true, appliedRate };
};

const findHistoricalRule = <T>(rules: T[], timestamp: Date): T | null => {
    if (!rules || rules.length === 0) return null;
    return rules.find(rule => new Date((rule as any).createdAt) <= timestamp) || null;
};

const calculateTotalCumulativeMonthly = (sales: any[], staff: any, rule: MonthlyRule | null) => {
    if (!rule) return 0;
    const totalService = sales.reduce((sum, s) => sum + (s.serviceSale || 0), 0);
    const totalProduct = sales.reduce((sum, s) => sum + (s.productSale || 0), 0);
    const target = (staff.salary || 0) * rule.target.multiplier;
    const achieved = (rule.sales.includeServiceSale ? totalService : 0) + (rule.sales.includeProductSale ? totalProduct : 0);
    const base = rule.incentive.applyOn === 'serviceSaleOnly' ? totalService : achieved;
    return calculateIncentive(achieved, target, rule.incentive.rate, rule.incentive.doubleRate, base).incentive;
};


export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.tenantId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const staffId = session.user.id;
    const tenantId = session.user.tenantId;

    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const dateQuery = searchParams.get('date');

        if (!dateQuery) {
            return NextResponse.json({ success: false, error: 'A date is required.' }, { status: 400 });
        }

        const targetDate = new Date(dateQuery);
        const monthStart = startOfMonth(targetDate);
        const monthEnd = endOfMonth(targetDate);

        const [staff, allSalesInMonth, allRules] = await Promise.all([
            Staff.findOne({ _id: staffId, tenantId: tenantId }).lean(),
            DailySale.find({ staff: staffId, tenantId: tenantId, date: { $gte: monthStart, $lte: monthEnd } }).sort({ date: 'asc' }).lean(),
            (async () => {
                const rules = await IncentiveRule.find({ tenantId }).sort({ createdAt: -1 }).lean();
                return {
                    daily: rules.filter(r => r.type === 'daily'),
                    monthly: rules.filter(r => r.type === 'monthly'),
                    package: rules.filter(r => r.type === 'package'),
                    giftCard: rules.filter(r => r.type === 'giftCard'),
                };
            })(),
        ]);

        if (!staff || !staff.salary) {
            return NextResponse.json({ success: false, error: 'Cannot calculate: Your salary is not set.' }, { status: 400 });
        }

        let totalEarned = 0;

        for (let i = 0; i < allSalesInMonth.length; i++) {
            const saleForThisDay = allSalesInMonth[i];
            const d = new Date(saleForThisDay.date);
            const historicalTimestamp = new Date(saleForThisDay.createdAt || saleForThisDay.date);

            const dailyRule = findHistoricalRule(allRules.daily, historicalTimestamp) as DailyRule | null;
            const monthlyRule = findHistoricalRule(allRules.monthly, historicalTimestamp) as MonthlyRule | null;
            const packageRule = findHistoricalRule(allRules.package, historicalTimestamp) as FixedTargetRule | null;
            const giftCardRule = findHistoricalRule(allRules.giftCard, historicalTimestamp) as FixedTargetRule | null;

            let dailyIncentive = 0;
            if (dailyRule) {
                const daysInMonth = getDaysInMonth(d.getFullYear(), d.getMonth());
                const target = (staff.salary * dailyRule.target.multiplier) / daysInMonth;
                const reviewBonus = (saleForThisDay.reviewsWithName * dailyRule.sales.reviewNameValue) + (saleForThisDay.reviewsWithPhoto * dailyRule.sales.reviewPhotoValue);
                const achieved = (dailyRule.sales.includeServiceSale ? (saleForThisDay.serviceSale || 0) : 0) + (dailyRule.sales.includeProductSale ? (saleForThisDay.productSale || 0) : 0) + reviewBonus;
                const base = dailyRule.incentive.applyOn === 'serviceSaleOnly' ? (saleForThisDay.serviceSale || 0) : achieved;
                dailyIncentive = calculateIncentive(achieved, target, dailyRule.incentive.rate, dailyRule.incentive.doubleRate, base).incentive;
            }

            const salesUpToToday = allSalesInMonth.slice(0, i + 1);
            const salesUpToYesterday = allSalesInMonth.slice(0, i);
            const yesterdayTimestamp = i > 0 ? new Date(allSalesInMonth[i-1].createdAt || d) : d;
            const monthlyRuleYesterday = findHistoricalRule(allRules.monthly, yesterdayTimestamp) as MonthlyRule | null;

            const cumulativeToday = calculateTotalCumulativeMonthly(salesUpToToday, staff, monthlyRule);
            const cumulativeYesterday = calculateTotalCumulativeMonthly(salesUpToYesterday, staff, monthlyRuleYesterday);
            const monthlyIncentiveDelta = cumulativeToday - cumulativeYesterday;

            let packageIncentiveToday = 0;
            if (packageRule) {
                const totalPackageSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.packageSale || 0), 0);
                const { isTargetMet, appliedRate } = calculateIncentive(totalPackageSaleMonth, packageRule.target.targetValue, packageRule.incentive.rate, packageRule.incentive.doubleRate, totalPackageSaleMonth);
                if (isTargetMet) {
                    packageIncentiveToday = (saleForThisDay?.packageSale || 0) * appliedRate;
                }
            }

            let giftCardIncentiveToday = 0;
            if (giftCardRule) {
                const totalGiftCardSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.giftCardSale || 0), 0);
                const { isTargetMet, appliedRate } = calculateIncentive(totalGiftCardSaleMonth, giftCardRule.target.targetValue, giftCardRule.incentive.rate, giftCardRule.incentive.doubleRate, totalGiftCardSaleMonth);
                if (isTargetMet) {
                    giftCardIncentiveToday = (saleForThisDay?.giftCardSale || 0) * appliedRate;
                }
            }
            
            totalEarned += dailyIncentive + monthlyIncentiveDelta + packageIncentiveToday + giftCardIncentiveToday;
        }

        return NextResponse.json({ success: true, totalEarned });

    } catch (error: any) {
        console.error("API Error fetching monthly incentive total:", error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}