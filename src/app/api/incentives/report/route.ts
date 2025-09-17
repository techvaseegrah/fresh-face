// Replace the entire content of: src/app/api/incentives/report/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff, { IStaff } from '@/models/staff';
import IncentiveRule from '@/models/IncentiveRule';
import Invoice from '@/models/invoice'; // Import the Invoice model
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';

// --- TYPE DEFINITIONS (Unchanged) ---
type MultiplierRule = { target: { multiplier: number }, sales: { includeServiceSale: boolean, includeProductSale: boolean, reviewNameValue?: number, reviewPhotoValue?: number }, incentive: { rate: number, doubleRate: number, applyOn: 'totalSaleValue' | 'serviceSaleOnly' } };
type FixedTargetRule = { target: { targetValue: number }, incentive: { rate: number, doubleRate: number } };
type MonthlyRule = { target: { multiplier: number }, sales: { includeServiceSale: boolean, includeProductSale: boolean }, incentive: { rate: number, doubleRate: number, applyOn: 'totalSaleValue' | 'serviceSaleOnly' } };


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

function calculateTotalCumulativeMonthly(sales: any[], staff: IStaff, rule: MonthlyRule | null) {
    if (!rule) return 0;
    // Note: This function operates on cumulative sales and doesn't need net sales,
    // as it's a monthly check. The daily delta handles the net calculation.
    const totalService = sales.reduce((sum, s) => sum + s.serviceSale, 0);
    const totalProduct = sales.reduce((sum, s) => sum + s.productSale, 0);
    const target = (staff.salary || 0) * rule.target.multiplier;
    const achieved = (rule.sales.includeServiceSale ? totalService : 0) + (rule.sales.includeProductSale ? totalProduct : 0);
    const base = rule.incentive.applyOn === 'serviceSaleOnly' ? totalService : achieved;
    return calculateIncentive(achieved, target, rule.incentive.rate, rule.incentive.doubleRate, base).incentive;
}


