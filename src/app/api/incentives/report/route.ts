// Replace the entire content of: src/app/api/incentives/report/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff, { IStaff } from '@/models/staff';
import IncentiveRule from '@/models/IncentiveRule';
import { getTenantIdOrBail } from '@/lib/tenant';

// --- TYPE DEFINITIONS ---
type MultiplierRule = { target: { multiplier: number }, sales: { includeServiceSale: boolean, includeProductSale: boolean, reviewNameValue?: number, reviewPhotoValue?: number }, incentive: { rate: number, doubleRate: number, applyOn: 'totalSaleValue' | 'serviceSaleOnly' } };
type FixedTargetRule = { target: { targetValue: number }, incentive: { rate: number, doubleRate: number } };

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

// THIS IS THE CORRECT LOGIC, ADAPTED FROM YOUR WORKING API
function calculateTotalCumulativeIncentive(sales: any[], staff: IStaff, historicalRules: any) {
    const breakdown = { monthly: 0, package: 0, giftCard: 0 };
    if (historicalRules.monthly) {
        const rule = historicalRules.monthly as MultiplierRule;
        const totalService = sales.reduce((sum, s) => sum + s.serviceSale, 0);
        const totalProduct = sales.reduce((sum, s) => sum + s.productSale, 0);
        const target = (staff.salary || 0) * rule.target.multiplier;
        const achieved = (rule.sales.includeServiceSale ? totalService : 0) + (rule.sales.includeProductSale ? totalProduct : 0);
        const base = rule.incentive.applyOn === 'serviceSaleOnly' ? totalService : achieved;
        breakdown.monthly = calculateIncentive(achieved, target, rule.incentive.rate, rule.incentive.doubleRate, base).incentive;
    }
    if (historicalRules.package) {
        const rule = historicalRules.package as FixedTargetRule;
        const totalPackage = sales.reduce((sum, s) => sum + (s.packageSale || 0), 0);
        const target = rule.target.targetValue;
        breakdown.package = calculateIncentive(totalPackage, target, rule.incentive.rate, rule.incentive.doubleRate, totalPackage).incentive;
    }
    if (historicalRules.giftCard) {
        const rule = historicalRules.giftCard as FixedTargetRule;
        const totalGiftCard = sales.reduce((sum, s) => sum + (s.giftCardSale || 0), 0);
        const target = rule.target.targetValue;
        breakdown.giftCard = calculateIncentive(totalGiftCard, target, rule.incentive.rate, rule.incentive.doubleRate, totalGiftCard).incentive;
    }
    return breakdown;
}


