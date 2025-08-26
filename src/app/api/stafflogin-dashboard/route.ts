import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { getTenantIdOrBail } from '@/lib/tenant'; 
import { decrypt } from '@/lib/crypto'; // Make sure to import decrypt

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
import Appointment from '@/models/Appointment'; // <-- ADD THIS: Import Appointment model
import Customer from '@/models/customermodel'; // <-- ADD THIS: Import Customer model
import ServiceItem from '@/models/ServiceItem'; // <-- ADD THIS: Import ServiceItem model


// --- (Helper functions like calculateIncentive, IRule interface remain unchanged) ---
interface IRule {
    target: { multiplier: number };
    sales: { includeServiceSale: boolean; includeProductSale: boolean; reviewNameValue: number; reviewPhotoValue: number };
    incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly' };
}
const calculateIncentive = (achieved: number, target: number, rate: number, doubleRate: number, base: number) => {
    if (achieved < target) return { amount: 0, appliedRate: 0 };
    const appliedRate = achieved >= (target * 2) ? doubleRate : rate;
    return { amount: base * appliedRate, appliedRate };
};
async function calculateMonthlyIncentive(staffId: string, tenantId: string, monthStart: Date, monthEnd: Date): Promise<number> {
    const staff = await Staff.findById(staffId).lean();
    if (!staff || !staff.salary) {
        return 0;
    }
    let totalEarned = 0;
    const monthlySalesRecords = await DailySale.find({
        staff: staffId,
        tenantId,
        date: { $gte: monthStart, $lte: monthEnd }
    }).lean();
    if (monthlySalesRecords.length === 0) {
        return 0;
    }
    for (const dailyRecord of monthlySalesRecords) {
        if (dailyRecord.appliedRule) {
            const rule = dailyRecord.appliedRule as IRule;
            const recordDate = new Date(dailyRecord.date);
            const daysInMonth = new Date(recordDate.getFullYear(), recordDate.getMonth() + 1, 0).getDate();
            const target = (staff.salary * rule.target.multiplier) / daysInMonth;
            const achieved = (rule.sales.includeServiceSale ? (dailyRecord.serviceSale || 0) : 0) +
                           (rule.sales.includeProductSale ? (dailyRecord.productSale || 0) : 0) +
                           ((dailyRecord.reviewsWithName || 0) * rule.sales.reviewNameValue) +
                           ((dailyRecord.reviewsWithPhoto || 0) * rule.sales.reviewPhotoValue);
            const base = rule.incentive.applyOn === 'serviceSaleOnly' ? (dailyRecord.serviceSale || 0) : achieved;
            const { amount } = calculateIncentive(achieved, target, rule.incentive.rate, rule.incentive.doubleRate, base);
            totalEarned += amount;
        }
    }
    const monthlyRule = await IncentiveRule.findOne({ tenantId, type: 'monthly' }).lean<IRule>();
    if (monthlyRule) {
        const totalMonthlyServiceSale = monthlySalesRecords.reduce((sum, s) => sum + (s.serviceSale || 0), 0);
        const target = staff.salary * monthlyRule.target.multiplier;
        const { amount } = calculateIncentive(totalMonthlyServiceSale, target, monthlyRule.incentive.rate, monthlyRule.incentive.doubleRate, totalMonthlyServiceSale);
        totalEarned += amount;
    }
    return totalEarned;
}
// --- END of unchanged helper functions ---


