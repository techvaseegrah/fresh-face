import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import { getTenantIdOrBail } from '@/lib/tenant';
import IncentiveRule from '@/models/IncentiveRule';
import Invoice from '@/models/invoice'; // Import the Invoice model

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
function calculateTotalCumulativeMonthly(sales: any[], staff: any, rule: MonthlyRule | null) {
    if (!rule) return 0;
    const totalService = sales.reduce((sum, s) => sum + s.serviceSale, 0);
    const totalProduct = sales.reduce((sum, s) => sum + s.productSale, 0);
    const target = (staff.salary || 0) * rule.target.multiplier;
    const achieved = (rule.sales.includeServiceSale ? totalService : 0) + (rule.sales.includeProductSale ? totalProduct : 0);
    const base = rule.incentive.applyOn === 'serviceSaleOnly' ? totalService : achieved;
    return calculateIncentive(achieved, target, rule.incentive.rate, rule.incentive.doubleRate, base).incentive;
}


export async function GET(request: Request) {
    try {
        await dbConnect();
        const tenantId = getTenantIdOrBail(request as any);
        if (tenantId instanceof NextResponse) return tenantId;

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!startDate || !endDate) return NextResponse.json({ message: 'Start and End dates are required.' }, { status: 400 });
        
        const start = new Date(startDate);
        const end = new Date(endDate);

        const allStaff = await Staff.find({ tenantId, salary: { $exists: true, $gt: 0 } }).lean();
        const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
        const allSalesInMonth = await DailySale.find({ tenantId, date: { $gte: monthStart, $lte: end } }).lean();
        
        // Fetch all invoices for the requested date range to avoid querying inside the loop
        const allInvoicesInRange = await Invoice.find({ tenantId, createdAt: { $gte: start, $lte: end } }).lean();
        
        const allRules = {
            daily: await IncentiveRule.find({ tenantId, type: 'daily' }).sort({ createdAt: -1 }).lean(),
            monthly: await IncentiveRule.find({ tenantId, type: 'monthly' }).sort({ createdAt: -1 }).lean(),
            package: await IncentiveRule.find({ tenantId, type: 'package' }).sort({ createdAt: -1 }).lean(),
            giftCard: await IncentiveRule.find({ tenantId, type: 'giftCard' }).sort({ createdAt: -1 }).lean(),
        };
        
        const summaryData: { [staffId: string]: { [date: string]: { incentive: number, sales: number, isTargetMet: boolean, customerCount: number } } } = {};

        for (const staff of allStaff) {
            if (!staff.salary) continue; 
            const staffId = staff._id.toString();
            summaryData[staffId] = {};
            const staffSales = allSalesInMonth.filter(s => s.staff.toString() === staffId);

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateString = d.toISOString().split('T')[0];
                const saleForThisDay = staffSales.find(s => new Date(s.date).toISOString().split('T')[0] === dateString);
                
                const historicalTimestamp = saleForThisDay ? new Date(saleForThisDay.createdAt || saleForThisDay.date) : d;
                
                const dailyRule = findHistoricalRule(allRules.daily, historicalTimestamp) as DailyRule | null;
                const monthlyRule = findHistoricalRule(allRules.monthly, historicalTimestamp) as MonthlyRule | null;
                const packageRule = findHistoricalRule(allRules.package, historicalTimestamp) as FixedTargetRule | null;
                const giftCardRule = findHistoricalRule(allRules.giftCard, historicalTimestamp) as FixedTargetRule | null;

                let dailyIncentive = 0;
                let dailyAchievedSales = 0;
                
                if (dailyRule && saleForThisDay) {
                    // ✨ --- THIS IS THE FIX --- ✨
                    // We now perform the same detailed discount calculation here as in the other API.
                    
                    let netServiceSale = saleForThisDay.serviceSale; // Start with gross
                    const allInvoicesForDay = allInvoicesInRange.filter(inv => new Date(inv.createdAt).toISOString().split('T')[0] === dateString);

                    for (const invoice of allInvoicesForDay) {
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
                             netServiceSale -= staffShareOfDiscount;
                        }
                    }

                    const daysInMonth = getDaysInMonth(d.getFullYear(), d.getMonth());
                    const target = (staff.salary * dailyRule.target.multiplier) / daysInMonth;
                    const reviewBonus = (saleForThisDay.reviewsWithName * dailyRule.sales.reviewNameValue) + (saleForThisDay.reviewsWithPhoto * dailyRule.sales.reviewPhotoValue);
                    
                    // Now, calculate 'achieved' and 'base' using the corrected 'netServiceSale'
                    const achieved = (dailyRule.sales.includeServiceSale ? netServiceSale : 0) 
                                   + (dailyRule.sales.includeProductSale ? saleForThisDay.productSale : 0) 
                                   + (dailyRule.sales.includePackageSale ? saleForThisDay.packageSale : 0)
                                   + (dailyRule.sales.includeGiftCardSale ? saleForThisDay.giftCardSale : 0)
                                   + reviewBonus;

                    const base = dailyRule.incentive.applyOn === 'serviceSaleOnly' ? netServiceSale : achieved;
                    const result = calculateIncentive(achieved, target, dailyRule.incentive.rate, dailyRule.incentive.doubleRate, base);
                    dailyIncentive = result.incentive;
                    dailyAchievedSales = achieved;
                }
                
                const yesterday = new Date(d);
                yesterday.setDate(d.getDate() - 1);
                
                const salesUpToToday = staffSales.filter(s => new Date(s.date) <= d);
                const salesUpToYesterday = staffSales.filter(s => new Date(s.date) <= yesterday);

                const yesterdayTimestamp = salesUpToYesterday.length > 0 ? new Date(salesUpToYesterday[salesUpToYesterday.length - 1].createdAt || yesterday) : yesterday;
                const monthlyRuleYesterday = findHistoricalRule(allRules.monthly, yesterdayTimestamp) as MonthlyRule | null;
                
                const totalIncentiveToday = calculateTotalCumulativeMonthly(salesUpToToday, staff, monthlyRule);
                const totalIncentiveYesterday = calculateTotalCumulativeMonthly(salesUpToYesterday, staff, monthlyRuleYesterday);
                
                const monthlyIncentiveDelta = totalIncentiveToday - totalIncentiveYesterday;
                
                let packageIncentiveToday = 0;
                let giftCardIncentiveToday = 0;
                const salesToday = saleForThisDay || { packageSale: 0, giftCardSale: 0 };

                if (packageRule) {
                    const totalPackageSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.packageSale || 0), 0);
                    const { isTargetMet, appliedRate } = calculateIncentive(totalPackageSaleMonth, packageRule.target.targetValue, packageRule.incentive.rate, packageRule.incentive.doubleRate, totalPackageSaleMonth);
                    if (isTargetMet) {
                        packageIncentiveToday = salesToday.packageSale * appliedRate;
                    }
                }
                
                if (giftCardRule) {
                    const totalGiftCardSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.giftCardSale || 0), 0);
                    const { isTargetMet, appliedRate } = calculateIncentive(totalGiftCardSaleMonth, giftCardRule.target.targetValue, giftCardRule.incentive.rate, giftCardRule.incentive.doubleRate, totalGiftCardSaleMonth);
                    if (isTargetMet) {
                        giftCardIncentiveToday = salesToday.giftCardSale * appliedRate;
                    }
                }

                const totalIncentiveForDay = dailyIncentive + monthlyIncentiveDelta + packageIncentiveToday + giftCardIncentiveToday;

                summaryData[staffId][dateString] = { 
                    incentive: totalIncentiveForDay,
                    sales: dailyAchievedSales, 
                    isTargetMet: totalIncentiveForDay > 0,
                    customerCount: saleForThisDay?.customerCount || 0 
                };
            }
        }
        
        return NextResponse.json({ success: true, data: summaryData });

    } catch (error: any) {
        console.error("API GET /api/incentives/summary Error:", error);
        return NextResponse.json({ message: 'An internal server error occurred', error: error.message }, { status: 500 });
    }
}