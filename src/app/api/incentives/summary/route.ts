// /app/api/incentives/summary/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import { getTenantIdOrBail } from '@/lib/tenant';
import IncentiveRule from '@/models/IncentiveRule';

// --- TYPE DEFINITIONS (Unchanged) ---
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

// --- HELPER FUNCTIONS (Unchanged) ---
function getDaysInMonth(year: number, month: number): number { return new Date(year, month + 1, 0).getDate(); }

function calculateIncentive(achievedValue: number, targetValue: number, rate: number, doubleRate: number, baseForIncentive: number) {
    let incentive = 0;
    const isTargetMet = achievedValue >= targetValue;
    if (isTargetMet && targetValue > 0) {
        const doubleTargetValue = targetValue * 2;
        incentive = baseForIncentive * (achievedValue >= doubleTargetValue ? doubleRate : rate);
    }
    return { incentive, isTargetMet };
}

function findHistoricalRule(rules: any[], timestamp: Date) {
    if (!rules || rules.length === 0) return null;
    return rules.find(rule => new Date(rule.createdAt) <= timestamp);
}

function calculateTotalCumulativeIncentive(salesUpToDate: any[], staff: any, rules: any) {
    let totalIncentive = 0;

    if (rules.monthly) {
        const rule = rules.monthly as MonthlyRule;
        const totalService = salesUpToDate.reduce((sum, s) => sum + s.serviceSale, 0);
        const totalProduct = salesUpToDate.reduce((sum, s) => sum + s.productSale, 0);
        const target = staff.salary * rule.target.multiplier;
        const achieved = (rule.sales.includeServiceSale ? totalService : 0) + (rule.sales.includeProductSale ? totalProduct : 0);
        const base = rule.incentive.applyOn === 'serviceSaleOnly' ? totalService : achieved;
        totalIncentive += calculateIncentive(achieved, target, rule.incentive.rate, rule.incentive.doubleRate, base).incentive;
    }
    if (rules.package) {
        const rule = rules.package as FixedTargetRule;
        const totalPackage = salesUpToDate.reduce((sum, s) => sum + s.packageSale, 0);
        const target = rule.target.targetValue;
        totalIncentive += calculateIncentive(totalPackage, target, rule.incentive.rate, rule.incentive.doubleRate, totalPackage).incentive;
    }
    if (rules.giftCard) {
        const rule = rules.giftCard as FixedTargetRule;
        const totalGiftCard = salesUpToDate.reduce((sum, s) => sum + s.giftCardSale, 0);
        const target = rule.target.targetValue;
        totalIncentive += calculateIncentive(totalGiftCard, target, rule.incentive.rate, rule.incentive.doubleRate, totalGiftCard).incentive;
    }
    return totalIncentive;
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
                
                let dailyRule, monthlyRule, packageRule, giftCardRule;

                if (saleForThisDay?.appliedRule) {
                    const snapshot = saleForThisDay.appliedRule as any;
                    if (snapshot.daily !== undefined) {
                        dailyRule = snapshot.daily;
                        monthlyRule = snapshot.monthly;
                        packageRule = snapshot.package;
                        giftCardRule = snapshot.giftCard;
                    } else {
                        dailyRule = snapshot;
                        const historicalTimestamp = new Date(saleForThisDay.createdAt);
                        monthlyRule = findHistoricalRule(allRules.monthly, historicalTimestamp);
                        packageRule = findHistoricalRule(allRules.package, historicalTimestamp);
                        giftCardRule = findHistoricalRule(allRules.giftCard, historicalTimestamp);
                    }
                } else {
                    const dayEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
                    dailyRule = findHistoricalRule(allRules.daily, dayEnd);
                    monthlyRule = findHistoricalRule(allRules.monthly, dayEnd);
                    packageRule = findHistoricalRule(allRules.package, dayEnd);
                    giftCardRule = findHistoricalRule(allRules.giftCard, dayEnd);
                }

                let dailyIncentive = 0;
                let isDailyTargetMet = false;
                let dailyAchievedSales = 0;
                
                if (dailyRule && saleForThisDay) {
                    const rule = dailyRule as DailyRule;
                    if (rule.target && rule.incentive) {
                        const daysInMonth = getDaysInMonth(d.getFullYear(), d.getMonth());
                        const target = (staff.salary * rule.target.multiplier) / daysInMonth;
                        const reviewBonus = (saleForThisDay.reviewsWithName * rule.sales.reviewNameValue) + (saleForThisDay.reviewsWithPhoto * rule.sales.reviewPhotoValue);
                        const achieved = (rule.sales.includeServiceSale ? saleForThisDay.serviceSale : 0) + (rule.sales.includeProductSale ? saleForThisDay.productSale : 0) + reviewBonus;
                        const base = rule.incentive.applyOn === 'serviceSaleOnly' ? saleForThisDay.serviceSale : achieved;
                        const result = calculateIncentive(achieved, target, rule.incentive.rate, rule.incentive.doubleRate, base);
                        dailyIncentive = result.incentive;
                        isDailyTargetMet = result.isTargetMet;
                        dailyAchievedSales = achieved;
                    }
                }
                
                const yesterday = new Date(d);
                yesterday.setDate(d.getDate() - 1);
                
                const salesUpToToday = staffSales.filter(s => new Date(s.date) <= d);
                const salesUpToYesterday = staffSales.filter(s => new Date(s.date) <= yesterday);

                const historicalTimestamp = saleForThisDay ? new Date(saleForThisDay.createdAt) : d;
                
                const relevantRules = {
                    monthly: findHistoricalRule(allRules.monthly, historicalTimestamp),
                    package: findHistoricalRule(allRules.package, historicalTimestamp),
                    giftCard: findHistoricalRule(allRules.giftCard, historicalTimestamp),
                };

                const totalIncentiveToday = calculateTotalCumulativeIncentive(salesUpToToday, staff, relevantRules);
                const totalIncentiveYesterday = calculateTotalCumulativeIncentive(salesUpToYesterday, staff, relevantRules);
                
                const cumulativeIncentiveEarnedToday = totalIncentiveToday - totalIncentiveYesterday;
                const totalIncentiveForDay = dailyIncentive + cumulativeIncentiveEarnedToday;

                summaryData[staffId][dateString] = { 
                    incentive: totalIncentiveForDay,
                    sales: dailyAchievedSales, 
                    isTargetMet: isDailyTargetMet || (totalIncentiveForDay > dailyIncentive),
                    customerCount: saleForThisDay?.customerCount || 0 
                };
            }
        }
        
        return NextResponse.json({ success: true, data: summaryData });

    } catch (error: any) {
        console.error("API GET /api/incentives/summary Error:", error);
        // ✨ --- THE FIX: Changed 'message' to 'error.message' --- ✨
        return NextResponse.json({ message: 'An internal server error occurred', error: error.message }, { status: 500 });
    }
}