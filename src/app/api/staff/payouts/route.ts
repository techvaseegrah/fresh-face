import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Payout from '@/models/IncentivePayout';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import IncentiveRule from '@/models/IncentiveRule';
import { format } from 'date-fns';

// Define the interface for a rule for type safety
interface IRule {
  target: { multiplier: number };
  sales: { includeServiceSale: boolean; includeProductSale: boolean; reviewNameValue: number; reviewPhotoValue: number };
  incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly' };
}

// --- Re-usable Incentive Calculation Logic (same as your admin-side logic) ---
const calculateTotalEarned = async (staffId: string, tenantId: string): Promise<number> => {
    const staff = await Staff.findById(staffId).lean();
    // If staff has no salary set, they cannot earn incentives
    if (!staff || !staff.salary || staff.salary <= 0) return 0;

    let totalEarned = 0;
    const allSalesRecords = await DailySale.find({ staff: staffId, tenantId }).sort({ date: 1 }).lean();
    if (allSalesRecords.length === 0) return 0;

    // --- Daily Incentives Calculation ---
    for (const record of allSalesRecords) {
        if (record.appliedRule) {
            const rule = record.appliedRule as IRule;
            const recordDate = new Date(record.date);
            // Get days in the specific month of the sale
            const daysInMonth = new Date(recordDate.getUTCFullYear(), recordDate.getUTCMonth() + 1, 0).getDate();
            const dailyTarget = (staff.salary * rule.target.multiplier) / daysInMonth;

            const achieved = (rule.sales.includeServiceSale ? record.serviceSale || 0 : 0) +
                           (rule.sales.includeProductSale ? record.productSale || 0 : 0) +
                           ((record.reviewsWithName || 0) * rule.sales.reviewNameValue) +
                           ((record.reviewsWithPhoto || 0) * rule.sales.reviewPhotoValue);

            const base = rule.incentive.applyOn === 'serviceSaleOnly' ? (record.serviceSale || 0) : achieved;

            if (achieved >= dailyTarget) {
                const rate = achieved >= (dailyTarget * 2) ? rule.incentive.doubleRate : rule.incentive.rate;
                totalEarned += base * rate;
            }
        }
    }

    // --- Monthly Incentives Calculation ---
    const salesByMonth: { [key: string]: { serviceSale: number, productSale: number } } = {};
    allSalesRecords.forEach(record => {
        const monthKey = format(new Date(record.date), 'yyyy-MM');
        if (!salesByMonth[monthKey]) salesByMonth[monthKey] = { serviceSale: 0, productSale: 0 };
        salesByMonth[monthKey].serviceSale += record.serviceSale || 0;
        salesByMonth[monthKey].productSale += record.productSale || 0;
    });

    const monthlyRule = await IncentiveRule.findOne({ tenantId, type: 'monthly' }).lean<IRule>();
    if (monthlyRule) {
        for (const monthKey in salesByMonth) {
            const monthlyTarget = staff.salary * monthlyRule.target.multiplier;
            // Note: Monthly rule might have different logic, adjust as needed.
            // Here, it's assumed to be based on service sales.
            const monthlyAchieved = (monthlyRule.sales.includeServiceSale ? salesByMonth[monthKey].serviceSale : 0);
            const monthlyBase = monthlyRule.incentive.applyOn === 'serviceSaleOnly' ? salesByMonth[monthKey].serviceSale : monthlyAchieved;

            if (monthlyAchieved >= monthlyTarget) {
                 const rate = monthlyAchieved >= (monthlyTarget * 2) ? monthlyRule.incentive.doubleRate : monthlyRule.incentive.rate;
                 totalEarned += monthlyBase * rate;
            }
        }
    }

    return parseFloat(totalEarned.toFixed(2));
};


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
        const totalEarned = await calculateTotalEarned(staffId, tenantId);
        const committedPayouts = await Payout.find({ staff: staffId, tenantId, status: { $in: ['approved', 'pending']} }).lean();
        const totalUnavailable = committedPayouts.reduce((sum, p) => sum + p.amount, 0);
        const availableBalance = totalEarned - totalUnavailable;

        if (amount > availableBalance) {
             return NextResponse.json({ success: false, error: `Requested amount exceeds available balance of ₹${availableBalance.toFixed(2)}.` }, { status: 400 });
        }

        const newPayout = new Payout({
            staff: staffId,
            tenantId, // Ensure tenantId is saved with the request
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