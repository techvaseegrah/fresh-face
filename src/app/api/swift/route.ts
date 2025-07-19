import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Staff from '@/models/staff';
import ShiftSchedule from '@/models/ShiftSchedule';
import { startOfWeek, endOfWeek, eachDayOfInterval, formatISO, isValid } from 'date-fns';

/**
 * GET: Fetches a full week's schedule for all active staff.
 */
export async function GET(request: NextRequest) {
  try {
    // --- Step 1: Connect to DB ---
    try {
      await dbConnect();
    } catch (dbError: any) {
      console.error('DATABASE CONNECTION FAILED:', dbError);
      // Return a specific error if DB connection fails
      return NextResponse.json({ message: `Database connection failed: ${dbError.message}` }, { status: 500 });
    }

    // --- Step 2: Process Request Parameters ---
    const { searchParams } = request.nextUrl;
    const dateStr = searchParams.get('date');
    const referenceDate = dateStr ? new Date(dateStr) : new Date();

    // Validate the date to prevent crashes
    if (!isValid(referenceDate)) {
        return NextResponse.json({ message: `Invalid date provided in request: ${dateStr}` }, { status: 400 });
    }

    const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });

    // --- Step 3: Fetch Data from Database ---
    const [activeStaff, weekShifts] = await Promise.all([
      Staff.find({ status: 'active' }).sort({ name: 1 }).lean(),
      ShiftSchedule.find({
        date: { $gte: weekStart, $lte: weekEnd },
      }).lean(),
    ]);

    // --- Step 4: Process and Map Data ---
    const shiftsMap = new Map<string, string>();
    weekShifts.forEach((shift: any) => {
      if (shift && shift.staffId && shift.date) {
        try {
          const dateKey = formatISO(shift.date, { representation: 'date' });
          const mapKey = `${shift.staffId.toString()}-${dateKey}`;
          shiftsMap.set(mapKey, shift.shiftTime);
        } catch (e) {
            console.error('Error processing a single shift record:', shift, e);
        }
      }
    });

    const weeklySchedule = activeStaff.map((staff: any) => {
      const schedule: { [key: string]: string } = {};
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

      weekDays.forEach(day => {
        const dateKey = formatISO(day, { representation: 'date' });
        const mapKey = `${staff._id.toString()}-${dateKey}`;
        schedule[dateKey] = shiftsMap.get(mapKey) || ''; 
      });
      
      return {
        staffId: staff._id.toString(),
        staffName: staff.name,
        schedule,
      };
    });

    return NextResponse.json({ weekStart, weekEnd, schedule: weeklySchedule });

  } catch (error: any) {
    // This is the final "catch-all" for any other unexpected errors.
    console.error('A FATAL UNHANDLED ERROR occurred in GET /api/staffmanagement/swift:', error);
    return NextResponse.json(
        { message: `An unexpected server error occurred: ${error.message}` }, 
        { status: 500 }
    );
  }
}

// The POST function remains the same.
export async function POST(request: NextRequest) {
  // ... (no changes needed here)
}