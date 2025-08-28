import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
    // Session retrieval is unchanged, it correctly gets the logged-in user's info.
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.tenantId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ THE CHANGE: Extracted tenantId from the session to use in all database queries.
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

        // ✅ THE CHANGE: Added `tenantId` to the `findById` and `find` queries
        // to ensure data is fetched only for the correct tenant.
        const [staff, dailyRecords] = await Promise.all([
            Staff.findOne({ _id: staffId, tenantId: tenantId }).lean(),
            DailySale.find({
                staff: staffId,
                tenantId: tenantId, // Ensures that sales records are from the same tenant.
                date: { $gte: startDate, $lte: endDate }
            }).sort({ date: -1 }).lean()
        ]);

        if (!staff) {
            // Changed from 404 to 401 for better security; no need to reveal if staff exists.
            return NextResponse.json({ success: false, error: 'Staff member not found for this salon.' }, { status: 401 });
        }
        if (!staff.salary) {
             return NextResponse.json({ success: false, error: 'Your salary is not set, cannot calculate performance targets.' }, { status: 400 });
        }

        // --- The rest of your logic remains unchanged as it correctly processes the data ---
        const dailyBreakdown = dailyRecords.map(rec => {
            let incentive = { target: 0, rate: 0, amount: 0 };
            if (rec.appliedRule) {
                const rule = rec.appliedRule;
                const daysInMonth = new Date(rec.date.getUTCFullYear(), rec.date.getUTCMonth() + 1, 0).getDate();
                const target = (staff.salary! * rule.target.multiplier) / daysInMonth;
                const achieved = (rule.sales.includeServiceSale ? rec.serviceSale || 0 : 0) + (rule.sales.includeProductSale ? rec.productSale || 0 : 0);
                const base = rule.incentive.applyOn === 'serviceSaleOnly' ? (rec.serviceSale || 0) : achieved;
                if (achieved >= target) {
                    const rate = achieved >= (target * 2) ? rule.incentive.doubleRate : rule.incentive.rate;
                    incentive = { target, rate, amount: base * rate };
                } else {
                    incentive = { target, rate: 0, amount: 0 };
                }
            }
            return {
                date: rec.date.toISOString().split('T')[0],
                serviceSale: rec.serviceSale || 0,
                productSale: rec.productSale || 0,
                customerCount: rec.customerCount || 0,
                incentive,
            };
        });

        const summary = dailyBreakdown.reduce((acc, day) => {
            acc.totalServiceSales += day.serviceSale;
            acc.totalProductSales += day.productSale;
            acc.totalCustomers += day.customerCount;
            return acc;
        }, { totalServiceSales: 0, totalProductSales: 0, totalCustomers: 0 });

        const totalSales = summary.totalServiceSales + summary.totalProductSales;
        
        const performanceData = {
            summary: {
                totalSales,
                totalServiceSales: summary.totalServiceSales,
                totalProductSales: summary.totalProductSales, 
                totalCustomers: summary.totalCustomers,
            },
            dailyBreakdown: dailyBreakdown
        };
        
        return NextResponse.json({ success: true, data: performanceData });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}