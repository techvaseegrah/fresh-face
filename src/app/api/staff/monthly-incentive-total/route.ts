// /app/api/staff/monthly-incentive-total/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Staff from '@/models/staff';
import DailySale from '@/models/DailySale';
import IncentiveRule from '@/models/IncentiveRule';
import Invoice from '@/models/invoice'; // ✅ Import the Invoice model
import { startOfMonth } from 'date-fns';

// --- TYPE DEFINITIONS ---
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
    const sortedRules = rules.sort((a, b) => new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime());
    return sortedRules.find(rule => new Date((rule as any).createdAt) <= timestamp) || null;
};
const calculateTotalCumulativeMonthly = (sales: any[], staff: any, rule: MonthlyRule | null) => {
    if (!rule || !staff.salary) return 0;
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
        const monthEnd = new Date(dateQuery); // Use selected date as end for "up to today" calculation
        monthEnd.setHours(23, 59, 59, 999);

        // ✅ FIX: Fetch all necessary data upfront, including invoices
        const [staff, grossSalesInMonth, allRules, allInvoicesInRange] = await Promise.all([
            Staff.findOne({ _id: staffId, tenantId: tenantId }).lean(),
            DailySale.find({ staff: staffId, tenantId: tenantId, date: { $gte: monthStart, $lte: monthEnd } }).sort({ date: 'asc' }).lean(),
            (async () => {
                const rules = await IncentiveRule.find({ tenantId }).sort({ createdAt: -1 }).lean();
                return { daily: rules.filter(r => r.type === 'daily'), monthly: rules.filter(r => r.type === 'monthly'), package: rules.filter(r => r.type === 'package'), giftCard: rules.filter(r => r.type === 'giftCard') };
            })(),
            Invoice.find({ tenantId: tenantId, createdAt: { $gte: monthStart, $lte: monthEnd }, 'manualDiscount.appliedAmount': { $gt: 0 } }).lean()
        ]);

        if (!staff || !staff.salary) {
            return NextResponse.json({ success: false, error: 'Cannot calculate: Your salary is not set.' }, { status: 400 });
        }
        
        // ✅ FIX: Create a single source of truth for NET sales data FIRST.
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
                        if (item.staffId?.toString() === staffId) { staffServiceValueOnInvoice += item.finalPrice; }
                    }
                }
                if (totalServiceValueOnInvoice > 0 && staffServiceValueOnInvoice > 0) {
                    const staffShareOfDiscount = (manualDiscountAmount * staffServiceValueOnInvoice) / totalServiceValueOnInvoice;
                    netServiceSale -= staffShareOfDiscount;
                }
            }
            return { ...sale, serviceSale: netServiceSale };
        });

        let totalEarned = 0;
        // ✅ FIX: Loop through the corrected net sales data
        for (let i = 0; i < netSalesInMonth.length; i++) {
            const saleForThisDay = netSalesInMonth[i];
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
                const reviewBonus = (saleForThisDay.reviewsWithName * (dailyRule.sales.reviewNameValue || 0)) + (saleForThisDay.reviewsWithPhoto * (dailyRule.sales.reviewPhotoValue || 0));
                const achieved = (dailyRule.sales.includeServiceSale ? saleForThisDay.serviceSale : 0) 
                               + (dailyRule.sales.includeProductSale ? (saleForThisDay.productSale || 0) : 0)
                               + (dailyRule.sales.includePackageSale ? (saleForThisDay.packageSale || 0) : 0)
                               + (dailyRule.sales.includeGiftCardSale ? (saleForThisDay.giftCardSale || 0) : 0)
                               + reviewBonus;
                const base = dailyRule.incentive.applyOn === 'serviceSaleOnly' ? saleForThisDay.serviceSale : achieved;
                dailyIncentive = calculateIncentive(achieved, target, dailyRule.incentive.rate, dailyRule.incentive.doubleRate, base).incentive;
            }
            
            // ✅ FIX: Use the corrected net sales data for monthly calculation as well
            const salesUpToToday = netSalesInMonth.slice(0, i + 1);
            const salesUpToYesterday = netSalesInMonth.slice(0, i);
            const yesterdayTimestamp = i > 0 ? new Date(salesUpToYesterday[i - 1].createdAt || d) : d;
            const monthlyRuleYesterday = findHistoricalRule(allRules.monthly, yesterdayTimestamp) as MonthlyRule | null;
            const cumulativeToday = calculateTotalCumulativeMonthly(salesUpToToday, staff, monthlyRule);
            const cumulativeYesterday = calculateTotalCumulativeMonthly(salesUpToYesterday, staff, monthlyRuleYesterday);
            const monthlyIncentiveDelta = cumulativeToday - cumulativeYesterday;

            let packageIncentiveToday = 0;
            if (packageRule) {
                const totalPackageSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.packageSale || 0), 0);
                const { isTargetMet, appliedRate } = calculateIncentive(totalPackageSaleMonth, packageRule.target.targetValue, packageRule.incentive.rate, packageRule.incentive.doubleRate, totalPackageSaleMonth);
                if (isTargetMet) { packageIncentiveToday = (saleForThisDay.packageSale || 0) * appliedRate; }
            }

            let giftCardIncentiveToday = 0;
            if (giftCardRule) {
                const totalGiftCardSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.giftCardSale || 0), 0);
                const { isTargetMet, appliedRate } = calculateIncentive(totalGiftCardSaleMonth, giftCardRule.target.targetValue, giftCardRule.incentive.rate, giftCardRule.incentive.doubleRate, totalGiftCardSaleMonth);
                if (isTargetMet) { giftCardIncentiveToday = (saleForThisDay.giftCardSale || 0) * appliedRate; }
            }

            totalEarned += dailyIncentive + monthlyIncentiveDelta + packageIncentiveToday + giftCardIncentiveToday;
        }

        return NextResponse.json({ success: true, totalEarned: parseFloat(totalEarned.toFixed(2)) });

    } catch (error: any) {
        console.error("API Error fetching monthly incentive total:", error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}