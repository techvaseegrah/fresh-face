import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Invoice from '@/models/invoice';
import Staff from '@/models/staff';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { getTenantIdOrBail } from '@/lib/tenant';
import IncentivePayout from '@/models/IncentivePayout';
import DailySale from '@/models/DailySale';
import IncentiveRule from '@/models/IncentiveRule';

// --- TYPE DEFINITIONS & HELPERS (Unchanged) ---
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

export async function GET(request: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) {
        return tenantId;
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const staffId = searchParams.get('staffId');

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ success: false, message: 'startDate and endDate query parameters are required.' }, { status: 400 });
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);
    endDate.setHours(23, 59, 59, 999);
    
    const objectIdTenantId = new mongoose.Types.ObjectId(tenantId);

    // ====================================================================
    // --- Logic for single staff details (for the side panel) ---
    // ====================================================================
    if (staffId) {
        // This part was already correct and remains unchanged.
        if (!mongoose.Types.ObjectId.isValid(staffId)) {
            return NextResponse.json({ success: false, message: 'Invalid Staff ID format.' }, { status: 400 });
        }
        const staff = await Staff.findOne({ _id: staffId, tenantId: objectIdTenantId }).lean();
        if (!staff || !staff.salary) {
            return NextResponse.json({ success: false, message: 'Staff member not found or salary not set.'}, { status: 404 });
        }
        const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const allSalesInMonth = await DailySale.find({ tenantId: objectIdTenantId, staff: staff._id, date: { $gte: monthStart, $lte: endDate } }).sort({ date: 'asc' }).lean();
        const allInvoicesInRange = await Invoice.find({ tenantId: objectIdTenantId, createdAt: { $gte: startDate, $lte: endDate } }).lean();
        const allRules = {
            daily: await IncentiveRule.find({ tenantId: objectIdTenantId, type: 'daily' }).sort({ createdAt: -1 }).lean(),
            monthly: await IncentiveRule.find({ tenantId: objectIdTenantId, type: 'monthly' }).sort({ createdAt: -1 }).lean(),
            package: await IncentiveRule.find({ tenantId: objectIdTenantId, type: 'package' }).sort({ createdAt: -1 }).lean(),
            giftCard: await IncentiveRule.find({ tenantId: objectIdTenantId, type: 'giftCard' }).sort({ createdAt: -1 }).lean(),
        };
        const dailyDetails = [];
        const incentiveSummary = { daily: 0, monthly: 0, package: 0, giftCard: 0 };
        const salesInRange = allSalesInMonth.filter(s => { const saleDate = new Date(s.date); return saleDate >= startDate && saleDate <= endDate; });
        for (const saleForThisDay of salesInRange) {
            const d = new Date(saleForThisDay.date);
            const dateString = d.toISOString().split('T')[0];
            let netServiceSale = saleForThisDay.serviceSale;
            const invoicesForDay = allInvoicesInRange.filter(inv => new Date(inv.createdAt).toISOString().split('T')[0] === dateString);
            for (const invoice of invoicesForDay) {
                const manualDiscountAmount = invoice.manualDiscount?.appliedAmount || 0;
                if (manualDiscountAmount <= 0) continue;
                let totalServiceValueOnInvoice = 0;
                let staffServiceValueOnInvoice = 0;
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
            const historicalTimestamp = new Date(saleForThisDay.createdAt || saleForThisDay.date);
            const dailyRule = findHistoricalRule(allRules.daily, historicalTimestamp) as DailyRule | null;
            const monthlyRule = findHistoricalRule(allRules.monthly, historicalTimestamp) as MonthlyRule | null;
            const packageRule = findHistoricalRule(allRules.package, historicalTimestamp) as FixedTargetRule | null;
            const giftCardRule = findHistoricalRule(allRules.giftCard, historicalTimestamp) as FixedTargetRule | null;
            let dailyIncentive = { incentive: 0, appliedRate: 0 };
            if (dailyRule) {
                const daysInMonth = getDaysInMonth(d.getFullYear(), d.getMonth());
                const target = (staff.salary * dailyRule.target.multiplier) / daysInMonth;
                const reviewBonus = (saleForThisDay.reviewsWithName * dailyRule.sales.reviewNameValue) + (saleForThisDay.reviewsWithPhoto * dailyRule.sales.reviewPhotoValue);
                const achieved = (dailyRule.sales.includeServiceSale ? netServiceSale : 0) + (dailyRule.sales.includeProductSale ? saleForThisDay.productSale : 0) + reviewBonus;
                const base = dailyRule.incentive.applyOn === 'serviceSaleOnly' ? netServiceSale : achieved;
                const result = calculateIncentive(achieved, target, dailyRule.incentive.rate, dailyRule.incentive.doubleRate, base);
                dailyIncentive = { incentive: result.incentive, appliedRate: result.appliedRate };
            }
            const salesUpToToday = allSalesInMonth.filter(s => new Date(s.date) <= d);
            const salesUpToYesterday = allSalesInMonth.filter(s => new Date(s.date) < d);
            const yesterdayTimestamp = salesUpToYesterday.length > 0 ? new Date(salesUpToYesterday[salesUpToYesterday.length - 1].createdAt || d) : d;
            const monthlyRuleYesterday = findHistoricalRule(allRules.monthly, yesterdayTimestamp) as MonthlyRule | null;
            const cumulativeMonthlyToday = calculateTotalCumulativeMonthly(salesUpToToday, staff, monthlyRule);
            const cumulativeMonthlyYesterday = calculateTotalCumulativeMonthly(salesUpToYesterday, staff, monthlyRuleYesterday);
            const monthlyIncentiveDelta = cumulativeMonthlyToday - cumulativeMonthlyYesterday;
            let packageIncentive = { incentive: 0, appliedRate: 0 };
            if (packageRule) {
                const totalPackageSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.packageSale || 0), 0);
                const { isTargetMet, appliedRate } = calculateIncentive(totalPackageSaleMonth, packageRule.target.targetValue, packageRule.incentive.rate, packageRule.incentive.doubleRate, totalPackageSaleMonth);
                if (isTargetMet) { packageIncentive = { incentive: (saleForThisDay.packageSale || 0) * appliedRate, appliedRate }; }
            }
            let giftCardIncentive = { incentive: 0, appliedRate: 0 };
            if (giftCardRule) {
                const totalGiftCardSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.giftCardSale || 0), 0);
                const { isTargetMet, appliedRate } = calculateIncentive(totalGiftCardSaleMonth, giftCardRule.target.targetValue, giftCardRule.incentive.rate, giftCardRule.incentive.doubleRate, totalGiftCardSaleMonth);
                if (isTargetMet) { giftCardIncentive = { incentive: (saleForThisDay.giftCardSale || 0) * appliedRate, appliedRate }; }
            }
            incentiveSummary.daily += dailyIncentive.incentive;
            incentiveSummary.monthly += monthlyIncentiveDelta;
            incentiveSummary.package += packageIncentive.incentive;
            incentiveSummary.giftCard += giftCardIncentive.incentive;
            dailyDetails.push({ date: dateString, serviceSales: netServiceSale, productSales: saleForThisDay.productSale, packageSales: saleForThisDay.packageSale, giftCardSales: saleForThisDay.giftCardSale, customersServed: saleForThisDay.customerCount, rates: { daily: dailyIncentive.appliedRate, monthly: monthlyRule ? (calculateIncentive(salesUpToToday.reduce((s,c) => s+(c.serviceSale||0) + (c.productSale||0),0), staff.salary * monthlyRule.target.multiplier, monthlyRule.incentive.rate, monthlyRule.incentive.doubleRate, 1).appliedRate) : 0, package: packageIncentive.appliedRate, giftCard: giftCardIncentive.appliedRate }, incentives: { daily: dailyIncentive. incentive, monthly: monthlyIncentiveDelta, package: packageIncentive.incentive, giftCard: giftCardIncentive.incentive } });
        }
        const payouts = await IncentivePayout.find({ tenantId: objectIdTenantId, staff: staff._id, status: 'approved' }).lean();
        const totalPaid = payouts.reduce((sum, p) => sum + p.amount, 0);
        return NextResponse.json({ success: true, details: dailyDetails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), incentiveSummary, payouts: { history: payouts, totalPaid: totalPaid } });
    }

    // ====================================================================
    // --- Logic for monthly summary (for the main page) ---
    // ====================================================================
    
    const staffPerformanceGross = await Invoice.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate }, tenantId: objectIdTenantId, paymentStatus: 'Paid' } },
      { $unwind: '$lineItems' },
      { $match: { 'lineItems.staffId': { $exists: true, $ne: null } } },
      { $group: { _id: '$lineItems.staffId', totalSales: { $sum: '$lineItems.finalPrice' }, totalServiceSales: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'service'] }, '$lineItems.finalPrice', 0] } }, totalProductSales: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'product'] }, '$lineItems.finalPrice', 0] } }, uniqueCustomers: { $addToSet: '$customerId' } } },
      
      // ✅ --- THIS IS THE FIX --- ✅
      // The localField was incorrectly set to 'id'. It has been corrected to '_id'.
      { $lookup: { from: 'staffs', localField: '_id', foreignField: '_id', as: 'staffDetails' } },
      // ✅ --- END OF THE FIX --- ✅

      { $unwind: { path: '$staffDetails', preserveNullAndEmptyArrays: true } },
      { $match: { 'staffDetails._id': { $exists: true } } },
      { $project: { _id: 0, staffId: '$staffDetails._id', staffIdNumber: '$staffDetails.staffIdNumber', name: '$staffDetails.name', position: '$staffDetails.position', image: '$staffDetails.image', sales: '$totalSales', totalServiceSales: '$totalServiceSales', totalProductSales: '$totalProductSales', customers: { $size: '$uniqueCustomers' }, salary: '$staffDetails.salary' } },
    ]);

    const staffDiscountShares = await Invoice.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate }, tenantId: objectIdTenantId, paymentStatus: 'Paid', 'manualDiscount.appliedAmount': { $gt: 0 } } },
      { $unwind: '$lineItems' },
      { $group: { _id: '$_id', lineItems: { $push: '$lineItems' }, manualDiscountAmount: { $first: '$manualDiscount.appliedAmount' } } },
      { $addFields: { totalServiceValueOnInvoice: { $reduce: { input: '$lineItems', initialValue: 0, in: { $add: ['$$value', { $cond: [{ $eq: ['$$this.itemType', 'service'] }, '$$this.finalPrice', 0] }] } } } } },
      { $match: { totalServiceValueOnInvoice: { $gt: 0 } } },
      { $unwind: '$lineItems' },
      { $match: { 'lineItems.itemType': 'service', 'lineItems.staffId': { $exists: true, $ne: null } } },
      { $project: { _id: 0, staffId: '$lineItems.staffId', proratedDiscount: { $multiply: [ '$manualDiscountAmount', { $divide: ['$lineItems.finalPrice', '$totalServiceValueOnInvoice'] } ] } } },
      { $group: { _id: '$staffId', totalDiscount: { $sum: '$proratedDiscount' } } }
    ]);
    
    const discountMap = new Map(staffDiscountShares.map(item => [item._id.toString(), item.totalDiscount]));

    const staffPerformance = staffPerformanceGross.map(staff => {
        const discount = discountMap.get(staff.staffId.toString()) || 0;
        const netServiceSales = staff.totalServiceSales - discount;
        const netTotalSales = staff.sales - discount;
        const monthlyTarget = Math.max(1, (staff.salary || 0) * 3.0);
        const rating = netTotalSales <= 0 ? 0 : Math.min(10, (netTotalSales / monthlyTarget) * 5);
        return { ...staff, sales: netTotalSales, totalServiceSales: netServiceSales, rating: parseFloat(rating.toFixed(1)) };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const summary = staffPerformance.reduce((acc, staff) => {
        acc.revenueGenerated += staff.sales;
        acc.totalCustomers += staff.customers;
        if (staff.rating > 0) {
            acc.totalRatingPoints += staff.rating;
            acc.validRatingsCount += 1;
        }
        return acc;
    }, { revenueGenerated: 0, totalCustomers: 0, totalRatingPoints: 0, validRatingsCount: 0 });

    const overallAverageRating = summary.validRatingsCount > 0 ? (summary.totalRatingPoints / summary.validRatingsCount) : 0;
    
    const totalPayoutsAggregation = await IncentivePayout.aggregate([
        { $match: { tenantId: objectIdTenantId, processedDate: { $gte: startDate, $lte: endDate }, status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalPayouts = totalPayoutsAggregation.length > 0 ? totalPayoutsAggregation[0].total : 0;

    return NextResponse.json({ success: true, summary: { averageRating: parseFloat(overallAverageRating.toFixed(1)), totalCustomers: summary.totalCustomers, revenueGenerated: summary.revenueGenerated, avgServiceQuality: parseFloat(overallAverageRating.toFixed(1)), totalPayouts: totalPayouts }, staffPerformance: staffPerformance });
  } catch (error: any) {
    console.error("API GET /performance Error:", error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred', error: error.message }, { status: 500 });
  }
}