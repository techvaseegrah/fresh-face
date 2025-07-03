// app/api/salary/calculate/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Staff from '@/models/staff';
import ShopSetting from '@/models/ShopSetting';
// ✅ FIX 1: Import the IAttendance interface alongside the default model export
import Attendance, { IAttendance } from '@/models/Attendance';
import { NextRequest } from 'next/server';

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
    await dbConnect();
    const payload: SalaryCalculationPayload = await req.json();

    const [staff, settings] = await Promise.all([
        Staff.findById(payload.staffId).lean(),
        ShopSetting.findOne({ key: 'defaultSettings' }).lean()
    ]);

    if (!staff) { return NextResponse.json({ success: false, error: 'Staff member not found' }, { status: 404 }); }
    if (!settings) { return NextResponse.json({ success: false, error: 'Shop settings are not configured.' }, { status: 400 }); }

    const baseSalary = staff.salary || 0;
    const otRate = settings.defaultOtRate;
    const extraDayRate = settings.defaultExtraDayRate;
    let finalOtHours = payload.otHours ?? 0;

    if (payload.otHours === undefined || payload.otHours === null) {
        const monthIndex = new Date(`${payload.month} 1, ${payload.year}`).getMonth();
        const startDate = new Date(payload.year, monthIndex, 1);
        const endDate = new Date(payload.year, monthIndex + 1, 0, 23, 59, 59);

        const attendanceRecords = await Attendance.find({
            staffId: staff._id,
            date: { $gte: startDate, $lte: endDate }
        }).lean();

        // ✅ FIX 2: Explicitly type the parameters for the .reduce() function
        const totalOt = attendanceRecords.reduce((total: number, record: IAttendance) => {
            return total + (record.overtimeHours || 0);
        }, 0); // Also ensure there is an initial value (0) for the accumulator
        
        finalOtHours = Math.round(totalOt * 100) / 100;
    }

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