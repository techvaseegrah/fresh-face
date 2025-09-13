// /app/api/staff/payouts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Payout from '@/models/IncentivePayout';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import IncentiveRule from '@/models/IncentiveRule';

// ===================================================================
// ✅ START: Updated Incentive Calculation Logic
// This entire section is copied from your admin route for consistency.
// ===================================================================

// --- TYPE DEFINITIONS ---
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
    // Assuming rules have a 'createdAt' property and are sorted descending
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


// --- Main Calculation Logic (Replaces the old version) ---
const calculateTotalEarned = async (staffId: string, tenantId: string): Promise<number> => {
    const staff = await Staff.findOne({ _id: staffId, tenantId }).lean();
    if (!staff || !staff.salary || staff.salary <= 0) {
      return 0;
    }

    const allSales = await DailySale.find({ tenantId, staff: staffId }).sort({ date: 'asc' }).lean();
    const allRules = {
        daily: await IncentiveRule.find({ tenantId, type: 'daily' }).sort({ createdAt: -1 }).lean(),
        monthly: await IncentiveRule.find({ tenantId, type: 'monthly' }).sort({ createdAt: -1 }).lean(),
        package: await IncentiveRule.find({ tenantId, type: 'package' }).sort({ createdAt: -1 }).lean(),
        giftCard: await IncentiveRule.find({ tenantId, type: 'giftCard' }).sort({ createdAt: -1 }).lean(),
    };
    
    let totalEarned = 0;
    
    // Group sales by month to correctly handle cumulative calculations
    const salesByMonth: { [key: string]: any[] } = {};
    for (const sale of allSales) {
        const monthKey = new Date(sale.date).toISOString().slice(0, 7); // YYYY-MM
        if (!salesByMonth[monthKey]) {
            salesByMonth[monthKey] = [];
        }
        salesByMonth[monthKey].push(sale);
    }

    // Process each month independently
    for (const monthKey in salesByMonth) {
        const monthSales = salesByMonth[monthKey];
        
        for (let i = 0; i < monthSales.length; i++) {
            const currentSale = monthSales[i];
            const saleDate = new Date(currentSale.date);
            const historicalTimestamp = new Date(currentSale.createdAt || currentSale.date);

            const dailyRule = findHistoricalRule(allRules.daily, historicalTimestamp) as DailyRule | null;
            const monthlyRule = findHistoricalRule(allRules.monthly, historicalTimestamp) as MonthlyRule | null;
            const packageRule = findHistoricalRule(allRules.package, historicalTimestamp) as FixedTargetRule | null;
            const giftCardRule = findHistoricalRule(allRules.giftCard, historicalTimestamp) as FixedTargetRule | null;

            // 1. Calculate Daily Incentive
            let dailyIncentive = 0;
            if (dailyRule) {
                const daysInMonth = getDaysInMonth(saleDate.getFullYear(), saleDate.getMonth());
                const target = (staff.salary * dailyRule.target.multiplier) / daysInMonth;
                const reviewBonus = (currentSale.reviewsWithName * dailyRule.sales.reviewNameValue) + (currentSale.reviewsWithPhoto * dailyRule.sales.reviewPhotoValue);
                const achieved = (dailyRule.sales.includeServiceSale ? currentSale.serviceSale : 0) + (dailyRule.sales.includeProductSale ? currentSale.productSale : 0) + reviewBonus;
                const base = dailyRule.incentive.applyOn === 'serviceSaleOnly' ? currentSale.serviceSale : achieved;
                dailyIncentive = calculateIncentive(achieved, target, dailyRule.incentive.rate, dailyRule.incentive.doubleRate, base).incentive;
            }

            // 2. Calculate Monthly Incentive Delta
            const salesUpToToday = monthSales.slice(0, i + 1);
            const salesUpToYesterday = monthSales.slice(0, i);
            const yesterdayTimestamp = i > 0 ? new Date(monthSales[i-1].createdAt || monthSales[i-1].date) : new Date(saleDate.setDate(saleDate.getDate() - 1));
            const monthlyRuleYesterday = findHistoricalRule(allRules.monthly, yesterdayTimestamp) as MonthlyRule | null;
            
            const cumulativeMonthlyToday = calculateTotalCumulativeMonthly(salesUpToToday, staff, monthlyRule);
            const cumulativeMonthlyYesterday = calculateTotalCumulativeMonthly(salesUpToYesterday, staff, monthlyRuleYesterday);
            const monthlyIncentiveDelta = cumulativeMonthlyToday - cumulativeMonthlyYesterday;

            // 3. Calculate Package Incentive for THIS DAY
            let packageIncentiveToday = 0;
            if (packageRule) {
                const totalPackageSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.packageSale || 0), 0);
                const { isTargetMet, appliedRate } = calculateIncentive(totalPackageSaleMonth, packageRule.target.targetValue, packageRule.incentive.rate, packageRule.incentive.doubleRate, totalPackageSaleMonth);
                if (isTargetMet) {
                    packageIncentiveToday = (currentSale.packageSale || 0) * appliedRate;
                }
            }

            // 4. Calculate Gift Card Incentive for THIS DAY
            let giftCardIncentiveToday = 0;
            if (giftCardRule) {
                const totalGiftCardSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.giftCardSale || 0), 0);
                const { isTargetMet, appliedRate } = calculateIncentive(totalGiftCardSaleMonth, giftCardRule.target.targetValue, giftCardRule.incentive.rate, giftCardRule.incentive.doubleRate, totalGiftCardSaleMonth);
                if (isTargetMet) {
                    giftCardIncentiveToday = (currentSale.giftCardSale || 0) * appliedRate;
                }
            }
            
            // 5. Sum up all incentives for the day and add to the grand total
            totalEarned += dailyIncentive + monthlyIncentiveDelta + packageIncentiveToday + giftCardIncentiveToday;
        }
    }
    
    return parseFloat(totalEarned.toFixed(2));
};