export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role.name !== 'staff') {
        return NextResponse.json({ success: false, error: 'Unauthorized Access' }, { status: 401 });
    }

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
        const todayStart = startOfDay(now); // <-- ADD THIS: Get start of today
        const todayEnd = endOfDay(now);     // <-- ADD THIS: Get end of today

        const [
            settings,
            staffMember,
            attendanceRecords,
            advanceRecords,
            salaryRecords,
            monthlyPerformance,
            payoutRecords,
            todayShiftRecord,
            todaysAppointments, // <-- ADD THIS: Fetch today's appointments
        ] = await Promise.all([
            ShopSetting.findOne({ key: 'defaultSettings', tenantId }).lean(),
            Staff.findById(staffObjectId).select('position').lean(),
            Attendance.find({ staffId: staffObjectId, tenantId: tenantId, date: { $gte: monthStart, $lte: monthEnd } }).lean<IAttendance[]>(),
            AdvancePayment.find({ staffId: staffObjectId, tenantId: tenantId, requestDate: { $gte: monthStart, $lte: monthEnd } }).sort({ requestDate: -1 }).lean(),
            SalaryRecord.find({ staffId: staffObjectId, tenantId: tenantId }).sort({ year: -1, 'month.index': -1 }).limit(12).lean(),
            DailySale.find({ staff: staffObjectId, tenantId: tenantId, date: { $gte: monthStart, $lte: monthEnd } }).lean(),
            IncentivePayout.find({ staff: staffObjectId, tenantId: tenantId, createdAt: { $gte: monthStart, $lte: monthEnd } }).lean(),
            Shift.findOne({ employeeId: staffObjectId, tenantId: tenantId, date: { $gte: startOfDay(now), $lte: endOfDay(now) } }).lean<IShift | null>(),
            // --- V ADDED LOGIC V ---
            Appointment.find({
                stylistId: staffObjectId,
                tenantId: tenantId,
                appointmentDateTime: { $gte: todayStart, $lte: todayEnd },
                status: { $in: ['Appointment', 'Checked-In'] } // Filter for relevant statuses
            })
            .populate({ 
                path: 'customerId', 
                select: 'name' 
            })
            .populate({
                path: 'serviceIds',
                select: 'name'
            })
            .sort({ appointmentDateTime: 1 }) // Sort by time
            .lean(),
            // --- ^ ADDED LOGIC ^ ---
        ]);

        // --- (Calculations for requiredMinutes, achievedMinutes, etc. remain unchanged) ---
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
        const todayShift = todayShiftRecord ? (todayShiftRecord.isWeekOff ? "Week Off" : todayShiftRecord.shiftTiming) : "Not Assigned";
        const totalSales = monthlyPerformance.reduce((s, r) => s + (r.serviceSale || 0) + (r.productSale || 0), 0);
        const customerCount = monthlyPerformance.reduce((s, r) => s + (r.customerCount || 0), 0);
        const totalIncentiveEarned = await calculateMonthlyIncentive(staffObjectId, tenantId, monthStart, monthEnd);
        const totalPayoutClaimed = payoutRecords.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0);
        const pendingPayouts = payoutRecords.filter(p => p.status === 'pending').length;

        // --- V ADDED LOGIC V ---
        // Decrypt customer names for the appointments
        const decryptedAppointments = todaysAppointments.map(apt => {
            let decryptedCustomerName = 'Decryption Error';
            if ((apt.customerId as any)?.name) {
                try {
                    decryptedCustomerName = decrypt((apt.customerId as any).name);
                } catch (e) {
                    console.error(`Failed to decrypt customer name for appointment ${apt._id}`);
                }
            }
            return {
                ...apt,
                customerName: decryptedCustomerName,
                services: (apt.serviceIds as any[]).map(s => s.name).join(', '),
                time: new Date(apt.appointmentDateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
            };
        });
        // --- ^ ADDED LOGIC ^ ---


        const dashboardData = {
            attendance: { achievedMinutes, requiredMinutes, todayShift },
            advances: { history: advanceRecords },
            salaries: salaryRecords,
            performance: { totalSales, customerCount },
            incentives: { totalEarned: totalIncentiveEarned },
            payouts: { totalClaimed: totalPayoutClaimed, pendingCount: pendingPayouts },
            todaysAppointments: decryptedAppointments, // <-- ADD THIS: Attach the appointment data
        };

        return NextResponse.json({ success: true, data: dashboardData });

    } catch (error: any) {
        console.error(`Error fetching dashboard data for staff ${staffObjectId}:`, error);
        return NextResponse.json({ success: false, error: 'Failed to load dashboard data.' }, { status: 500 });
    }
}