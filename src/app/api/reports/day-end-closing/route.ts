// FILE: /app/api/reports/day-end-closing/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Invoice from '@/models/invoice';
import DayEndReport from '@/models/DayEndReport';
import { sendClosingReportEmail } from '@/lib/mail'; // <-- 1. IMPORT our email service
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// A helper function to re-calculate expected totals to prevent tampering
async function getExpectedTotalsForDate(date: string) {
  const startDate = new Date(date);
  startDate.setUTCHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setUTCHours(23, 59, 59, 999);

  const paidInvoices = await Invoice.find({
    paymentStatus: 'Paid',
    createdAt: { $gte: startDate, $lte: endDate },
  }).lean();

  return paidInvoices.reduce<{[key: string]: number}>((acc, invoice) => {
    const amount = invoice.grandTotal || 0;
    const paymentMethod = (invoice.paymentMethod || 'unknown').toLowerCase();
    
    // Ensure the accumulator has the key before adding to it
    if (!acc[paymentMethod]) {
        acc[paymentMethod] = 0;
    }

    acc.total += amount;
    acc[paymentMethod] += amount;
    return acc;
  }, { cash: 0, card: 0, upi: 0, total: 0 }); // Removed 'unknown' for cleaner data
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
  
  
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.DAYEND_CREATE)) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 403 }
    );
  }

    const body = await request.json();
    const { closingDate, actualTotals, cashDenominations, notes } = body;

    if (!closingDate) {
      return NextResponse.json({ success: false, message: "Closing date is required" }, { status: 400 });
    }
    
    await dbConnect();
    
    const existingReport = await DayEndReport.findOne({ closingDate: new Date(closingDate) });
    if (existingReport) {
        return NextResponse.json({ success: false, message: `A report for ${closingDate} has already been submitted.` }, { status: 409 });
    }

    const expected = await getExpectedTotalsForDate(closingDate);

    const totalCountedCash = Object.entries(cashDenominations).reduce((total, [denomKey, count]) => {
        const value = parseInt(denomKey.replace('d', ''));
        return total + value * (count as number);
    }, 0);
    
    const discrepancy = {
        cash: totalCountedCash - (expected.cash || 0),
        card: (actualTotals.card || 0) - (expected.card || 0),
        upi: (actualTotals.upi || 0) - (expected.upi || 0),
        total: (totalCountedCash + (actualTotals.card || 0) + (actualTotals.upi || 0)) - (expected.total || 0),
    };

    const newReport = new DayEndReport({
      closingDate: new Date(closingDate),
      expected,
      actual: {
        card: actualTotals.card,
        upi: actualTotals.upi,
        cashDenominations,
        totalCountedCash,
      },
      discrepancy,
      notes,
      closedBy: session.user.id,
    });

    // --- CRITICAL STEP: SAVE TO DATABASE ---
    await newReport.save();

    // --- 2. EMAIL NOTIFICATION STEP ---
    // This happens *after* a successful save.
    const reportForEmail = {
        closingDate,
        expectedTotals: expected,
        actualTotals: {
            cash: totalCountedCash,
            card: actualTotals.card || 0,
            upi: actualTotals.upi || 0,
        },
        discrepancies: discrepancy,
        cashDenominations,
        notes,
    };
    
    // We wrap email sending in its own try/catch. If email fails,
    // the API should still return success because the report was saved.
    try {
        await sendClosingReportEmail(reportForEmail);
    } catch (emailError) {
        console.error("Report was saved to DB, but email notification failed:", emailError);
        // Do not re-throw the error. The main operation succeeded.
    }

    // --- 3. SEND FINAL RESPONSE ---
    return NextResponse.json({
      success: true,
      message: `Day-end report for ${closingDate} submitted successfully.`,
      reportId: newReport._id
    }, { status: 201 });

  } catch (error: any) {
    console.error("API Error in /api/reports/day-end-closing:", error);
    return NextResponse.json(
      { success: false, message: error.message || "An internal server error occurred." },
      { status: 500 }
    );
  }
}