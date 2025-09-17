import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import IncentiveRule from '@/models/IncentiveRule';
import Invoice from '@/models/invoice'; 
import { getTenantIdOrBail } from '@/lib/tenant';

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

// ✨ --- FIX: This function is now discount-aware --- ✨
// It uses a pre-calculated discount map to get the correct net sales.
function calculateTotalCumulativeMonthly(sales: any[], staff: any, rule: MonthlyRule | null, discountMap: Map<string, number>) {
    if (!rule) return 0;

    let totalNetService = 0;
    let totalProduct = 0;

    for (const sale of sales) {
        const dateString = new Date(sale.date).toISOString().split('T')[0];
        const discountForDay = discountMap.get(dateString) || 0;
        totalNetService += (sale.serviceSale || 0) - discountForDay;
        totalProduct += (sale.productSale || 0);
    }

    const target = (staff.salary || 0) * rule.target.multiplier;
    const achieved = (rule.sales.includeServiceSale ? totalNetService : 0) + (rule.sales.includeProductSale ? totalProduct : 0);
    const base = rule.incentive.applyOn === 'serviceSaleOnly' ? totalNetService : achieved;
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
    const targetDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)); // Use end of day for inclusivity
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const allSalesInMonth = await DailySale.find({ staff: staffId, date: { $gte: monthStart, $lte: monthEnd }, tenantId }).sort({ date: 'asc' }).lean();

    // ✨ --- FIX: Calculate all service discounts for the month once and efficiently --- ✨
    const allInvoicesForMonth = await Invoice.find({
        tenantId: tenantId,
        "lineItems.staffId": staffId,
        createdAt: { $gte: monthStart, $lte: monthEnd }
    }).lean();

    const discountMap = new Map<string, number>();
    for (const invoice of allInvoicesForMonth) {
        const invoiceDate = new Date(invoice.createdAt).toISOString().split('T')[0];
        const manualDiscountAmount = invoice.manualDiscount?.appliedAmount || 0;
        if (manualDiscountAmount <= 0) continue;

        let totalServiceValueOnInvoice = 0;
        let staffServiceValueOnInvoice = 0;

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
            const currentDiscount = discountMap.get(invoiceDate) || 0;
            discountMap.set(invoiceDate, currentDiscount + staffShareOfDiscount);
        }
    }

    const allRules = {
        daily: await IncentiveRule.find({ tenantId, type: 'daily' }).sort({ createdAt: -1 }).lean() as unknown as DailyRule[],
        monthly: await IncentiveRule.find({ tenantId, type: 'monthly' }).sort({ createdAt: -1 }).lean() as unknown as MonthlyRule[],
        package: await IncentiveRule.find({ tenantId, type: 'package' }).sort({ createdAt: -1 }).lean() as unknown as FixedTargetRule[],
        giftCard: await IncentiveRule.find({ tenantId, type: 'giftCard' }).sort({ createdAt: -1 }).lean() as unknown as FixedTargetRule[],
    };

    const saleForThisDay = allSalesInMonth.find(s => new Date(s.date).toISOString().split('T')[0] === dateQuery);
    const historicalTimestamp = saleForThisDay ? new Date(saleForThisDay.createdAt || saleForThisDay.date) : targetDate;
    
    const dailyRule = findHistoricalRule(allRules.daily, historicalTimestamp);
    const monthlyRule = findHistoricalRule(allRules.monthly, historicalTimestamp);
    
    let dailyResult = null;
    
    if (dailyRule && saleForThisDay) {
        // ✨ --- FIX: Use the pre-calculated discount map for consistency and performance --- ✨
        const dateString = new Date(saleForThisDay.date).toISOString().split('T')[0];
        const discountForDay = discountMap.get(dateString) || 0;
        const netServiceSaleForCalculation = (saleForThisDay.serviceSale || 0) - discountForDay;

        const daysInMonth = getDaysInMonth(targetDate.getUTCFullYear(), targetDate.getUTCMonth());
        const dailyTarget = (staff.salary * dailyRule.target.multiplier) / daysInMonth;
        const reviewNameBonus = (saleForThisDay.reviewsWithName || 0) * (dailyRule.sales.reviewNameValue || 0);
        const reviewPhotoBonus = (saleForThisDay.reviewsWithPhoto || 0) * (dailyRule.sales.reviewPhotoValue || 0);

        const achieved = (dailyRule.sales.includeServiceSale ? netServiceSaleForCalculation : 0) 
                       + (dailyRule.sales.includeProductSale ? (saleForThisDay.productSale || 0) : 0) 
                       + (dailyRule.sales.includePackageSale ? (saleForThisDay.packageSale || 0) : 0)
                       + (dailyRule.sales.includeGiftCardSale ? (saleForThisDay.giftCardSale || 0) : 0)
                       + reviewNameBonus 
                       + reviewPhotoBonus;
        
        const base = dailyRule.incentive.applyOn === 'serviceSaleOnly' ? netServiceSaleForCalculation : achieved;
        const { incentive, isTargetMet, appliedRate } = calculateIncentive(achieved, dailyTarget, dailyRule.incentive.rate, dailyRule.incentive.doubleRate, base);
        
        dailyResult = { 
            targetValue: dailyTarget, 
            totalSaleValue: achieved, 
            incentiveAmount: incentive, 
            isTargetMet, 
            appliedRate, 
            ruleUsed: 'Recorded',
            details: { 
                serviceSale: netServiceSaleForCalculation,
                productSale: saleForThisDay.productSale || 0,
                packageSale: saleForThisDay.packageSale || 0,
                giftCardSale: saleForThisDay.giftCardSale || 0,
                reviewNameBonus: reviewNameBonus,
                reviewPhotoBonus: reviewPhotoBonus
            }
        };
    }

    const salesUpToToday = allSalesInMonth.filter(s => new Date(s.date) <= targetDate);
    const yesterday = new Date(targetDate);
    yesterday.setDate(targetDate.getDate() - 1);
    const salesUpToYesterday = allSalesInMonth.filter(s => new Date(s.date) <= yesterday);
    const yesterdayTimestamp = salesUpToYesterday.length > 0 ? new Date(salesUpToYesterday[salesUpToYesterday.length - 1].createdAt || yesterday) : yesterday;
    const monthlyRuleYesterday = findHistoricalRule(allRules.monthly, yesterdayTimestamp);

    // ✨ --- FIX: All monthly calculations now use the discount map --- ✨
    const cumulativeMonthlyToday = calculateTotalCumulativeMonthly(salesUpToToday, staff, monthlyRule, discountMap);
    const cumulativeMonthlyYesterday = calculateTotalCumulativeMonthly(salesUpToYesterday, staff, monthlyRuleYesterday, discountMap);
    const monthlyIncentiveDelta = cumulativeMonthlyToday - cumulativeMonthlyYesterday;
    
    let monthlyResult = null;
    if(monthlyRule) {
        let totalMonthlyDisplayValue = 0;
        if (monthlyRule.sales.includeServiceSale) {
            totalMonthlyDisplayValue += salesUpToToday.reduce((sum, s) => {
                const dateString = new Date(s.date).toISOString().split('T')[0];
                const discountForDay = discountMap.get(dateString) || 0;
                return sum + (s.serviceSale || 0) - discountForDay;
            }, 0);
        }
        if (monthlyRule.sales.includeProductSale) {
            totalMonthlyDisplayValue += salesUpToToday.reduce((sum, s) => sum + (s.productSale || 0), 0);
        }

        monthlyResult = {
            targetValue: staff.salary * monthlyRule.target.multiplier,
            totalSaleValue: totalMonthlyDisplayValue,
            incentiveAmount: monthlyIncentiveDelta,
            isTargetMet: cumulativeMonthlyToday > 0,
            appliedRate: 0
        };
    }

    // --- (Package and Gift Card logic is unchanged and remains correct) ---
    const packageRule = findHistoricalRule(allRules.package, historicalTimestamp);
    const giftCardRule = findHistoricalRule(allRules.giftCard, historicalTimestamp);
    let packageResult = null, giftCardResult = null;
    const salesToday = saleForThisDay || { packageSale: 0, giftCardSale: 0 };
    if(packageRule) {
        const totalPackageSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.packageSale || 0), 0);
        const { isTargetMet, appliedRate } = calculateIncentive(totalPackageSaleMonth, packageRule.target.targetValue, packageRule.incentive.rate, packageRule.incentive.doubleRate, totalPackageSaleMonth);
        const packageIncentiveToday = isTargetMet ? ((salesToday.packageSale || 0) * appliedRate) : 0;
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
        const giftCardIncentiveToday = isTargetMet ? ((salesToday.giftCardSale || 0) * appliedRate) : 0;
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
