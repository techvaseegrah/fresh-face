import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import DayEndReport from '@/models/DayEndReport';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.DAYEND_CREATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    // Deconstruct the full, rich payload from the frontend
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
    
    // Check if a report for this date already exists to prevent duplicates
    const existingReport = await DayEndReport.findOne({ closingDate: new Date(closingDate) });
    if (existingReport) {
      return NextResponse.json({ success: false, message: `A report for ${closingDate} already exists.` }, { status: 409 });
    }

    // Create a new report document using the updated schema
    const newReport = new DayEndReport({
      closingDate: new Date(closingDate),
      openingBalance,
      isOpeningBalanceManual,
      pettyCash: {
        total: pettyCash.total,
        // Extract just the _id from each expense entry to store as a reference
        expenseIds: pettyCash.entries.map((entry: any) => entry._id),
      },
      expectedTotals,
      actualTotals,
      discrepancies,
      cashDenominations,
      notes,
      closedBy: session.user.id,
    });

    await newReport.save();
    
    // Optional: Add logic here to send an email notification
    // await sendClosingReportEmail(newReport.toObject());

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