// pages/api/stafflogin-dashboard/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Attendance, { IAttendance } from '@/models/Attendance';
import StaffAdvance from '@/models/advance';
import StaffSalary from '@/models/SalaryRecord';
import DailySale from '@/models/DailySale';
import IncentivePayout from '@/models/IncentivePayout';
import Shift, { IShift } from '@/models/Shift';
import Setting from '@/models/Setting';
import Staff from '@/models/staff';
import { startOfMonth, endOfMonth, startOfDay, endOfDay, eachDayOfInterval, isWeekend } from 'date-fns';

// --- THE FIX: Added the full function body to satisfy the return type ---
async function calculateMonthlyIncentive(staffId: string, tenantId: string): Promise<number> {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const salesRecords = await DailySale.find({
        staff: staffId,
        tenantId,
        date: { $gte: monthStart, $lte: monthEnd }
    }).lean();

    const totalServiceSales = salesRecords.reduce((sum, record) => sum + (record.serviceSale || 0), 0);
    
    // Placeholder logic: 2% of total service sales for the month
    return totalServiceSales * 0.02;
}

interface ShopSettings {
    settings?: { defaultDailyHours?: number; };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role.name !== 'staff' || !session.user.id) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const staffId = session.user.id;
    const tenantId = session.user.tenantId;

    try {
        await dbConnect();
        
        const now = new Date();
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);

        const [
            advances,
            salaries,
            monthlyAttendance,
            monthlyPerformance,
            payouts,
            todayShiftRecord,
            shopSettings,
            staffMember
        ] = await Promise.all([
            StaffAdvance.find({ staffId, requestDate: { $gte: monthStart, $lte: monthEnd } }).sort({ requestDate: -1 }).limit(10).lean(),
            StaffSalary.find({ staffId, year: now.getFullYear() }).sort({ month: -1 }).limit(10).lean(),
            Attendance.find({ staffId, tenantId, date: { $gte: monthStart, $lte: monthEnd } }).lean<IAttendance[]>(),
            DailySale.find({ staff: staffId, tenantId, date: { $gte: monthStart, $lte: monthEnd } }).lean(),
            IncentivePayout.find({ staff: staffId, tenantId }).lean(),
            Shift.findOne({ employeeId: staffId, tenantId, date: { $gte: todayStart, $lte: todayEnd } }).lean<IShift | null>(),
            Setting.findOne({ tenantId }).lean<ShopSettings | null>(),
            Staff.findById(staffId).select('position').lean()
        ]);

        const achievedMinutes = monthlyAttendance.reduce((sum, record) => sum + (record.totalWorkingMinutes || 0), 0);
        
        let requiredMinutes = monthlyAttendance
            .filter(r => r.status !== 'week_off' && r.status !== 'on_leave')
            .reduce((sum, record) => sum + (record.requiredMinutes || 0), 0);

        if (requiredMinutes === 0 && monthlyAttendance.length === 0) {
            const defaultDailyHours = shopSettings?.settings?.defaultDailyHours || 9;
            const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
            const workingDays = daysInMonth.filter(day => !isWeekend(day)).length;
            requiredMinutes = workingDays * defaultDailyHours * 60;
        }

        const todayShift = todayShiftRecord ? (todayShiftRecord.isWeekOff ? "Week Off" : todayShiftRecord.shiftTiming) : "Not Assigned";
        
        res.status(200).json({
            success: true,
            data: {
                advances: { history: advances, totalClaimed: advances.filter(a=>a.status === 'approved').reduce((s,a)=>s+a.amount,0), approvedCount: advances.filter(a=>a.status === 'approved').length },
                salaries,
                attendance: { achievedMinutes, requiredMinutes, todayShift },
                performance: { 
                    totalSales: monthlyPerformance.reduce((s, r) => s + (r.serviceSale || 0) + (r.productSale || 0), 0),
                    serviceSales: monthlyPerformance.reduce((s, r) => s + (r.serviceSale || 0), 0),
                    productSales: monthlyPerformance.reduce((s, r) => s + (r.productSale || 0), 0),
                    customerCount: monthlyPerformance.reduce((s, r) => s + (r.customerCount || 0), 0)
                },
                incentives: { totalEarned: await calculateMonthlyIncentive(staffId, tenantId as string) },
                payouts: { 
                    totalClaimed: payouts.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0),
                    pendingCount: payouts.filter(p => p.status === 'pending').length
                }
            },
        });

    } catch (error) {
        console.error('Staff Dashboard API Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}