// /app/api/incentives/calculation/[staffId]/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import IncentiveRule from '@/models/IncentiveRule';
import { getTenantIdOrBail } from '@/lib/tenant';

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

function calculateIncentive(achieved: number, target: number, rate: number, doubleRate: number, base: number) {
    if (achieved < target || target <= 0) return { incentive: 0, isTargetMet: false, appliedRate: 0 };
    const doubleTarget = target * 2;
    const appliedRate = achieved >= doubleTarget ? doubleRate : rate;
    return { incentive: base * appliedRate, isTargetMet: true, appliedRate };
}

function findHistoricalRule<T>(rules: T[], timestamp: Date): T | null {
    if (!rules || rules.length === 0) return null;
    return rules.find(rule => new Date((rule as any).createdAt) <= timestamp) || null;
}

// ✅ FIX: Updated function signature to safely accept 'null'.
function calculateTotalCumulativeMonthly(sales: any[], staff: any, rule: MonthlyRule | null) {
    if (!rule) return 0; // Gracefully handle cases where no rule exists.
    const totalService = sales.reduce((sum, s) => sum + s.serviceSale, 0);
    const totalProduct = sales.reduce((sum, s) => sum + s.productSale, 0);
    const target = (staff.salary || 0) * rule.target.multiplier;
    const achieved = (rule.sales.includeServiceSale ? totalService : 0) + (rule.sales.includeProductSale ? totalProduct : 0);
    const base = rule.incentive.applyOn === 'serviceSaleOnly' ? totalService : achieved;
    return calculateIncentive(achieved, target, rule.incentive.rate, rule.incentive.doubleRate, base).incentive;
}

