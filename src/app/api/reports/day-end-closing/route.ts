// /api/reports/day-end-closing/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import DayEndReport from '@/models/DayEndReport';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { sendClosingReportEmail } from '@/lib/mail';
import Setting from '@/models/Setting';
import mongoose from 'mongoose'; 

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.DAYEND_CREATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    // --- TENANCY IMPLEMENTATION ---
    const tenantId = session.user.tenantId;
    // ----------------------------

    console.log(`--- RUNNING REPORT for tenantId: ${tenantId} ---`);

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
    
    await dbConnect();
    
    // --- TENANCY IMPLEMENTATION ---
    // Check for a report on the same date for the same tenant
    const existingReport = await DayEndReport.findOne({ 
      closingDate: new Date(closingDate),
      tenantId: tenantId 
    });
    // ----------------------------

    if (existingReport) {
      return NextResponse.json({ success: false, message: `A report for ${closingDate} already exists.` }, { status: 409 });
    }

    const newReport = new DayEndReport({
      // --- TENANCY IMPLEMENTATION ---
      tenantId: tenantId, // Tag the new report with the tenant's ID
      // ----------------------------
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

    // STEP 2: Fetch the list of email recipients for this tenant
    const emailSetting = await Setting.findOne({
      key: 'dayEndReportRecipients',
      tenantId: new mongoose.Types.ObjectId(tenantId),
    }).lean();

    // STEP 3: Check if the list exists and has emails in it
    if (emailSetting && Array.isArray(emailSetting.value) && emailSetting.value.length > 0) {
      const recipients = emailSetting.value;
      console.log('Recipients found, sending email to:', recipients); // Added a success log

      // STEP 4: Call the email function with BOTH the recipients and the report data
      // This will run in the background.
      sendClosingReportEmail(recipients, newReport.toObject())
        .catch(emailError => {
          // Log any errors from the mail function itself for debugging
          console.error("Error sending closing report email:", emailError);
        });
    }

    
    return NextResponse.json({
      success: true,
      message: `Day-end report for ${closingDate} submitted successfully.`,
      reportId: newReport._id,
    }, { status: 201 });

  } catch (error: any) {
    console.error("API Error in /api/reports/day-end-closing:", error);
    return NextResponse.json({ success: false, message: "An internal server error occurred." }, { status: 500 });
  }
}