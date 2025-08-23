// /app/api/stafflogin-dashboard/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';

// --- Import ALL necessary models ---
import Attendance, { IAttendance } from '@/models/Attendance';
import AdvancePayment from '@/models/advance';
import SalaryRecord from '@/models/SalaryRecord';
import DailySale from '@/models/DailySale';
import IncentivePayout from '@/models/IncentivePayout';
import Shift, { IShift } from '@/models/Shift';

// Helper for incentive calculation (can be expanded later)
async function calculateMonthlyIncentive(staffId: string, tenantId: string): Promise<number> {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const salesRecords = await DailySale.find({ staff: staffId, tenantId, date: { $gte: monthStart, $lte: monthEnd } }).lean();
    const totalServiceSales = salesRecords.reduce((sum, record) => sum + (record.serviceSale || 0), 0);
    // Placeholder logic: 2% of total service sales
    return totalServiceSales * 0.02;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role.name !== 'staff' || !session.user.tenantId) {
    return NextResponse.json({ success: false, error: 'Unauthorized Access' }, { status: 401 });
  }

  const staffObjectId = session.user.id;
  const tenantId = session.user.tenantId;

  try {
    await dbConnect();
    
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const [
      attendanceRecords,
      advanceRecords,
      salaryRecords,
      monthlyPerformance,
      payoutRecords,
      todayShiftRecord,
    ] = await Promise.all([
      // --- THE FIX #1: Correct field name from 'staff' to 'staffId' ---
      Attendance.find({ staffId: staffObjectId, tenantId: tenantId, date: { $gte: monthStart, $lte: monthEnd } }).lean<IAttendance[]>(),
      AdvancePayment.find({ staffId: staffObjectId, requestDate: { $gte: monthStart, $lte: monthEnd } }).sort({ requestDate: -1 }).lean(),
      SalaryRecord.find({ staffId: staffObjectId }).sort({ year: -1, 'month.index': -1 }).limit(12).lean(),
      DailySale.find({ staff: staffObjectId, tenantId, date: { $gte: monthStart, $lte: monthEnd } }).lean(),
      IncentivePayout.find({ staff: staffObjectId, tenantId, createdAt: { $gte: monthStart, $lte: monthEnd } }).lean(),
      Shift.findOne({ employeeId: staffObjectId, tenantId, date: { $gte: todayStart, $lte: todayEnd } }).lean<IShift | null>(),
    ]);

    // --- 1. Process Attendance Data ---
    const achievedMinutes = attendanceRecords.reduce((sum, record) => sum + (record.totalWorkingMinutes || 0), 0);
    
    // --- THE FIX #2: Replicate admin panel logic for required hours ---
    const requiredMinutes = attendanceRecords.reduce((total, record) => {
        if (record.status === 'present' || record.status === 'incomplete') {
            return total + (record.requiredMinutes || 0);
        }
        return total;
    }, 0);

    const todayShift = todayShiftRecord ? (todayShiftRecord.isWeekOff ? "Week Off" : todayShiftRecord.shiftTiming) : "Not Assigned";

    const approvedAdvances = advanceRecords.filter(adv => adv.status === 'approved');
    const totalAdvanceClaimed = approvedAdvances.reduce((sum, adv) => sum + adv.amount, 0);
    const totalSales = monthlyPerformance.reduce((s, r) => s + (r.serviceSale || 0) + (r.productSale || 0), 0);
    const customerCount = monthlyPerformance.reduce((s, r) => s + (r.customerCount || 0), 0);
    const totalIncentiveEarned = await calculateMonthlyIncentive(staffObjectId, tenantId);
    const totalPayoutClaimed = payoutRecords.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0);
    const pendingPayouts = payoutRecords.filter(p => p.status === 'pending').length;

    const dashboardData = {
      attendance: { achievedMinutes, requiredMinutes, todayShift },
      advances: { history: advanceRecords, totalClaimed: totalAdvanceClaimed, approvedCount: approvedAdvances.length },
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