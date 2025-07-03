import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';

// This route handles POST requests to reset (delete) a daily sales record.
export async function POST(request: Request) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const { staffId, date } = body;

    // Validate that the required information was sent
    if (!staffId || !date) {
      return NextResponse.json({ message: 'Staff ID and date are required to reset data.' }, { status: 400 });
    }

    // Ensure the staff member exists
    const staffExists = await Staff.findById(staffId);
    if (!staffExists) {
        return NextResponse.json({ message: 'Staff not found.' }, { status: 404 });
    }
    
    // Create a date object and zero out the time to match how it's stored in the DB
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Find and delete the specific daily sale record
    const deleteResult = await DailySale.deleteOne({ 
      staff: staffId, 
      date: targetDate 
    });

    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({ message: 'No data found for the selected day to reset.' });
    }

    return NextResponse.json({ message: 'Daily data for the selected day has been reset successfully.' }, { status: 200 });

  } catch (error: any) {
    console.error("API POST /api/incentives/reset Error:", error);
    return NextResponse.json({ message: 'An internal server error occurred while resetting data', error: error.message }, { status: 500 });
  }
}