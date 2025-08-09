// app/api/shifts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Shift from '../../../models/Shift';

// TENANT-AWARE: Import the tenant helper
import { getTenantIdOrBail } from '@/lib/tenant';

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
 * GET: Fetch shifts for a given date range (e.g., a week), scoped to a tenant.
 */
export async function GET(request: NextRequest) {
  // TENANT-AWARE: Get tenant ID or exit
  const tenantIdOrResponse = getTenantIdOrBail(request);
  if (tenantIdOrResponse instanceof NextResponse) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;

  const startTime = Date.now();
  try {
    console.log(`GET /api/shifts for tenant ${tenantId}: Connecting to DB...`);
    await dbConnect();
    console.log(`GET /api/shifts for tenant ${tenantId}: DB Connected in ${Date.now() - startTime}ms`);

    const { searchParams } = request.nextUrl;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ success: false, error: 'startDate and endDate are required' }, { status: 400 });
    }

    const startDate = normalizeDateForDB(startDateParam);
    const endDate = normalizeDateForDB(endDateParam);
    endDate.setUTCHours(23, 59, 59, 999);

    console.log(`GET /api/shifts for tenant ${tenantId}: Fetching shifts from ${startDate.toISOString()} to ${endDate.toISOString()}...`);
    const shiftsFetchStartTime = Date.now();
    
    // TENANT-AWARE: Add tenantId to the query for data isolation.
    const shifts = await Shift.find({
      date: {
        $gte: startDate,
        $lte: endDate,
      },
      tenantId: tenantId, // <-- Crucial for isolation
    }).lean();
    
    console.log(`GET /api/shifts for tenant ${tenantId}: Shifts fetched in ${Date.now() - shiftsFetchStartTime}ms. Found ${shifts.length} shifts.`);

    const formattedShifts = shifts.map(shift => ({
        ...shift,
        date: shift.date.toISOString().split('T')[0]
    }));

    console.log(`GET /api/shifts for tenant ${tenantId}: Total duration: ${Date.now() - startTime}ms`);
    return NextResponse.json({ success: true, data: formattedShifts });
  } catch (error) {
    console.error(`Error fetching shifts for tenant ${tenantId}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, error: `Failed to fetch shifts: ${message}` }, { status: 500 });
  }
}

/**
 * POST: Bulk create or update shifts (Upsert), scoped to a tenant.
 */
export async function POST(request: NextRequest) {
  // TENANT-AWARE: Get tenant ID or exit
  const tenantIdOrResponse = getTenantIdOrBail(request);
  if (tenantIdOrResponse instanceof NextResponse) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;

  const startTime = Date.now();
  try {
    console.log(`POST /api/shifts for tenant ${tenantId}: Connecting to DB...`);
    await dbConnect();
    console.log(`POST /api/shifts for tenant ${tenantId}: DB Connected in ${Date.now() - startTime}ms`);

    const shiftsToSave: Array<{ _id?: string; employeeId: string; date: string; isWeekOff: boolean; shiftTiming: string }> = await request.json();

    if (!Array.isArray(shiftsToSave) || shiftsToSave.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid or empty data payload' }, { status: 400 });
    }
    
    console.log(`POST /api/shifts for tenant ${tenantId}: Preparing ${shiftsToSave.length} bulk operations...`);
    const bulkOpsPrepareTime = Date.now();

    const bulkOps = shiftsToSave.map(shift => {
      const normalizedDate = normalizeDateForDB(shift.date);

      // TENANT-AWARE: The filter MUST include tenantId for security.
      // This prevents a user from one tenant updating another's shift even if they guess an _id.
      const filter: any = shift._id 
          ? { _id: shift._id, tenantId: tenantId } 
          : { employeeId: shift.employeeId, date: normalizedDate, tenantId: tenantId };

      return {
        updateOne: {
          filter: filter,
          update: {
            $set: {
              isWeekOff: shift.isWeekOff,
              shiftTiming: shift.shiftTiming,
              employeeId: shift.employeeId,
              date: normalizedDate,
              tenantId: tenantId, // TENANT-AWARE: Ensure tenantId is written on create/update.
            }
          },
          upsert: true, // Creates the doc if it doesn't exist, with the tenantId from $set.
        },
      };
    });
    console.log(`POST /api/shifts for tenant ${tenantId}: Bulk ops prepared in ${Date.now() - bulkOpsPrepareTime}ms.`);

    console.log(`POST /api/shifts for tenant ${tenantId}: Executing bulk write...`);
    const bulkWriteStartTime = Date.now();
    const result = await Shift.bulkWrite(bulkOps);
    console.log(`POST /api/shifts for tenant ${tenantId}: Bulk write completed in ${Date.now() - bulkWriteStartTime}ms.`);

    console.log(`POST /api/shifts for tenant ${tenantId}: Total duration: ${Date.now() - startTime}ms`);
    return NextResponse.json({ success: true, data: result }, { status: 200 });

  } catch (error) {
    console.error(`Error saving shifts for tenant ${tenantId}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, error: `Failed to save shifts: ${message}` }, { status: 500 });
  }
}