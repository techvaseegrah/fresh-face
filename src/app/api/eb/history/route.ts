// app/api/eb/history/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import EBReading from '@/models/ebReadings'; // Make sure this matches your model import
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

/**
 * API route to fetch the history of EB readings.
 * Supports filtering by a date range via URL query parameters.
 * Example: /api/eb/history?startDate=2023-01-01&endDate=2023-01-31
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // --- Start of Filtering Logic ---
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build a dynamic query filter object for MongoDB
    const queryFilter: any = {};

    if (startDate || endDate) {
      queryFilter.date = {};
      if (startDate) {
        // $gte: greater than or equal to the start of the specified day
        queryFilter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        // To make the end date inclusive, we find the end of that day
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        // $lte: less than or equal to the end of the specified day
        queryFilter.date.$lte = endOfDay;
      }
    }
    // --- End of Filtering Logic ---

    await connectToDatabase();

    // Use the dynamically built queryFilter in the find() method
    const readings = await EBReading.find(queryFilter)
      .sort({ date: -1 }); // Always sort newest first

    return NextResponse.json({ success: true, readings });
  } catch (error) {
    console.error('Error fetching EB reading history:', error);
    return NextResponse.json({ success: false, message: 'Internal server error while fetching history' }, { status: 500 });
  }
}