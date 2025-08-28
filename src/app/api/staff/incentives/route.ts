import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Staff from '@/models/staff';
import DailySale, { IDailySale } from '@/models/DailySale';
import IncentiveRule from '@/models/IncentiveRule';

// --- Type Definition to help TypeScript understand the Rule object ---
interface IRule {
    target: { multiplier: number };
    sales: { includeServiceSale: boolean; includeProductSale: boolean; reviewNameValue: number; reviewPhotoValue: number };
    incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly' };
}

// --- Helper Functions ---
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const calculateIncentive = (achieved: number, target: number, rate: number, doubleRate: number, base: number) => {
    if (achieved < target) return { amount: 0, appliedRate: 0 };
    const appliedRate = achieved >= (target * 2) ? doubleRate : rate;
    return { amount: base * appliedRate, appliedRate };
};

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    // The tenantId is securely retrieved from the user's session
    if (!session?.user?.id || !session.user.tenantId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const staffId = session.user.id;
    const tenantId = session.user.tenantId; // Tenant ID is ready to be used

    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const dateQuery = searchParams.get('date');

        if (!dateQuery) {
            return NextResponse.json({ success: false, error: 'A date is required.' }, { status: 400 });
        }

        // ✅ MODIFICATION: The query for Staff now includes the tenantId.
        // This ensures a staff member can only retrieve their own record from within their assigned tenant.
        const staff = await Staff.findOne({ _id: staffId, tenantId: tenantId }).lean();
        if (!staff || !staff.salary) {
            return NextResponse.json({ success: false, error: 'Cannot calculate: Your salary is not set.' }, { status: 400 });
        }

        const targetDate = new Date(dateQuery);
        const [year, month, day] = [targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()];

        // --- Daily Incentive Calculation ---
        // This query correctly uses the tenantId
        const dailySaleRecord = await DailySale.findOne({ staff: staffId, tenantId: tenantId, date: targetDate }).lean<IDailySale>();
        let dailyResult = {};

        if (dailySaleRecord && dailySaleRecord.appliedRule) {
            const rule = dailySaleRecord.appliedRule as IRule;
            const daysInMonth = getDaysInMonth(year, month);
            const target = (staff.salary * rule.target.multiplier) / daysInMonth;
            const achieved = (rule.sales.includeServiceSale ? (dailySaleRecord.serviceSale || 0) : 0) +
                           (rule.sales.includeProductSale ? (dailySaleRecord.productSale || 0) : 0) +
                           ((dailySaleRecord.reviewsWithName || 0) * rule.sales.reviewNameValue) +
                           ((dailySaleRecord.reviewsWithPhoto || 0) * rule.sales.reviewPhotoValue);
            const base = rule.incentive.applyOn === 'serviceSaleOnly' ? (dailySaleRecord.serviceSale || 0) : achieved;
            const { amount, appliedRate } = calculateIncentive(achieved, target, rule.incentive.rate, rule.incentive.doubleRate, base);

            dailyResult = { target, achieved, isTargetMet: achieved >= target, incentiveAmount: amount, appliedRate };
        }

        // --- Monthly Incentive Calculation ---
        // This query correctly uses the tenantId
        const monthlyRule = await IncentiveRule.findOne({ tenantId: tenantId, type: 'monthly' }).lean<IRule>();
        let monthlyResult = {};
        
        if (monthlyRule) {
             const monthStart = new Date(Date.UTC(year, month, 1));
             // This query also correctly uses the tenantId
             const monthlySales = await DailySale.find({ staff: staffId, tenantId: tenantId, date: { $gte: monthStart, $lte: targetDate } }).lean();
             const totalMonthlyService = monthlySales.reduce((sum, s) => sum + (s.serviceSale || 0), 0);
             const target = staff.salary * monthlyRule.target.multiplier;
             const { amount, appliedRate } = calculateIncentive(totalMonthlyService, target, monthlyRule.incentive.rate, monthlyRule.incentive.doubleRate, totalMonthlyService);
             
             monthlyResult = { target, achieved: totalMonthlyService, isTargetMet: totalMonthlyService >= target, incentiveAmount: amount, appliedRate };
        }

        return NextResponse.json({ success: true, data: { daily: dailyResult, monthly: monthlyResult } });

    } catch (error: any) {
        console.error("API Error fetching staff incentives:", error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}