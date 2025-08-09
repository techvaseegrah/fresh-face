import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Shift from '../../../models/Shift';

/**
 * Helper to normalize date to YYYY-MM-DD string for comparison/storage
 * and ensure it's a Date object at UTC start of day for MongoDB
 */
const normalizeDateForDB = (dateInput: string | Date): Date => {
  const d = new Date(dateInput);
  d.setUTCHours(0, 0, 0, 0); // Set to start of day UTC
  return d;
};


/**
 * GET: Fetch shifts for a given date range (e.g., a week)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    console.log('GET /api/shifts: Connecting to DB...');
    await dbConnect();
    console.log(`GET /api/shifts: DB Connected in ${Date.now() - startTime}ms`);

    const { searchParams } = request.nextUrl;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ success: false, error: 'startDate and endDate are required' }, { status: 400 });
    }

    const startDate = normalizeDateForDB(startDateParam);
    const endDate = normalizeDateForDB(endDateParam);
    
    // Adjust end date to capture the whole day for querying range
    endDate.setUTCHours(23, 59, 59, 999);


    console.log(`GET /api/shifts: Fetching shifts from ${startDate.toISOString()} to ${endDate.toISOString()}...`);
    const shiftsFetchStartTime = Date.now();
    const shifts = await Shift.find({
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    }).lean(); // Use .lean() for faster query results as we don't need Mongoose models methods
    console.log(`GET /api/shifts: Shifts fetched in ${Date.now() - shiftsFetchStartTime}ms. Found ${shifts.length} shifts.`);

    // Ensure dates returned are consistently formatted (e.g., YYYY-MM-DD) for client
    const formattedShifts = shifts.map(shift => ({
        ...shift,
        date: shift.date.toISOString().split('T')[0] // Format to YYYY-MM-DD string
    }));

    console.log(`GET /api/shifts: Total duration: ${Date.now() - startTime}ms`);
    return NextResponse.json({ success: true, data: formattedShifts });
  } catch (error) {
    console.error('Error fetching shifts:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, error: `Failed to fetch shifts: ${message}` }, { status: 500 });
  }
}

/**
 * POST: Bulk create or update shifts (Upsert)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    console.log('POST /api/shifts: Connecting to DB...');
    await dbConnect();
    console.log(`POST /api/shifts: DB Connected in ${Date.now() - startTime}ms`);

    // Assuming shiftsToSave can optionally have _id for existing documents
    const shiftsToSave: Array<{ _id?: string; employeeId: string; date: string; isWeekOff: boolean; shiftTiming: string }> = await request.json();

    if (!Array.isArray(shiftsToSave) || shiftsToSave.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid or empty data payload' }, { status: 400 });
    }
    
    console.log(`POST /api/shifts: Preparing ${shiftsToSave.length} bulk operations...`);
    const bulkOpsPrepareTime = Date.now();
    const bulkOps = shiftsToSave.map(shift => {
      const normalizedDate = normalizeDateForDB(shift.date); // Normalize date for DB

      // Use _id for direct update if provided, otherwise rely on employeeId + normalized date for upsert
      // This ensures that existing shifts are updated by their unique ID if available.
      const filter: any = shift._id ? { _id: shift._id } : { 
        employeeId: shift.employeeId, 
        date: normalizedDate 
      };

      return {
        updateOne: {
          filter: filter,
          update: {
            $set: {
              isWeekOff: shift.isWeekOff,
              shiftTiming: shift.shiftTiming,
              employeeId: shift.employeeId,
              date: normalizedDate // Store normalized date
            }
          },
          upsert: true, // This is the key: it creates the doc if it doesn't exist
        },
      };
    });
    console.log(`POST /api/shifts: Bulk ops prepared in ${Date.now() - bulkOpsPrepareTime}ms.`);

    console.log('POST /api/shifts: Executing bulk write...');
    const bulkWriteStartTime = Date.now();
    const result = await Shift.bulkWrite(bulkOps);
    console.log(`POST /api/shifts: Bulk write completed in ${Date.now() - bulkWriteStartTime}ms.`);

    console.log(`POST /api/shifts: Total duration: ${Date.now() - startTime}ms`);
    return NextResponse.json({ success: true, data: result }, { status: 200 });

  } catch (error) {
    console.error('Error saving shifts:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, error: `Failed to save shifts: ${message}` }, { status: 500 });
  }
}