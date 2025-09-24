import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Staff from '@/models/staff';
import DailySale from '@/models/DailySale';
import IncentiveRule from '@/models/IncentiveRule';
import Invoice from '@/models/invoice';
import { startOfMonth } from 'date-fns';

// --- TYPE DEFINITIONS (Unchanged) ---
type DailyRule = {
  target: { multiplier: number };
  sales: { 
    includeServiceSale: boolean; 
    includeProductSale: boolean; 
    includePackageSale?: boolean;
    includeGiftCardSale?: boolean;
    reviewNameValue: number; 
    reviewPhotoValue: number; 
  };
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

// --- HELPER FUNCTIONS (Unchanged) ---
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const calculateIncentive = (achieved: number, target: number, rate: number, doubleRate: number, base: number) => {
    if (achieved < target || target <= 0) return { incentive: 0, isTargetMet: false, appliedRate: 0 };
    const doubleTarget = target * 2;
    const appliedRate = achieved >= doubleTarget ? doubleRate : rate;
    return { incentive: base * appliedRate, isTargetMet: true, appliedRate };
};
const findHistoricalRule = <T>(rules: T[], timestamp: Date): T | null => {
    if (!rules || rules.length === 0) return null;
    const sortedRules = rules.sort((a, b) => new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime());
    return sortedRules.find(rule => new Date((rule as any).createdAt) <= timestamp) || null;
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
        targetDate.setHours(23, 59, 59, 999);

        const [grossSalesInMonth, allRules, allInvoicesInRange] = await Promise.all([
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
            Invoice.find({ tenantId: tenantId, createdAt: { $gte: monthStart, $lte: targetDate }, 'manualDiscount.appliedAmount': { $gt: 0 } }).lean()
        ]);
        
        const netSalesInMonth = grossSalesInMonth.map(sale => {
            let netServiceSale = sale.serviceSale || 0;
            const saleDateString = new Date(sale.date).toISOString().split('T')[0];
            const invoicesForDay = allInvoicesInRange.filter(inv => new Date(inv.createdAt).toISOString().split('T')[0] === saleDateString);

            for (const invoice of invoicesForDay) {
                const manualDiscountAmount = invoice.manualDiscount?.appliedAmount || 0;
                let totalServiceValueOnInvoice = 0, staffServiceValueOnInvoice = 0;

                for (const item of (invoice.lineItems || [])) {
                    if (item.itemType === 'service') {
                        totalServiceValueOnInvoice += item.finalPrice;
                        if (item.staffId?.toString() === staffId) {
                            staffServiceValueOnInvoice += item.finalPrice;
                        }
                    }
                }
                if (totalServiceValueOnInvoice > 0 && staffServiceValueOnInvoice > 0) {
                     const staffShareOfDiscount = (manualDiscountAmount * staffServiceValueOnInvoice) / totalServiceValueOnInvoice;
                     netServiceSale -= staffShareOfDiscount;
                }
            }
            return { ...sale, serviceSale: netServiceSale };
        });

        const saleForThisDay = netSalesInMonth.find(s => new Date(s.date).toISOString().split('T')[0] === dateQuery);
        
        const historicalTimestamp = saleForThisDay ? new Date(saleForThisDay.createdAt || saleForThisDay.date) : new Date(dateQuery);

        const dailyRule = findHistoricalRule(allRules.daily, historicalTimestamp) as DailyRule | null;
        const monthlyRule = findHistoricalRule(allRules.monthly, historicalTimestamp) as MonthlyRule | null;
        const packageRule = findHistoricalRule(allRules.package, historicalTimestamp) as FixedTargetRule | null;
        const giftCardRule = findHistoricalRule(allRules.giftCard, historicalTimestamp) as FixedTargetRule | null;
        
        let dailyResult = {}, monthlyResult = {}, packageResult = {}, giftCardResult = {};

        if (dailyRule && saleForThisDay) {
            const daysInMonth = getDaysInMonth(targetDate.getUTCFullYear(), targetDate.getUTCMonth());
            const target = (staff.salary * dailyRule.target.multiplier) / daysInMonth;
            const reviewBonus = (saleForThisDay.reviewsWithName * (dailyRule.sales.reviewNameValue || 0)) + (saleForThisDay.reviewsWithPhoto * (dailyRule.sales.reviewPhotoValue || 0));
            const achieved = (dailyRule.sales.includeServiceSale ? saleForThisDay.serviceSale : 0) 
                           + (dailyRule.sales.includeProductSale ? (saleForThisDay.productSale || 0) : 0)
                           + (dailyRule.sales.includePackageSale ? (saleForThisDay.packageSale || 0) : 0)
                           + (dailyRule.sales.includeGiftCardSale ? (saleForThisDay.giftCardSale || 0) : 0)
                           + reviewBonus;
            const base = dailyRule.incentive.applyOn === 'serviceSaleOnly' ? saleForThisDay.serviceSale : achieved;
            const { incentive, isTargetMet, appliedRate } = calculateIncentive(achieved, target, dailyRule.incentive.rate, dailyRule.incentive.doubleRate, base);
            dailyResult = { target, achieved, isTargetMet, incentiveAmount: incentive, appliedRate };
        }

        const salesUpToToday = netSalesInMonth.filter(s => new Date(s.date) <= new Date(dateQuery));
        const salesUpToYesterday = netSalesInMonth.filter(s => new Date(s.date) < new Date(dateQuery));
        
        if (monthlyRule) {
            const yesterdayTimestamp = salesUpToYesterday.length > 0 ? new Date(salesUpToYesterday[salesUpToYesterday.length - 1].createdAt || new Date(dateQuery)) : new Date(dateQuery);
            const monthlyRuleYesterday = findHistoricalRule(allRules.monthly, yesterdayTimestamp) as MonthlyRule | null;
            const cumulativeToday = calculateTotalCumulativeMonthly(salesUpToToday, staff, monthlyRule);
            const cumulativeYesterday = calculateTotalCumulativeMonthly(salesUpToYesterday, staff, monthlyRuleYesterday);
            const monthlyIncentiveDelta = cumulativeToday - cumulativeYesterday;

            const totalServiceForMonth = salesUpToToday.reduce((sum, s) => sum + (s.serviceSale || 0), 0);
            const totalProductForMonth = salesUpToToday.reduce((sum, s) => sum + (s.productSale || 0), 0);
            const achieved = (monthlyRule.sales.includeServiceSale ? totalServiceForMonth : 0) + (monthlyRule.sales.includeProductSale ? totalProductForMonth : 0);
            
            const { appliedRate } = calculateIncentive(achieved, (staff.salary * monthlyRule.target.multiplier), monthlyRule.incentive.rate, monthlyRule.incentive.doubleRate, achieved);

            monthlyResult = { target: staff.salary * monthlyRule.target.multiplier, achieved, isTargetMet: cumulativeToday > 0, incentiveAmount: monthlyIncentiveDelta, appliedRate };
        }

        if (packageRule) {
            const totalPackageSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.packageSale || 0), 0);
            const { isTargetMet, appliedRate } = calculateIncentive(totalPackageSaleMonth, packageRule.target.targetValue, packageRule.incentive.rate, packageRule.incentive.doubleRate, totalPackageSaleMonth);
            const packageIncentiveToday = isTargetMet ? ((saleForThisDay?.packageSale || 0) * appliedRate) : 0;
            packageResult = { target: packageRule.target.targetValue, achieved: totalPackageSaleMonth, isTargetMet, incentiveAmount: packageIncentiveToday, appliedRate, todaySale: saleForThisDay?.packageSale || 0 };
        }

        if (giftCardRule) {
            const totalGiftCardSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.giftCardSale || 0), 0);
            const { isTargetMet, appliedRate } = calculateIncentive(totalGiftCardSaleMonth, giftCardRule.target.targetValue, giftCardRule.incentive.rate, giftCardRule.incentive.doubleRate, totalGiftCardSaleMonth);
            const giftCardIncentiveToday = isTargetMet ? ((saleForThisDay?.giftCardSale || 0) * appliedRate) : 0;
            
            // ✨ --- THIS IS THE FIX for the typo --- ✨
            // Changed `.value` to `.targetValue` to match the type definition.
            giftCardResult = { target: giftCardRule.target.targetValue, achieved: totalGiftCardSaleMonth, isTargetMet, incentiveAmount: giftCardIncentiveToday, appliedRate, todaySale: saleForThisDay?.giftCardSale || 0 };
        }

        return NextResponse.json({ success: true, data: { daily: dailyResult, monthly: monthlyResult, package: packageResult, giftcard: giftCardResult } });

    } catch (error: any) {
        console.error("API Error fetching staff incentives:", error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}