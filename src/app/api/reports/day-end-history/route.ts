import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; 
import dbConnect from '@/lib/dbConnect';
import DayEndReport from '@/models/DayEndReport';
import User from '@/models/user'; // This import is necessary for .populate()

/**
 * API endpoint to fetch the history of Day-End Closing reports, with optional date filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, message: "Not Authenticated" }, { status: 401 });
    }
    
    await dbConnect();
    
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const query: any = {};

    if (startDate && endDate) {
        const startDateObj = new Date(startDate);
        startDateObj.setUTCHours(0, 0, 0, 0);

        const endDateObj = new Date(endDate);
        endDateObj.setUTCHours(23, 59, 59, 999);

        query.closingDate = {
            $gte: startDateObj,
            $lte: endDateObj,
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