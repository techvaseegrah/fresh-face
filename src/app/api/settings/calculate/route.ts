

import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Staff from '@/models/staff';
import ShopSetting, { IShopSetting } from '@/models/ShopSetting';
import Attendance, { IAttendance } from '@/models/Attendance';
// TENANT-AWARE: Import the tenant helper
import { getTenantIdOrBail } from '@/lib/tenant';

interface SalaryCalculationPayload {
  staffId: string;
  month: string;
  year: number;
  otHours?: number;
  extraDays: number;
  foodDeduction: number;
  recurExpense: number;
  advanceDeducted: number;
}

export async function POST(req: NextRequest) {
  try {
    // TENANT-AWARE: Get tenant ID or exit if it's missing
    const tenantIdOrResponse = getTenantIdOrBail(req);
    if (tenantIdOrResponse instanceof NextResponse) {
        return tenantIdOrResponse;
    }
    const tenantId = tenantIdOrResponse;

    await dbConnect();
    const payload: SalaryCalculationPayload = await req.json();

    // TENANT-AWARE: Scope all database lookups with the tenantId
    const [staff, settings] = await Promise.all([
        // Ensure the staff member belongs to the correct tenant
        Staff.findOne({ _id: payload.staffId, tenantId: tenantId }).lean(),
        // Find the settings specific to this tenant
        ShopSetting.findOne({ key: 'defaultSettings', tenantId: tenantId }).lean<IShopSetting>()
    ]);

    if (!staff) { 
        // This now correctly handles "not found" or "not authorized"
        return NextResponse.json({ success: false, error: 'Staff member not found' }, { status: 404 }); 
    }
    if (!settings) { 
        return NextResponse.json({ success: false, error: 'Shop settings are not configured for this tenant.' }, { status: 400 }); 
    }

    // --- Rate Calculation (Correct) ---
    const positionRate = settings.positionRates?.find(p => p.positionName === staff.position);
    const otRate = positionRate?.otRate ?? settings.defaultOtRate;
    const extraDayRate = positionRate?.extraDayRate ?? settings.defaultExtraDayRate;
    
    let finalOtHours = payload.otHours ?? 0;

    if (payload.otHours === undefined || payload.otHours === null) {
        const monthIndex = new Date(`${payload.month} 1, ${payload.year}`).getMonth();
        const startDate = new Date(payload.year, monthIndex, 1);
        const endDate = new Date(payload.year, monthIndex + 1, 0, 23, 59, 59);

        // TENANT-AWARE: Scope the attendance query with the tenantId as well
        const attendanceRecords = await Attendance.find({
            staffId: staff._id,
            tenantId: tenantId, // Important for defense in depth
            date: { $gte: startDate, $lte: endDate }
        }).lean<IAttendance[]>();

        const requiredDailyHours = settings.defaultDailyHours || 8;

        const totalOt = attendanceRecords.reduce((total, record) => {
            const recordData = record as any; 
            if (recordData.clockInTime && recordData.clockOutTime) {
                const clockIn = new Date(recordData.clockInTime);
                const clockOut = new Date(recordData.clockOutTime);
                const durationMs = clockOut.getTime() - clockIn.getTime();
                const dailyTotalHours = durationMs / (1000 * 60 * 60);
                const dailyOvertime = Math.max(0, dailyTotalHours - requiredDailyHours);
                return total + dailyOvertime;
            }
            return total;
        }, 0);
        
        finalOtHours = Math.round(totalOt * 100) / 100;
    }

    const baseSalary = staff.salary || 0;
    const otAmount = finalOtHours * otRate;
    const extraDayPay = payload.extraDays * extraDayRate;
    const totalEarnings = baseSalary + otAmount + extraDayPay;
    const totalDeductions = payload.foodDeduction + payload.recurExpense + payload.advanceDeducted;
    const netSalary = totalEarnings - totalDeductions;

    return NextResponse.json({
      success: true,
      data: {
        otHours: finalOtHours,
        baseSalary,
        otAmount,
        extraDayPay,
        totalEarnings,
        totalDeductions,
        netSalary,
      },
    });

  } catch (error: any) {
    console.error('Error in /api/salary/calculate:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}