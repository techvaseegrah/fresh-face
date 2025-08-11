import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb'; // Assuming this is your DB connection helper
import DayEndReport from '@/models/DayEndReport';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { sendClosingReportEmail } from '@/lib/mail';
import { getTenantIdOrBail } from '@/lib/tenant'; // 👈 CHANGED: Import the tenant helper

export async function POST(request: NextRequest) {
  try {
    // --- STEP 1: Get Tenant ID first using the standard helper ---
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) {
      return tenantId; // Bail out if the tenant header is missing
    }
    // -------------------------------------------------------------

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.DAYEND_CREATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    // Safeguard: Ensure the session tenant matches the header tenant
    if (session.user.tenantId !== tenantId) {
        return NextResponse.json({ success: false, message: 'Session-Tenant mismatch.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      closingDate,
      openingBalance,
      isOpeningBalanceManual,
      pettyCash,
      expectedTotals,
      actualTotals,
      discrepancies,
      cashDenominations,
      notes,
    } = body;

    if (!closingDate) {
      return NextResponse.json({ success: false, message: "Closing date is required" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    // Check for a report on the same date for the same tenant
    // This logic was already correct, now it just uses the consistent `tenantId` variable
    const existingReport = await DayEndReport.findOne({ 
      closingDate: new Date(closingDate),
      tenantId: tenantId 
    });

    if (existingReport) {
      return NextResponse.json({ success: false, message: `A report for ${new Date(closingDate).toLocaleDateString()} already exists.` }, { status: 409 });
    }

    const newReport = new DayEndReport({
      tenantId: tenantId, // Tag the new report with the tenant's ID
      closingDate: new Date(closingDate),
      openingBalance,
      isOpeningBalanceManual,
      pettyCash: {
        total: pettyCash.total,
        expenseIds: pettyCash.entries.map((entry: any) => entry._id),
      },
      expectedTotals,
      actualTotals: {
        totalCountedCash: actualTotals.cash,
        card: actualTotals.card,
        upi: actualTotals.upi,
        other: actualTotals.other,
        total: (actualTotals.cash || 0) + (actualTotals.card || 0) + (actualTotals.upi || 0) + (actualTotals.other || 0),
      },
      discrepancies,
      cashDenominations,
      notes,
      closedBy: session.user.id,
    });

    await newReport.save();

    // 👈 CHANGED & CRITICAL: Make the email function tenant-aware
    // Do not just pass the `body`. The email function needs the tenantId
    // to look up the correct recipients from the database.
    await sendClosingReportEmail(newReport, tenantId);
    
    return NextResponse.json({
      success: true,
      message: `Day-end report for ${new Date(closingDate).toLocaleDateString()} submitted successfully.`,
      reportId: newReport._id,
    }, { status: 201 });

  } catch (error: any) {
    console.error("API Error in /api/reports/day-end-closing:", error);
    return NextResponse.json({ success: false, message: "An internal server error occurred." }, { status: 500 });
  }
}