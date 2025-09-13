import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Staff from '@/models/staff';
import DailySale from '@/models/DailySale';
import IncentiveRule from '@/models/IncentiveRule';
import { startOfMonth } from 'date-fns';

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

        const staff = await Staff.findOne({ _id: staffId, tenantId: tenantId }).lean();
        if (!staff || !staff.salary) {
            return NextResponse.json({ success: false, error: 'Cannot calculate: Your salary is not set.' }, { status: 400 });
        }

        const targetDate = new Date(dateQuery);
        const monthStart = startOfMonth(targetDate);

        const [allSalesInMonth, allRules] = await Promise.all([
             DailySale.find({ staff: staffId, tenantId: tenantId, date: { $gte: monthStart, $lte: targetDate } }).sort({ date: 'asc' }).lean(),
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

        const saleForThisDay = allSalesInMonth.find(s => new Date(s.date).toISOString().split('T')[0] === dateQuery);
        
        const historicalTimestamp = saleForThisDay ? new Date(saleForThisDay.createdAt || saleForThisDay.date) : targetDate;

        const dailyRule = findHistoricalRule(allRules.daily, historicalTimestamp) as DailyRule | null;
        const monthlyRule = findHistoricalRule(allRules.monthly, historicalTimestamp) as MonthlyRule | null;
        const packageRule = findHistoricalRule(allRules.package, historicalTimestamp) as FixedTargetRule | null;
        const giftCardRule = findHistoricalRule(allRules.giftCard, historicalTimestamp) as FixedTargetRule | null;
        
        let dailyResult = {}, monthlyResult = {}, packageResult = {}, giftCardResult = {};

        if (dailyRule && saleForThisDay) {
            const daysInMonth = getDaysInMonth(targetDate.getUTCFullYear(), targetDate.getUTCMonth());
            const target = (staff.salary * dailyRule.target.multiplier) / daysInMonth;
            const reviewBonus = (saleForThisDay.reviewsWithName * dailyRule.sales.reviewNameValue) + (saleForThisDay.reviewsWithPhoto * dailyRule.sales.reviewPhotoValue);
            const achieved = (dailyRule.sales.includeServiceSale ? (saleForThisDay.serviceSale || 0) : 0) + (dailyRule.sales.includeProductSale ? (saleForThisDay.productSale || 0) : 0) + reviewBonus;
            const base = dailyRule.incentive.applyOn === 'serviceSaleOnly' ? (saleForThisDay.serviceSale || 0) : achieved;
            const { incentive, isTargetMet, appliedRate } = calculateIncentive(achieved, target, dailyRule.incentive.rate, dailyRule.incentive.doubleRate, base);
            dailyResult = { target, achieved, isTargetMet, incentiveAmount: incentive, appliedRate };
        }

        const salesUpToToday = allSalesInMonth;
        const salesUpToYesterday = allSalesInMonth.filter(s => new Date(s.date) < targetDate);

        if (monthlyRule) {
            const yesterdayTimestamp = salesUpToYesterday.length > 0 ? new Date(salesUpToYesterday[salesUpToYesterday.length - 1].createdAt || targetDate) : targetDate;
            const monthlyRuleYesterday = findHistoricalRule(allRules.monthly, yesterdayTimestamp) as MonthlyRule | null;
            const cumulativeToday = calculateTotalCumulativeMonthly(salesUpToToday, staff, monthlyRule);
            const cumulativeYesterday = calculateTotalCumulativeMonthly(salesUpToYesterday, staff, monthlyRuleYesterday);
            const monthlyIncentiveDelta = cumulativeToday - cumulativeYesterday;
            const achieved = salesUpToToday.reduce((sum, s) => sum + (s.serviceSale || 0) + (s.productSale || 0), 0);

            monthlyResult = { target: staff.salary * monthlyRule.target.multiplier, achieved, isTargetMet: cumulativeToday > 0, incentiveAmount: monthlyIncentiveDelta, appliedRate: 0 };
        }

        if (packageRule) {
            const totalPackageSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.packageSale || 0), 0);
            const { isTargetMet, appliedRate } = calculateIncentive(totalPackageSaleMonth, packageRule.target.targetValue, packageRule.incentive.rate, packageRule.incentive.doubleRate, totalPackageSaleMonth);
            const packageIncentiveToday = isTargetMet ? ((saleForThisDay?.packageSale || 0) * appliedRate) : 0;
            // ✅ FIX: Added `todaySale` field to the response object.
            packageResult = { 
                target: packageRule.target.targetValue, 
                achieved: totalPackageSaleMonth, 
                isTargetMet, 
                incentiveAmount: packageIncentiveToday, 
                appliedRate,
                todaySale: saleForThisDay?.packageSale || 0
            };
        }

        if (giftCardRule) {
            const totalGiftCardSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.giftCardSale || 0), 0);
            const { isTargetMet, appliedRate } = calculateIncentive(totalGiftCardSaleMonth, giftCardRule.target.targetValue, giftCardRule.incentive.rate, giftCardRule.incentive.doubleRate, totalGiftCardSaleMonth);
            const giftCardIncentiveToday = isTargetMet ? ((saleForThisDay?.giftCardSale || 0) * appliedRate) : 0;
            // ✅ FIX: Added `todaySale` field to the response object.
            giftCardResult = { 
                target: giftCardRule.target.targetValue, 
                achieved: totalGiftCardSaleMonth, 
                isTargetMet, 
                incentiveAmount: giftCardIncentiveToday, 
                appliedRate,
                todaySale: saleForThisDay?.giftCardSale || 0
            };
        }

        return NextResponse.json({ success: true, data: { daily: dailyResult, monthly: monthlyResult, package: packageResult, giftcard: giftCardResult } });

    } catch (error: any) {
        console.error("API Error fetching staff incentives:", error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}