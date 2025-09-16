// /app/api/incentive-payout/staff/[staffId]/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import IncentiveRule from '@/models/IncentiveRule';
import IncentivePayout from '@/models/IncentivePayout';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import Invoice from '@/models/invoice'; // Ensure Invoice model is imported

export const dynamic = 'force-dynamic';

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

    const allSales = await DailySale.find({ tenantId, staff: staffId }).sort({ date: 'asc' }).lean();
    if (allSales.length === 0) {
      const approvedPayouts = await IncentivePayout.find({ staff: staffId, tenantId, status: 'approved' }).lean();
      const totalPaid = approvedPayouts.reduce((sum, payout) => sum + payout.amount, 0);
      return NextResponse.json({ totalEarned: 0, totalPaid: totalPaid, balance: -totalPaid });
    }
    
    // Fetch all invoices and rules once to be efficient.
    const firstSaleDate = new Date(allSales[0].date);
    const lastSaleDate = new Date(allSales[allSales.length - 1].date);
    lastSaleDate.setHours(23, 59, 59, 999);

    // This query now fetches ALL invoices for the tenant in the date range
    const allInvoices = await Invoice.find({ tenantId, createdAt: { $gte: firstSaleDate, $lte: lastSaleDate } }).lean();

    const allRules = {
        daily: await IncentiveRule.find({ tenantId, type: 'daily' }).sort({ createdAt: -1 }).lean(),
        monthly: await IncentiveRule.find({ tenantId, type: 'monthly' }).sort({ createdAt: -1 }).lean(),
        package: await IncentiveRule.find({ tenantId, type: 'package' }).sort({ createdAt: -1 }).lean(),
        giftCard: await IncentiveRule.find({ tenantId, type: 'giftCard' }).sort({ createdAt: -1 }).lean(),
    };
    
    let totalEarned = 0;
    
    const salesByMonth: { [key: string]: any[] } = {};
    for (const sale of allSales) {
        const monthKey = new Date(sale.date).toISOString().slice(0, 7);
        if (!salesByMonth[monthKey]) salesByMonth[monthKey] = [];
        salesByMonth[monthKey].push(sale);
    }

    for (const monthKey in salesByMonth) {
        const monthSales = salesByMonth[monthKey];
        
        for (let i = 0; i < monthSales.length; i++) {
            const currentSale = monthSales[i];
            const saleDate = new Date(currentSale.date);
            const dateString = saleDate.toISOString().split('T')[0];
            const historicalTimestamp = new Date(currentSale.createdAt || currentSale.date);

            const dailyRule = findHistoricalRule(allRules.daily, historicalTimestamp) as DailyRule | null;
            const monthlyRule = findHistoricalRule(allRules.monthly, historicalTimestamp) as MonthlyRule | null;
            const packageRule = findHistoricalRule(allRules.package, historicalTimestamp) as FixedTargetRule | null;
            const giftCardRule = findHistoricalRule(allRules.giftCard, historicalTimestamp) as FixedTargetRule | null;

            let dailyIncentive = 0;
            if (dailyRule) {
                let netServiceSale = currentSale.serviceSale;
                const invoicesForDay = allInvoices.filter(inv => new Date(inv.createdAt).toISOString().split('T')[0] === dateString);

                for (const invoice of invoicesForDay) {
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

                const daysInMonth = getDaysInMonth(saleDate.getFullYear(), saleDate.getMonth());
                const target = (staff.salary * dailyRule.target.multiplier) / daysInMonth;
                const reviewBonus = (currentSale.reviewsWithName * dailyRule.sales.reviewNameValue) + (currentSale.reviewsWithPhoto * dailyRule.sales.reviewPhotoValue);
                const achieved = (dailyRule.sales.includeServiceSale ? netServiceSale : 0) 
                               + (dailyRule.sales.includeProductSale ? currentSale.productSale : 0)
                               + (dailyRule.sales.includePackageSale ? (currentSale.packageSale || 0) : 0)
                               + (dailyRule.sales.includeGiftCardSale ? (currentSale.giftCardSale || 0) : 0)
                               + reviewBonus;
                const base = dailyRule.incentive.applyOn === 'serviceSaleOnly' ? netServiceSale : achieved;
                dailyIncentive = calculateIncentive(achieved, target, dailyRule.incentive.rate, dailyRule.incentive.doubleRate, base).incentive;
            }

            const salesUpToToday = monthSales.slice(0, i + 1);
            const salesUpToYesterday = monthSales.slice(0, i);
            const yesterdayTimestamp = i > 0 ? new Date(monthSales[i-1].createdAt || monthSales[i-1].date) : new Date(new Date(saleDate).setDate(saleDate.getDate() - 1));
            const monthlyRuleYesterday = findHistoricalRule(allRules.monthly, yesterdayTimestamp) as MonthlyRule | null;
            
            const cumulativeMonthlyToday = calculateTotalCumulativeMonthly(salesUpToToday, staff, monthlyRule);
            const cumulativeMonthlyYesterday = calculateTotalCumulativeMonthly(salesUpToYesterday, staff, monthlyRuleYesterday);
            const monthlyIncentiveDelta = cumulativeMonthlyToday - cumulativeMonthlyYesterday;

            let packageIncentiveToday = 0;
            if (packageRule) {
                const totalPackageSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.packageSale || 0), 0);
                const { isTargetMet, appliedRate } = calculateIncentive(totalPackageSaleMonth, packageRule.target.targetValue, packageRule.incentive.rate, packageRule.incentive.doubleRate, totalPackageSaleMonth);
                if (isTargetMet) {
                    packageIncentiveToday = (currentSale.packageSale || 0) * appliedRate;
                }
            }

            let giftCardIncentiveToday = 0;
            if (giftCardRule) {
                const totalGiftCardSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.giftCardSale || 0), 0);
                const { isTargetMet, appliedRate } = calculateIncentive(totalGiftCardSaleMonth, giftCardRule.target.targetValue, giftCardRule.incentive.rate, giftCardRule.incentive.doubleRate, totalGiftCardSaleMonth);
                if (isTargetMet) {
                    giftCardIncentiveToday = (currentSale.giftCardSale || 0) * appliedRate;
                }
            }
            
            totalEarned += dailyIncentive + monthlyIncentiveDelta + packageIncentiveToday + giftCardIncentiveToday;
        }
    }

    const approvedPayouts = await IncentivePayout.find({ staff: staffId, tenantId, status: 'approved' }).lean();
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