export async function GET(request: Request, { params }: { params: { staffId: string } }) {
  try {
    await dbConnect();
    const tenantId = getTenantIdOrBail(request as any);
    if (tenantId instanceof NextResponse) return tenantId;

    const { staffId } = params;
    const { searchParams } = new URL(request.url);
    const dateQuery = searchParams.get('date');

    if (!dateQuery) {
        return NextResponse.json({ message: 'Date query parameter is required.' }, { status: 400 });
    }

    const staff = await Staff.findOne({ _id: staffId, tenantId }).lean();
    if (!staff || !staff.salary || staff.salary <= 0) {
        return NextResponse.json({ message: 'Staff member not found or their salary is not set.' }, { status: 404 });
    }
    
    const [year, month, day] = dateQuery.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const allSalesInMonth = await DailySale.find({ 
        staff: staffId, 
        date: { $gte: monthStart, $lte: monthEnd }, 
        tenantId 
    }).sort({ date: 'asc' }).lean();

    const allRules = {
        daily: await IncentiveRule.find({ tenantId, type: 'daily' }).sort({ createdAt: -1 }).lean(),
        monthly: await IncentiveRule.find({ tenantId, type: 'monthly' }).sort({ createdAt: -1 }).lean(),
        package: await IncentiveRule.find({ tenantId, type: 'package' }).sort({ createdAt: -1 }).lean(),
        giftCard: await IncentiveRule.find({ tenantId, type: 'giftCard' }).sort({ createdAt: -1 }).lean(),
    };

    const saleForThisDay = allSalesInMonth.find(s => new Date(s.date).toISOString().split('T')[0] === dateQuery);
    
    const historicalTimestamp = saleForThisDay ? new Date(saleForThisDay.createdAt || saleForThisDay.date) : targetDate;
    
    const dailyRule = findHistoricalRule(allRules.daily, historicalTimestamp) as DailyRule | null;
    const monthlyRule = findHistoricalRule(allRules.monthly, historicalTimestamp) as MonthlyRule | null;
    const packageRule = findHistoricalRule(allRules.package, historicalTimestamp) as FixedTargetRule | null;
    const giftCardRule = findHistoricalRule(allRules.giftCard, historicalTimestamp) as FixedTargetRule | null;
    
    let dailyResult = null, monthlyResult = null, packageResult = null, giftCardResult = null;
    
    if (dailyRule && saleForThisDay) {
        const daysInMonth = getDaysInMonth(targetDate.getUTCFullYear(), targetDate.getUTCMonth());
        const dailyTarget = (staff.salary * dailyRule.target.multiplier) / daysInMonth;
        
        // ✅ FIX: Defined 'reviewNameBonus' and 'reviewPhotoBonus' separately.
        const reviewNameBonus = (saleForThisDay.reviewsWithName * dailyRule.sales.reviewNameValue);
        const reviewPhotoBonus = (saleForThisDay.reviewsWithPhoto * dailyRule.sales.reviewPhotoValue);
        const achieved = (dailyRule.sales.includeServiceSale ? saleForThisDay.serviceSale : 0) + (dailyRule.sales.includeProductSale ? saleForThisDay.productSale : 0) + reviewNameBonus + reviewPhotoBonus;
        
        const base = dailyRule.incentive.applyOn === 'serviceSaleOnly' ? saleForThisDay.serviceSale : achieved;
        const { incentive, isTargetMet, appliedRate } = calculateIncentive(achieved, dailyTarget, dailyRule.incentive.rate, dailyRule.incentive.doubleRate, base);
        dailyResult = { 
            targetValue: dailyTarget, totalSaleValue: achieved, incentiveAmount: incentive, 
            isTargetMet, appliedRate, ruleUsed: 'Recorded',
            details: { 
                serviceSale: saleForThisDay.serviceSale, 
                productSale: saleForThisDay.productSale, 
                packageSale: saleForThisDay.packageSale, 
                giftCardSale: saleForThisDay.giftCardSale, 
                reviewNameBonus: reviewNameBonus, // Correctly assigned
                reviewPhotoBonus: reviewPhotoBonus // Correctly assigned
            }
        };
    }

    const yesterday = new Date(targetDate);
    yesterday.setDate(targetDate.getDate() - 1);
    const salesUpToToday = allSalesInMonth.filter(s => new Date(s.date) <= targetDate);
    const salesUpToYesterday = allSalesInMonth.filter(s => new Date(s.date) <= yesterday);
    const yesterdayTimestamp = salesUpToYesterday.length > 0 ? new Date(salesUpToYesterday[salesUpToYesterday.length - 1].createdAt || yesterday) : yesterday;
    const monthlyRuleYesterday = findHistoricalRule(allRules.monthly, yesterdayTimestamp) as MonthlyRule | null;
    
    const cumulativeMonthlyToday = calculateTotalCumulativeMonthly(salesUpToToday, staff, monthlyRule);
    const cumulativeMonthlyYesterday = calculateTotalCumulativeMonthly(salesUpToYesterday, staff, monthlyRuleYesterday);
    const monthlyIncentiveDelta = cumulativeMonthlyToday - cumulativeMonthlyYesterday;

    if(monthlyRule) {
        monthlyResult = {
            targetValue: staff.salary * monthlyRule.target.multiplier,
            totalSaleValue: salesUpToToday.reduce((sum, sale) => sum + (sale.serviceSale || 0), 0),
            incentiveAmount: monthlyIncentiveDelta,
            isTargetMet: cumulativeMonthlyToday > 0,
            appliedRate: 0
        };
    }

    const salesToday = saleForThisDay || { packageSale: 0, giftCardSale: 0 };

    if(packageRule) {
        const totalPackageSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.packageSale || 0), 0);
        const { isTargetMet, appliedRate } = calculateIncentive(totalPackageSaleMonth, packageRule.target.targetValue, packageRule.incentive.rate, packageRule.incentive.doubleRate, totalPackageSaleMonth);
        
        const packageIncentiveToday = isTargetMet ? (salesToday.packageSale * appliedRate) : 0;

        packageResult = {
            targetValue: packageRule.target.targetValue,
            totalSaleValue: totalPackageSaleMonth,
            incentiveAmount: packageIncentiveToday,
            isTargetMet,
            appliedRate
        };
    }
    
    if(giftCardRule) {
        const totalGiftCardSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.giftCardSale || 0), 0);
        const { isTargetMet, appliedRate } = calculateIncentive(totalGiftCardSaleMonth, giftCardRule.target.targetValue, giftCardRule.incentive.rate, giftCardRule.incentive.doubleRate, totalGiftCardSaleMonth);

        const giftCardIncentiveToday = isTargetMet ? (salesToday.giftCardSale * appliedRate) : 0;

        giftCardResult = {
            targetValue: giftCardRule.target.targetValue,
            totalSaleValue: totalGiftCardSaleMonth,
            incentiveAmount: giftCardIncentiveToday,
            isTargetMet,
            appliedRate
        };
    }

    return NextResponse.json({
        staffName: staff.name,
        calculationDate: targetDate.toISOString().split('T')[0],
        incentive1_daily: dailyResult,
        incentive2_monthly: monthlyResult,
        incentive3_package: packageResult,
        incentive4_giftCard: giftCardResult,
    });

  } catch (error: any) {
    console.error("--- FATAL ERROR in /api/incentives/calculation/[staffId] ---", error);
    return NextResponse.json({ message: 'An internal server error occurred.', error: error.message }, { status: 500 });
  }
}