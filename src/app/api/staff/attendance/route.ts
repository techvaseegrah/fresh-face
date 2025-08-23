import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Attendance, { IAttendance } from '@/models/Attendance';
import { startOfMonth, endOfMonth } from 'date-fns';

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.tenantId || session.user.role.name !== 'staff') {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const staffId = session.user.id;
    const tenantId = session.user.tenantId;

    const { searchParams } = request.nextUrl;
    const year = parseInt(searchParams.get('year')!, 10);
    const month = parseInt(searchParams.get('month')!, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return NextResponse.json({ success: false, error: 'Invalid year or month' }, { status: 400 });
    }

    try {
        await dbConnect();

        const startDate = startOfMonth(new Date(year, month - 1));
        const endDate = endOfMonth(new Date(year, month - 1));

        // Fetch all relevant records for the staff member for the entire month
        const records = await Attendance.find({
            staffId: staffId,
            tenantId: tenantId,
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 'asc' }).lean<IAttendance[]>();
        
        // --- THE FIX: EXACT LOGIC REPLICATION ---
        // Calculate required minutes exactly like the admin panel:
        // Sum 'requiredMinutes' ONLY for records with 'present' or 'incomplete' status.
        const requiredMonthlyMinutes = records.reduce((total: number, record: IAttendance) => {
            if (record.status === 'present' || record.status === 'incomplete') {
                return total + (record.requiredMinutes || 0);
            }
            return total;
        }, 0);

        return NextResponse.json({
            success: true,
            data: {
                records: records,
                summary: {
                    requiredMonthlyMinutes,
                }
            }
        });

    } catch (error) {
        console.error("API Error fetching staff attendance:", error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}