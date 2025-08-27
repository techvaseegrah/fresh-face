import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Payout from '@/models/IncentivePayout';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import IncentiveRule from '@/models/IncentiveRule';
import { format } from 'date-fns';
import { getTenantIdOrBail } from '@/lib/tenant'; // ✅ THE FIX: Import the tenant function

// ... (interface IRule and calculateTotalEarned function remain unchanged) ...
interface IRule {
  target: { multiplier: number };
  sales: { includeServiceSale: boolean; includeProductSale: boolean; reviewNameValue: number; reviewPhotoValue: number };
  incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly' };
}

// --- Re-usable Incentive Calculation Logic ---
const calculateTotalEarned = async (staffId: string, tenantId: string): Promise<number> => {
    const staff = await Staff.findById(staffId).lean();
    if (!staff || !staff.salary) return 0;

    let totalEarned = 0;
    const allSalesRecords = await DailySale.find({ staff: staffId, tenantId }).lean();
    if (allSalesRecords.length === 0) return 0;

    // Daily incentives
    for (const record of allSalesRecords) {
        if (record.appliedRule) {
            const rule = record.appliedRule as IRule;
            const daysInMonth = new Date(record.date.getUTCFullYear(), record.date.getUTCMonth() + 1, 0).getDate();
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

    // Monthly incentives
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
            const monthlyAchieved = (monthlyRule.sales.includeServiceSale ? salesByMonth[monthKey].serviceSale : 0);
            const monthlyBase = monthlyRule.incentive.applyOn === 'serviceSaleOnly' ? salesByMonth[monthKey].serviceSale : monthlyAchieved;
            
            if (monthlyAchieved >= monthlyTarget) {
                 const rate = monthlyAchieved >= (monthlyTarget * 2) ? monthlyRule.incentive.doubleRate : monthlyRule.incentive.rate;
                 totalEarned += monthlyBase * rate;
            }
        }
    }

    return totalEarned;
};

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    // ✅ THE FIX: Get tenant ID or stop execution
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) {
        return tenantId;
    }

    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        
        if (action === 'balance') {
            const totalEarned = await calculateTotalEarned(session.user.id, tenantId);
            // ✅ THE FIX: Ensure tenantId is used in the query
            const approvedPayouts = await Payout.find({ staff: session.user.id, tenantId, status: 'approved' }).lean();
            const totalPaid = approvedPayouts.reduce((sum, p) => sum + p.amount, 0);
            return NextResponse.json({ success: true, data: { balance: totalEarned - totalPaid } });
        }
        
        // ✅ THE FIX: Ensure tenantId is used in the query
        const history = await Payout.find({ staff: session.user.id, tenantId }).sort({ createdAt: -1 }).lean();
        return NextResponse.json({ success: true, data: history });

    } catch (error) {
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    // ✅ THE FIX: Get tenant ID or stop execution
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) {
        return tenantId;
    }

    try {
        await dbConnect();
        const body = await request.json();
        const { amount, reason } = body;

        if (!amount || !reason || amount <= 0) {
            return NextResponse.json({ success: false, error: 'A valid amount and reason are required.' }, { status: 400 });
        }
        
        const totalEarned = await calculateTotalEarned(session.user.id, tenantId);
        // ✅ THE FIX: Ensure tenantId is used in the query
        const committedPayouts = await Payout.find({ staff: session.user.id, tenantId, status: { $in: ['approved', 'pending']} }).lean();
        const totalUnavailable = committedPayouts.reduce((sum, p) => sum + p.amount, 0);
        const balance = totalEarned - totalUnavailable;

        if (amount > balance) {
             return NextResponse.json({ success: false, error: `Requested amount exceeds available balance of ₹${balance.toFixed(2)}.` }, { status: 400 });
        }

        const newPayout = new Payout({
            staff: session.user.id,
            tenantId, // ✅ THE FIX: Add tenantId to the new payout document
            amount,
            reason,
            status: 'pending'
        });
        await newPayout.save();

        return NextResponse.json({ success: true, data: newPayout });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}