// ===================================================================
// ✅ END: Updated Incentive Calculation Logic
// ===================================================================


export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.tenantId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { id: staffId, tenantId } = session.user;

    try {
        await dbConnect();
        
        // --- Calculate all financial data in parallel for efficiency ---
        const [totalEarned, approvedPayouts, history] = await Promise.all([
            // This now calls the new, updated calculation function
            calculateTotalEarned(staffId, tenantId),
            Payout.find({ staff: staffId, tenantId, status: 'approved' }).lean(),
            Payout.find({ staff: staffId, tenantId }).sort({ createdAt: -1 }).lean()
        ]);

        const totalPaid = approvedPayouts.reduce((sum, p) => sum + p.amount, 0);
        const balance = totalEarned - totalPaid;

        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    totalEarned: parseFloat(totalEarned.toFixed(2)),
                    totalPaid: parseFloat(totalPaid.toFixed(2)),
                    balance: parseFloat(balance.toFixed(2)),
                },
                history,
            }
        });

    } catch (error: any) {
        console.error("API Error in GET /staff/payouts:", error);
        return NextResponse.json({ success: false, error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}


export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.tenantId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
     const { id: staffId, tenantId } = session.user;

    try {
        await dbConnect();
        const body = await request.json();
        const { amount, reason } = body;

        if (!amount || !reason || amount <= 0) {
            return NextResponse.json({ success: false, error: 'A valid amount and reason are required.' }, { status: 400 });
        }

        // --- Validate against available balance before creating request ---
        // This also uses the new calculation logic to get the correct balance
        const totalEarned = await calculateTotalEarned(staffId, tenantId);
        const committedPayouts = await Payout.find({ staff: staffId, tenantId, status: { $in: ['approved', 'pending']} }).lean();
        const totalUnavailable = committedPayouts.reduce((sum, p) => sum + p.amount, 0);
        const availableBalance = totalEarned - totalUnavailable;

        if (amount > availableBalance) {
             return NextResponse.json({ success: false, error: `Requested amount exceeds available balance of ₹${availableBalance.toFixed(2)}.` }, { status: 400 });
        }

        const newPayout = new Payout({
            staff: staffId,
            tenantId,
            amount,
            reason,
            status: 'pending'
        });
        await newPayout.save();

        return NextResponse.json({ success: true, data: newPayout });
    } catch (error: any) {
        console.error("API Error in POST /staff/payouts:", error);
        return NextResponse.json({ success: false, error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}