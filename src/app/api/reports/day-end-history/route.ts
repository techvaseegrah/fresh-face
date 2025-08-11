import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; 
import connectToDatabase from '@/lib/mongodb'; // Corrected import name for consistency
import DayEndReport from '@/models/DayEndReport';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant'; // 👈 IMPORTED: The standard tenant helper

export async function GET(request: NextRequest) {
  try {
    // --- 1. Get Tenant ID using the standard helper FIRST ---
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) {
      return tenantId; // Bail out if the tenant header is missing
    }
    // --------------------------------------------------------

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.DAYEND_READ)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    
    // --- 2. Security Safeguard: Verify session tenant matches header tenant ---
    if (session.user.tenantId !== tenantId) {
      console.warn(`Security Alert: Session tenant (${session.user.tenantId}) does not match header tenant (${tenantId}).`);
      return NextResponse.json({ success: false, message: 'Session-Tenant mismatch.' }, { status: 403 });
    }
    // -----------------------------------------------------------------------
    
    await connectToDatabase();
    
    // Start the query object with the validated tenantId. This is the core of the tenancy implementation.
    const query: any = { tenantId: tenantId }; 
    
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Date filtering logic remains the same, but it's now appended to the tenant-scoped query.
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
      .populate('closedBy', 'name') // Populate the user's name
      .lean();
      
    // Your data cleaning logic remains unchanged.
    const cleanedReports = reports.map(report => {
      const newReport = { ...report };
      if (newReport.actualTotals && newReport.actualTotals.cash !== undefined) {
          // This line appears to be aliasing 'cash' to 'totalCountedCash'.
          // It's not a tenancy issue and is preserved.
          newReport.actualTotals.totalCountedCash = newReport.actualTotals.cash;
      }
      return newReport;
    });
            
    return NextResponse.json({ success: true, data: cleanedReports }, { status: 200 });

  } catch (error: any) {
    console.error("API Error fetching day-end history:", error);
    return NextResponse.json(
      { success: false, message: "An internal server error occurred.", errorDetails: error.message },
      { status: 500 }
    );
  }
}