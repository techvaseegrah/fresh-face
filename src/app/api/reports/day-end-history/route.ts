// FILE: /app/api/reports/day-end-history/route.ts (FINAL, CORRECTED VERSION)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; 
import dbConnect from '@/lib/dbConnect';
import DayEndReport from '@/models/DayEndReport';
import User from '@/models/user'; 
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// This forces the route to be dynamic, preventing caching issues.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
  
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.DAYEND_READ)) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    await dbConnect();
    
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate'); // e.g., "2025-06-18"
    const endDate = searchParams.get('endDate');   // e.g., "2025-06-20"

    const query: any = {};

    // --- THE DEFINITIVE NATIVE JAVASCRIPT FIX ---
    if (startDate && endDate) {
      query.closingDate = {
        // By appending 'T00:00:00.000Z', we tell JavaScript to treat this
        // date as being in the UTC timezone from the very beginning.
        // This avoids any local server timezone conversion.
        $gte: new Date(`${startDate}T00:00:00.000Z`), 
        
        // Similarly, we get the very last millisecond of the end date in UTC.
        $lte: new Date(`${endDate}T23:59:59.999Z`),
      };
    }
    
    const reports = await DayEndReport.find(query)
      .sort({ closingDate: -1 })
      .populate('closedBy', 'name')
      .lean();
            
    return NextResponse.json({ success: true, data: reports }, { status: 200 });

  } catch (error: any) {
    console.error("API Error fetching day-end history:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "An internal server error occurred while fetching history.",
        errorDetails: error.message
      },
      { status: 500 }
    );
  }
}