export async function POST(request: Request) {
  try {
    await dbConnect();
    const tenantId = getTenantIdOrBail(request as any);
    if (tenantId instanceof NextResponse) return tenantId;
    const objectIdTenantId = new mongoose.Types.ObjectId(tenantId);

    const body = await request.json();
    const { startDate, endDate } = body;
    if (!startDate || !endDate) return NextResponse.json({ message: 'Start and End date are required.' }, { status: 400 });

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);

    const [allStaff, allSalesInMonth, allRules, staffDiscountsByDay] = await Promise.all([
        Staff.find({ tenantId: objectIdTenantId, salary: { $exists: true, $gt: 0 } }).lean(),
        DailySale.find({ tenantId: objectIdTenantId, date: { $gte: monthStart, $lte: end } }).sort({ date: 'asc' }).lean(),
        (async () => {
            const rules = await IncentiveRule.find({ tenantId: objectIdTenantId }).sort({ createdAt: -1 }).lean();
            return {
              daily: rules.filter(r => r.type === 'daily'),
              monthly: rules.filter(r => r.type === 'monthly'),
              package: rules.filter(r => r.type === 'package'),
              giftCard: rules.filter(r => r.type === 'giftCard'),
            };
        })(),
        // ✅ --- THIS IS THE FIX --- ✅
        // Aggregate all discounted invoices in the period to calculate each staff's share of discounts per day.
        Invoice.aggregate([
          { $match: { createdAt: { $gte: start, $lte: end }, tenantId: objectIdTenantId, paymentStatus: 'Paid', 'manualDiscount.appliedAmount': { $gt: 0 } } },
          { $addFields: { dateString: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } } } },
          { $unwind: '$lineItems' },
          { $group: { _id: { invoiceId: '$_id', date: '$dateString' }, lineItems: { $push: '$lineItems' }, manualDiscountAmount: { $first: '$manualDiscount.appliedAmount' } } },
          { $addFields: { totalServiceValueOnInvoice: { $reduce: { input: '$lineItems', initialValue: 0, in: { $add: ['$$value', { $cond: [{ $eq: ['$$this.itemType', 'service'] }, '$$this.finalPrice', 0] }] } } } } },
          { $match: { totalServiceValueOnInvoice: { $gt: 0 } } },
          { $unwind: '$lineItems' },
          { $match: { 'lineItems.itemType': 'service', 'lineItems.staffId': { $exists: true, $ne: null } } },
          { $project: { _id: 0, date: '$_id.date', staffId: '$lineItems.staffId', proratedDiscount: { $multiply: [ '$manualDiscountAmount', { $divide: ['$lineItems.finalPrice', '$totalServiceValueOnInvoice'] } ] } } },
          { $group: { _id: { date: '$date', staffId: '$staffId' }, totalDiscount: { $sum: '$proratedDiscount' } } }
        ])
    ]);

    // Create an efficient lookup map for discounts: Map<dateString, Map<staffId, discount>>
    const discountMap = new Map<string, Map<string, number>>();
    for (const item of staffDiscountsByDay) {
        const date = item._id.date;
        const staffId = item._id.staffId.toString();
        const discount = item.totalDiscount;
        if (!discountMap.has(date)) {
            discountMap.set(date, new Map());
        }
        discountMap.get(date)!.set(staffId, discount);
    }
    // ✅ --- END OF THE FIX --- ✅


    const dailyReport: any[] = [];
    const staffSummaryMap = new Map<string, { name: string; totalIncentive: number, daily: number, monthly: number, package: number, giftCard: number }>();

    for (const staff of allStaff) {
        const staffIdString = staff._id.toString();
        staffSummaryMap.set(staffIdString, { name: staff.name, totalIncentive: 0, daily: 0, monthly: 0, package: 0, giftCard: 0 });
        
        const staffSalesInMonth = allSalesInMonth.filter(s => s.staff.toString() === staffIdString);
        if (staffSalesInMonth.length === 0) continue;

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateString = d.toISOString().split('T')[0];
            const saleForThisDay = staffSalesInMonth.find(s => new Date(s.date).toISOString().split('T')[0] === dateString);
            
            const historicalTimestamp = saleForThisDay ? new Date(saleForThisDay.createdAt || saleForThisDay.date) : d;

            const dailyRule = findHistoricalRule(allRules.daily, historicalTimestamp) as MultiplierRule | null;
            const monthlyRule = findHistoricalRule(allRules.monthly, historicalTimestamp) as MonthlyRule | null;
            const packageRule = findHistoricalRule(allRules.package, historicalTimestamp) as FixedTargetRule | null;
            const giftCardRule = findHistoricalRule(allRules.giftCard, historicalTimestamp) as FixedTargetRule | null;
            
            let dailyIncentive = 0;
            let dailyRate = 0;
            let dailyTarget = 0;
            if (dailyRule && saleForThisDay) {
                // ✅ --- APPLY THE FIX --- ✅
                // Look up the discount and calculate net sales before calculating incentive.
                const discountForDay = discountMap.get(dateString)?.get(staffIdString) || 0;
                const netServiceSale = saleForThisDay.serviceSale - discountForDay;

                const daysInMonth = getDaysInMonth(d.getFullYear(), d.getMonth());
                dailyTarget = ((staff.salary || 0) * dailyRule.target.multiplier) / daysInMonth;
                const reviewBonus = (saleForThisDay.reviewsWithName * (dailyRule.sales?.reviewNameValue || 0)) + (saleForThisDay.reviewsWithPhoto * (dailyRule.sales?.reviewPhotoValue || 0));
                
                // Use the new `netServiceSale` in calculations
                const achieved = (dailyRule.sales.includeServiceSale ? netServiceSale : 0) + (dailyRule.sales.includeProductSale ? saleForThisDay.productSale : 0) + reviewBonus;
                const base = dailyRule.incentive?.applyOn === 'serviceSaleOnly' ? netServiceSale : achieved;
                const result = calculateIncentive(achieved, dailyTarget, dailyRule.incentive.rate, dailyRule.incentive.doubleRate, base);
                dailyIncentive = result.incentive;
                dailyRate = result.appliedRate;
            }

            const yesterday = new Date(d);
            yesterday.setDate(d.getDate() - 1);
            const salesUpToToday = staffSalesInMonth.filter(s => new Date(s.date) <= d);
            const salesUpToYesterday = staffSalesInMonth.filter(s => new Date(s.date) <= yesterday);
            const yesterdayTimestamp = salesUpToYesterday.length > 0 ? new Date(salesUpToYesterday[salesUpToYesterday.length - 1].createdAt || yesterday) : yesterday;
            const monthlyRuleYesterday = findHistoricalRule(allRules.monthly, yesterdayTimestamp) as MonthlyRule | null;

            const cumulativeMonthlyToday = calculateTotalCumulativeMonthly(salesUpToToday, staff, monthlyRule);
            const cumulativeMonthlyYesterday = calculateTotalCumulativeMonthly(salesUpToYesterday, staff, monthlyRuleYesterday);
            const monthlyIncentiveDelta = cumulativeMonthlyToday - cumulativeMonthlyYesterday;

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
            
            const summary = staffSummaryMap.get(staffIdString)!;
            summary.totalIncentive += totalIncentiveForDay;
            summary.daily += dailyIncentive;
            summary.monthly += monthlyIncentiveDelta;
            summary.package += packageIncentiveToday;
            summary.giftCard += giftCardIncentiveToday;

            dailyReport.push({
                'Date': dateString,
                'Staff Name': staff.name,
                'Target (₹)': dailyTarget.toFixed(2),
                'Applied Rate': dailyRate.toFixed(2),
                'Incentive (₹)': totalIncentiveForDay.toFixed(2),
            });
        }
    }

    const dailySummaryReport: any[] = [];
    const monthlyReport: any[] = [], packageReport: any[] = [], giftCardReport: any[] = [];

    for (const [staffIdString, summary] of staffSummaryMap.entries()) {
        const staff = allStaff.find(s => s._id.toString() === staffIdString)!;
        
        const lastDayOfRange = new Date(Math.min(end.getTime(), new Date().getTime()));
        const lastHistoricalTimestamp = allSalesInMonth.filter(s => s.staff.toString() === staffIdString && new Date(s.date) <= lastDayOfRange).pop()?.createdAt || lastDayOfRange;
        const historicalMonthlyRule = findHistoricalRule(allRules.monthly, new Date(lastHistoricalTimestamp));

        dailySummaryReport.push({ 'Staff Name': summary.name, 'Incentive (₹)': summary.daily.toFixed(2) });
        monthlyReport.push({ 
            'Staff Name': summary.name, 
            'Incentive (₹)': summary.monthly.toFixed(2), 
            'Target (₹)': ((staff.salary || 0) * (historicalMonthlyRule?.target.multiplier || 0)).toFixed(2) 
        });
        packageReport.push({ 'Staff Name': summary.name, 'Incentive (₹)': summary.package.toFixed(2) });
        giftCardReport.push({ 'Staff Name': summary.name, 'Incentive (₹)': summary.giftCard.toFixed(2) });
    }

    const staffSummary = Array.from(staffSummaryMap.values()).map(s => ({
      'Staff Name': s.name,
      'Total Incentive (₹)': s.totalIncentive.toFixed(2)
    }));
    
    return NextResponse.json({ 
        success: true, 
        data: { dailyReport, dailySummaryReport, monthlyReport, packageReport, giftCardReport, staffSummary } 
    });

  } catch (error: any) {
    console.error("API POST /api/incentives/report Error:", error);
    return NextResponse.json({ message: 'An internal server error occurred', error: error.message }, { status: 500 });
  }
}