export async function POST(request: Request) {
  try {
    await dbConnect();
    const tenantId = getTenantIdOrBail(request as any);
    if (tenantId instanceof NextResponse) return tenantId;

    const body = await request.json();
    const { startDate, endDate } = body;
    if (!startDate || !endDate) return NextResponse.json({ message: 'Start and End date are required.' }, { status: 400 });

    const start = new Date(startDate);
    const end = new Date(endDate);

    const [allStaff, allSales, allRules] = await Promise.all([
        Staff.find({ tenantId, salary: { $exists: true, $gt: 0 } }).lean(),
        DailySale.find({ tenantId, date: { $gte: start, $lte: end } }).sort({ date: 'asc' }).lean(),
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

    const dailyReport: any[] = [];
    const staffSummaryMap = new Map<string, { name: string; totalIncentive: number }>();

    for (const staff of allStaff) {
        const staffIdString = staff._id.toString();
        staffSummaryMap.set(staffIdString, { name: staff.name, totalIncentive: 0 });
        
        const staffSales = allSales.filter(s => s.staff.toString() === staffIdString);
        if (staffSales.length === 0) continue;

        for (let i = 0; i < staffSales.length; i++) {
            const currentSale = staffSales[i];
            const saleDate = new Date(currentSale.date);

            let dailyIncentive = 0, dailyTarget = 0, dailyRate = 0;
            const historicalDailyRule = findHistoricalRule(allRules.daily, saleDate) as MultiplierRule | null;
            if (historicalDailyRule) {
                const daysInMonth = getDaysInMonth(saleDate.getFullYear(), saleDate.getMonth());
                dailyTarget = ((staff.salary || 0) * historicalDailyRule.target.multiplier) / daysInMonth;
                const reviewBonus = (currentSale.reviewsWithName * (historicalDailyRule.sales?.reviewNameValue || 0)) + (currentSale.reviewsWithPhoto * (historicalDailyRule.sales?.reviewPhotoValue || 0));
                const achieved = (historicalDailyRule.sales?.includeServiceSale ? currentSale.serviceSale : 0) + (historicalDailyRule.sales?.includeProductSale ? currentSale.productSale : 0) + reviewBonus;
                const base = historicalDailyRule.incentive?.applyOn === 'serviceSaleOnly' ? currentSale.serviceSale : achieved;
                const result = calculateIncentive(achieved, dailyTarget, historicalDailyRule.incentive.rate, historicalDailyRule.incentive.doubleRate, base);
                dailyIncentive = result.incentive;
                dailyRate = result.appliedRate;
            }

            const salesUpToToday = staffSales.slice(0, i + 1);
            const salesUpToYesterday = staffSales.slice(0, i);
            const historicalRulesForDay = {
                monthly: findHistoricalRule(allRules.monthly, saleDate),
                package: findHistoricalRule(allRules.package, saleDate),
                giftCard: findHistoricalRule(allRules.giftCard, saleDate)
            };
            
            const cumulativeToday = calculateTotalCumulativeIncentive(salesUpToToday, staff, historicalRulesForDay);
            const cumulativeYesterday = calculateTotalCumulativeIncentive(salesUpToYesterday, staff, historicalRulesForDay);
            
            const cumulativeDelta = (cumulativeToday.monthly - cumulativeYesterday.monthly) + 
                                  (cumulativeToday.package - cumulativeYesterday.package) + 
                                  (cumulativeToday.giftCard - cumulativeYesterday.giftCard);

            const totalIncentiveForDay = dailyIncentive + cumulativeDelta;
            
            const summary = staffSummaryMap.get(staffIdString)!;
            summary.totalIncentive += totalIncentiveForDay;

            dailyReport.push({
                'Date': saleDate.toISOString().split('T')[0],
                'Staff Name': staff.name,
                'Target (₹)': dailyTarget.toFixed(2),
                'Applied Rate': dailyRate.toFixed(2),
                'Incentive (₹)': totalIncentiveForDay.toFixed(2),
            });
        }
    }

    const monthlyReport: any[] = [], packageReport: any[] = [], giftCardReport: any[] = [];
    for (const staff of allStaff) {
        const staffSales = allSales.filter(s => s.staff.toString() === staff._id.toString());
        const lastSaleDate = staffSales.length > 0 ? new Date(staffSales[staffSales.length - 1].date) : end;
        const historicalRules = {
            monthly: findHistoricalRule(allRules.monthly, lastSaleDate),
            package: findHistoricalRule(allRules.package, lastSaleDate),
            giftCard: findHistoricalRule(allRules.giftCard, lastSaleDate)
        };
        const breakdown = calculateTotalCumulativeIncentive(staffSales, staff, historicalRules);
        monthlyReport.push({ 
            'Staff Name': staff.name, 
            'Incentive (₹)': breakdown.monthly.toFixed(2), 
            'Target (₹)': ((staff.salary || 0) * (historicalRules.monthly?.target.multiplier || 0)).toFixed(2) 
        });
        packageReport.push({ 'Staff Name': staff.name, 'Incentive (₹)': breakdown.package.toFixed(2) });
        giftCardReport.push({ 'Staff Name': staff.name, 'Incentive (₹)': breakdown.giftCard.toFixed(2) });
    }

    const staffSummary = Array.from(staffSummaryMap.values()).map(s => ({
      'Staff Name': s.name,
      'Total Incentive (₹)': s.totalIncentive.toFixed(2)
    }));
    
    return NextResponse.json({ 
        success: true, 
        data: { dailyReport, monthlyReport, packageReport, giftCardReport, staffSummary } 
    });

  } catch (error: any) {
    console.error("API POST /api/incentives/report Error:", error);
    return NextResponse.json({ message: 'An internal server error occurred', error: error.message }, { status: 500 });
  }
}