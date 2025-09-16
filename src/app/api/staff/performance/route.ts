import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import IncentiveRule from '@/models/IncentiveRule';
import Invoice from '@/models/invoice'; // Import the Invoice model
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
    const achieved = (rule.sales.includeServiceSale ? (totalService || 0) : 0) + (rule.sales.includeProductSale ? (totalProduct || 0) : 0);
    const base = rule.incentive.applyOn === 'serviceSaleOnly' ? totalService : achieved;
    return calculateIncentive(achieved, target, rule.incentive.rate, rule.incentive.doubleRate, base).incentive;
}


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
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        if (!startDateParam || !endDateParam) {
            return NextResponse.json({ success: false, message: 'Start and end dates are required.' }, { status: 400 });
        }

        const startDate = new Date(startDateParam);
        const endDate = new Date(endDateParam);
        endDate.setHours(23, 59, 59, 999);

        // ✅ FIX: Fetch all necessary data upfront, including invoices
        const [staff, allSalesInMonth, allRules, allInvoicesInRange] = await Promise.all([
            Staff.findOne({ _id: staffId, tenantId: tenantId }).lean(),
            DailySale.find({
                staff: staffId,
                tenantId: tenantId,
                date: { $gte: startOfMonth(startDate), $lte: endDate }
            }).sort({ date: 'asc' }).lean(),
            (async () => {
                const rules = await IncentiveRule.find({ tenantId }).sort({ createdAt: -1 }).lean();
                return {
                    daily: rules.filter(r => r.type === 'daily'),
                    monthly: rules.filter(r => r.type === 'monthly'),
                    package: rules.filter(r => r.type === 'package'),
                    giftCard: rules.filter(r => r.type === 'giftCard'),
                };
            })(),
            Invoice.find({
                tenantId: tenantId,
                createdAt: { $gte: startDate, $lte: endDate },
                'manualDiscount.appliedAmount': { $gt: 0 }
            }).lean()
        ]);

        if (!staff) {
            return NextResponse.json({ success: false, error: 'Staff member not found for this salon.' }, { status: 401 });
        }
        if (!staff.salary) {
             return NextResponse.json({ success: false, error: 'Your salary is not set, cannot calculate performance targets.' }, { status: 400 });
        }

        const dailyBreakdown = [];
        const salesInRange = allSalesInMonth.filter(s => {
            const saleDate = new Date(s.date);
            return saleDate >= startDate && saleDate <= endDate;
        });

        for (const saleForThisDay of salesInRange) {
            const d = new Date(saleForThisDay.date);
            const dateString = d.toISOString().split('T')[0];

            // ✅ FIX: Start of the discount calculation logic for this day
            let netServiceSale = saleForThisDay.serviceSale || 0;
            const invoicesForDay = allInvoicesInRange.filter(inv => new Date(inv.createdAt).toISOString().split('T')[0] === dateString);

            for (const invoice of invoicesForDay) {
                const manualDiscountAmount = invoice.manualDiscount?.appliedAmount || 0;
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
            // ✅ FIX: End of discount calculation. 'netServiceSale' is now accurate.

            const historicalTimestamp = new Date(saleForThisDay.createdAt || saleForThisDay.date);

            const dailyRule = findHistoricalRule(allRules.daily, historicalTimestamp) as DailyRule | null;
            const monthlyRule = findHistoricalRule(allRules.monthly, historicalTimestamp) as MonthlyRule | null;
            const packageRule = findHistoricalRule(allRules.package, historicalTimestamp) as FixedTargetRule | null;
            const giftCardRule = findHistoricalRule(allRules.giftCard, historicalTimestamp) as FixedTargetRule | null;
            
            let dailyIncentive = 0;
            let dailyTarget = 0;
            let dailyRate = 0;
            if (dailyRule) {
                const daysInMonth = getDaysInMonth(d.getFullYear(), d.getMonth());
                const target = (staff.salary * dailyRule.target.multiplier) / daysInMonth;
                const reviewBonus = (saleForThisDay.reviewsWithName * (dailyRule.sales.reviewNameValue || 0)) + (saleForThisDay.reviewsWithPhoto * (dailyRule.sales.reviewPhotoValue || 0));
                
                // ✅ FIX: Use the corrected 'netServiceSale' for incentive calculation
                const achieved = (dailyRule.sales.includeServiceSale ? netServiceSale : 0) 
                               + (dailyRule.sales.includeProductSale ? (saleForThisDay.productSale || 0) : 0) 
                               + (dailyRule.sales.includePackageSale ? (saleForThisDay.packageSale || 0) : 0)
                               + (dailyRule.sales.includeGiftCardSale ? (saleForThisDay.giftCardSale || 0) : 0)
                               + reviewBonus;
                
                const base = dailyRule.incentive.applyOn === 'serviceSaleOnly' ? netServiceSale : achieved;
                const result = calculateIncentive(achieved, target, dailyRule.incentive.rate, dailyRule.incentive.doubleRate, base);
                dailyIncentive = result.incentive;
                dailyTarget = target;
                dailyRate = result.appliedRate;
            }

            const salesUpToToday = allSalesInMonth.filter(s => new Date(s.date) <= d);
            const salesUpToYesterday = allSalesInMonth.filter(s => new Date(s.date) < d);
            const yesterdayTimestamp = salesUpToYesterday.length > 0 ? new Date(salesUpToYesterday[salesUpToYesterday.length - 1].createdAt || d) : d;
            const monthlyRuleYesterday = findHistoricalRule(allRules.monthly, yesterdayTimestamp) as MonthlyRule | null;

            const cumulativeMonthlyToday = calculateTotalCumulativeMonthly(salesUpToToday, staff, monthlyRule);
            const cumulativeMonthlyYesterday = calculateTotalCumulativeMonthly(salesUpToYesterday, staff, monthlyRuleYesterday);
            const monthlyIncentiveDelta = cumulativeMonthlyToday - cumulativeMonthlyYesterday;

            let packageIncentiveToday = 0;
            if (packageRule) {
                const totalPackageSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.packageSale || 0), 0);
                const { isTargetMet, appliedRate } = calculateIncentive(totalPackageSaleMonth, packageRule.target.targetValue, packageRule.incentive.rate, packageRule.incentive.doubleRate, totalPackageSaleMonth);
                if (isTargetMet) {
                    packageIncentiveToday = (saleForThisDay.packageSale || 0) * appliedRate;
                }
            }

            let giftCardIncentiveToday = 0;
            if (giftCardRule) {
                const totalGiftCardSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.giftCardSale || 0), 0);
                const { isTargetMet, appliedRate } = calculateIncentive(totalGiftCardSaleMonth, giftCardRule.target.targetValue, giftCardRule.incentive.rate, giftCardRule.incentive.doubleRate, totalGiftCardSaleMonth);
                if (isTargetMet) {
                    giftCardIncentiveToday = (saleForThisDay.giftCardSale || 0) * appliedRate;
                }
            }

            const totalIncentiveForDay = dailyIncentive + monthlyIncentiveDelta + packageIncentiveToday + giftCardIncentiveToday;

            dailyBreakdown.push({
                date: saleForThisDay.date.toISOString().split('T')[0],
                // ✅ FIX: Return the corrected 'netServiceSale' to the frontend
                serviceSale: netServiceSale,
                productSale: saleForThisDay.productSale || 0,
                packageSale: saleForThisDay.packageSale || 0,
                giftCardSale: saleForThisDay.giftCardSale || 0,
                customerCount: saleForThisDay.customerCount || 0,
                incentive: {
                    target: dailyTarget,
                    rate: dailyRate,
                    amount: totalIncentiveForDay,
                },
            });
        }

        const summary = dailyBreakdown.reduce((acc, day) => {
            acc.totalServiceSales += day.serviceSale;
            acc.totalProductSales += day.productSale;
            acc.totalPackageSales += day.packageSale;
            acc.totalGiftCardSales += day.giftCardSale;
            acc.totalCustomers += day.customerCount;
            return acc;
        }, { 
            totalServiceSales: 0, 
            totalProductSales: 0, 
            totalPackageSales: 0, 
            totalGiftCardSales: 0, 
            totalCustomers: 0 
        });

        const totalSales = summary.totalServiceSales + summary.totalProductSales + summary.totalPackageSales + summary.totalGiftCardSales;
        
        const performanceData = {
            summary: {
                totalSales,
                totalServiceSales: summary.totalServiceSales,
                totalProductSales: summary.totalProductSales, 
                totalPackageSales: summary.totalPackageSales,
                totalGiftCardSales: summary.totalGiftCardSales,
                totalCustomers: summary.totalCustomers,
            },
            dailyBreakdown: dailyBreakdown.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        };
        
        return NextResponse.json({ success: true, data: performanceData });

    } catch (error: any) {
        console.error("API Error in /api/staff/performance:", error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}