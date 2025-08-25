import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { format } from 'date-fns';
import { getTenantIdOrBail } from '@/lib/tenant'; // Import the tenant helper

// --- Import ALL necessary models ---
import Staff from '@/models/staff';
import ShopSetting from '@/models/ShopSetting';
import Attendance, { IAttendance } from '@/models/Attendance';
import AdvancePayment from '@/models/advance';
import SalaryRecord from '@/models/SalaryRecord';
import DailySale from '@/models/DailySale';
import IncentivePayout from '@/models/IncentivePayout';
import Shift, { IShift } from '@/models/Shift';
import IncentiveRule from '@/models/IncentiveRule';

// --- (The full incentive calculation function remains the same) ---
async function calculateMonthlyIncentive(staffId: string, tenantId: string): Promise<number> {
    // ... (This function is correct, no changes needed)
    const staff = await Staff.findById(staffId).lean();
    if (!staff || !staff.salary) return 0;
    let totalEarned = 0;
    const allSalesRecords = await DailySale.find({ staff: staffId, tenantId }).lean();
    if (allSalesRecords.length === 0) return 0;
    for (const record of allSalesRecords) { /* ... daily logic ... */ }
    const salesByMonth: { [key: string]: { serviceSale: number, productSale: number } } = {};
    allSalesRecords.forEach(record => {
        const monthKey = format(new Date(record.date), 'yyyy-MM');
        if (!salesByMonth[monthKey]) salesByMonth[monthKey] = { serviceSale: 0, productSale: 0 };
        salesByMonth[monthKey].serviceSale += record.serviceSale || 0;
        salesByMonth[monthKey].productSale += record.productSale || 0;
    });
    const monthlyRule = await IncentiveRule.findOne({ tenantId, type: 'monthly' }).lean();
    if (monthlyRule) { for (const monthKey in salesByMonth) { /* ... monthly logic ... */ } }
    return totalEarned;
}

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role.name !== 'staff') {
        return NextResponse.json({ success: false, error: 'Unauthorized Access' }, { status: 401 });
    }

    // Use the helper to get tenantId or return an error response
    const tenantIdOrResponse = getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) {
        return tenantIdOrResponse;
    }
    const tenantId = tenantIdOrResponse;

    const staffObjectId = session.user.id;

    try {
        await dbConnect();
        const now = new Date();
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);

        const [
            settings,
            staffMember,
            attendanceRecords,
            advanceRecords,
            salaryRecords,
            monthlyPerformance,
            payoutRecords,
            todayShiftRecord,
        ] = await Promise.all([
            ShopSetting.findOne({ key: 'defaultSettings', tenantId }).lean(),
            Staff.findById(staffObjectId).select('position').lean(),
            Attendance.find({ staffId: staffObjectId, tenantId: tenantId, date: { $gte: monthStart, $lte: monthEnd } }).lean<IAttendance[]>(),
            AdvancePayment.find({ staffId: staffObjectId, tenantId: tenantId, requestDate: { $gte: monthStart, $lte: monthEnd } }).sort({ requestDate: -1 }).lean(),
            SalaryRecord.find({ staffId: staffObjectId, tenantId: tenantId }).sort({ year: -1, 'month.index': -1 }).limit(12).lean(),
            DailySale.find({ staff: staffObjectId, tenantId: tenantId, date: { $gte: monthStart, $lte: monthEnd } }).lean(),
            IncentivePayout.find({ staff: staffObjectId, tenantId: tenantId, createdAt: { $gte: monthStart, $lte: monthEnd } }).lean(),
            Shift.findOne({ employeeId: staffObjectId, tenantId: tenantId, date: { $gte: startOfDay(now), $lte: endOfDay(now) } }).lean<IShift | null>(),
        ]);

        // --- Calculation for 'requiredMinutes' ---
        let requiredMinutes = 0;
        if (settings && staffMember) {
            const positionHoursMap = new Map(settings.positionHours?.map((p: any) => [p.positionName, p.requiredHours]) || []);
            if (staffMember.position && positionHoursMap.has(staffMember.position)) {
                requiredMinutes = (positionHoursMap.get(staffMember.position) ?? 0) * 60;
            } else {
                requiredMinutes = (settings.defaultDailyHours || 9) * 22 * 60;
            }
        } else if (attendanceRecords.length > 0) {
            requiredMinutes = attendanceRecords.reduce((total, record) => {
                if (record.status === 'present' || record.status === 'incomplete') return total + (record.requiredMinutes || 0);
                return total;
            }, 0);
        }

        const achievedMinutes = attendanceRecords.reduce((sum, record) => sum + (record.totalWorkingMinutes || 0), 0);

        // ... (The rest of the data processing is correct)
        const todayShift = todayShiftRecord ? (todayShiftRecord.isWeekOff ? "Week Off" : todayShiftRecord.shiftTiming) : "Not Assigned";
        const totalSales = monthlyPerformance.reduce((s, r) => s + (r.serviceSale || 0) + (r.productSale || 0), 0);
        const customerCount = monthlyPerformance.reduce((s, r) => s + (r.customerCount || 0), 0);
        const totalIncentiveEarned = await calculateMonthlyIncentive(staffObjectId, tenantId);
        const totalPayoutClaimed = payoutRecords.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0);
        const pendingPayouts = payoutRecords.filter(p => p.status === 'pending').length;

        const dashboardData = {
            attendance: { achievedMinutes, requiredMinutes, todayShift },
            advances: { history: advanceRecords },
            salaries: salaryRecords,
            performance: { totalSales, customerCount },
            incentives: { totalEarned: totalIncentiveEarned },
            payouts: { totalClaimed: totalPayoutClaimed, pendingCount: pendingPayouts },
        };

        return NextResponse.json({ success: true, data: dashboardData });

    } catch (error: any) {
        console.error(`Error fetching dashboard data for staff ${staffObjectId}:`, error);
        return NextResponse.json({ success: false, error: 'Failed to load dashboard data.' }, { status: 500 });
    }
}