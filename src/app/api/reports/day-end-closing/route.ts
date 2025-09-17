import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import DayEndReport from '@/models/DayEndReport';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant';

export async function GET(request: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) {
      return tenantId;
    }

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.DAYEND_READ)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    
    if (session.user.tenantId !== tenantId) {
      return NextResponse.json({ success: false, message: 'Session-Tenant mismatch.' }, { status: 403 });
    }
    
    await connectToDatabase();
    
    const query: any = { tenantId: tenantId }; 
    
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (startDate && endDate) {
        const startDateObj = new Date(startDate);
        startDateObj.setUTCHours(0, 0, 0, 0);
        const endDateObj = new Date(endDate);
        endDateObj.setUTCHours(23, 59, 59, 999);
        query.closingDate = { $gte: startDateObj, $lte: endDateObj };
    }
    
    const reports = await DayEndReport.find(query)
      .sort({ closingDate: -1 })
      .populate('closedBy', 'name')
      .lean();
      
    // ▼▼▼ CRASH-PROOF DATA MAPPING LOGIC ▼▼▼
    // This ensures that even if data is missing from a DB record, we provide defaults and don't crash.
    const cleanedReports = reports.map(report => {
      const newReport = { ...report };

      // Safely access nested properties using ?. and provide defaults with ??
      newReport.closedBy = report.closedBy ?? { name: 'N/A' };
      newReport.systemTotals = report.systemTotals ?? { grandTotal: 0, cash: 0 };
      newReport.actualTotals = report.actualTotals ?? { cash: 0 };
      newReport.discrepancy = report.discrepancy ?? { cash: 0 };

      // Ensure totalCountedCash exists, defaulting to 0 if needed
      newReport.actualTotals.totalCountedCash = report.actualTotals?.cash ?? 0;

      return newReport;
    });
    // ▲▲▲ END OF CRASH-PROOF LOGIC ▲▲▲
            
    return NextResponse.json({ success: true, data: cleanedReports }, { status: 200 });

  } catch (error: any) {
    // This catch block is your safety net. It ensures you ALWAYS return valid JSON.
    console.error("CRITICAL API ERROR in GET /day-end-closing:", error);
    return NextResponse.json(
      { success: false, message: "An internal server error occurred.", errorDetails: error.message },
      { status: 500 }
    );
  }
}