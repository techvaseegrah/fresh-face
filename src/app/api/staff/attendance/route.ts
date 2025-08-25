import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Attendance, { IAttendance } from '@/models/Attendance';
import ShopSetting from '@/models/ShopSetting';
import Staff from '@/models/staff';
import TemporaryExit from '@/models/TemporaryExit';
import { startOfMonth, endOfMonth } from 'date-fns';
import mongoose from 'mongoose';
// ✅ MODIFICATION: Import your tenant helper function
import { getTenantIdOrBail } from '@/lib/tenant';

interface LeanExit { _id: mongoose.Types.ObjectId; [key: string]: any; }

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role.name !== 'staff' || !session.user.tenantId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ MODIFICATION: Use the tenant helper to get tenantId from header
    const tenantIdOrBail = getTenantIdOrBail(request);
    if (tenantIdOrBail instanceof NextResponse) {
        // If the header is missing, bail out
        return tenantIdOrBail;
    }
    const tenantId = tenantIdOrBail;

    // ✅ MODIFICATION: CRUCIAL security check to prevent header tampering
    if (tenantId !== session.user.tenantId) {
        return NextResponse.json({ success: false, error: 'Forbidden: Mismatched tenant ID' }, { status: 403 });
    }

    const staffId = session.user.id;
    // const tenantId = session.user.tenantId; // No longer needed, as we use the validated one from the header
    const { searchParams } = request.nextUrl;
    const year = parseInt(searchParams.get('year')!, 10);
    const month = parseInt(searchParams.get('month')!, 10);

    if (isNaN(year) || isNaN(month)) {
        return NextResponse.json({ success: false, error: 'Invalid year or month' }, { status: 400 });
    }

    try {
        await dbConnect();
        const startDate = startOfMonth(new Date(year, month - 1));
        const endDate = endOfMonth(new Date(year, month - 1));

        const [settings, staffMember] = await Promise.all([
            // Use the validated tenantId in all database queries
            ShopSetting.findOne({ key: 'defaultSettings', tenantId }).lean(),
            Staff.findById(staffId).select('position').lean()
        ]);

        if (!staffMember) {
            return NextResponse.json({ success: false, error: 'Staff member not found.' }, { status: 404 });
        }

        let monthlyTargetMinutes = 0;
        const positionHoursMap = new Map(settings?.positionHours?.map((p: any) => [p.positionName, p.requiredHours]) || []);
        if (staffMember.position && positionHoursMap.has(staffMember.position)) {
            monthlyTargetMinutes = (positionHoursMap.get(staffMember.position) ?? 0) * 60;
        } else {
            monthlyTargetMinutes = (settings?.defaultDailyHours || 9) * 22 * 60;
        }

        const attendanceRecords = await Attendance.find({
            staffId, 
            tenantId, // Use the validated tenantId
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 'asc' }).lean<IAttendance[]>();

        const exitIds = attendanceRecords.flatMap(record => record.temporaryExits || []);
        const exitsMap = new Map();
        if (exitIds.length > 0) {
            const exits = await TemporaryExit.find({ '_id': { $in: exitIds } }).lean<LeanExit[]>();
            exits.forEach(exit => exitsMap.set(exit._id.toString(), exit));
        }
        
        const finalRecords = attendanceRecords.map(record => {
            const populatedExits = (record.temporaryExits || []).map(exitId => 
                exitsMap.get(exitId.toString())
            ).filter(Boolean);
            return { ...record, temporaryExits: populatedExits };
        });

        return NextResponse.json({
            success: true,
            data: {
                records: finalRecords,
                summary: { requiredMonthlyMinutes: monthlyTargetMinutes }
            }
        });

    } catch (error: any) {
        console.error("API Error fetching staff attendance:", error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}