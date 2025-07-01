// FILE: /app/api/reports/day-end-closing/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Invoice from '@/models/invoice';
import DayEndReport from '@/models/DayEndReport';
import { sendClosingReportEmail } from '@/lib/mail';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// A helper function to re-calculate expected totals (No changes here)
async function getExpectedTotalsForDate(date: string) {
  const startDate = new Date(date);
  startDate.setUTCHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setUTCHours(23, 59, 59, 999);

  const paidInvoices = await Invoice.find({
    paymentStatus: 'Paid',
    createdAt: { $gte: startDate, $lte: endDate },
  }).lean();

  // Initialize all expected payment methods
  const totals: { [key: string]: number } = { cash: 0, card: 0, upi: 0, total: 0 };

  return paidInvoices.reduce((acc, invoice) => {
    const amount = invoice.grandTotal || 0;
    const paymentMethod = (invoice.paymentMethod || 'unknown').toLowerCase();
    
    // Only accumulate for known payment methods
    if (acc.hasOwnProperty(paymentMethod)) {
        acc[paymentMethod] += amount;
    }

    acc.total += amount;
    return acc;
  }, totals);
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
    
    const actualGrandTotal = totalCountedCash + (actualTotals.card || 0) + (actualTotals.upi || 0);
    
    // --- CHANGE 1: Structure the discrepancy data to match the email function's needs ---
    const discrepancy = {
        cash: totalCountedCash - expected.cash,
        card: (actualTotals.card || 0) - expected.card,
        upi: (actualTotals.upi || 0) - expected.upi,
        total: actualGrandTotal - expected.total, 
        // total: actualGrandTotal - expected.total,  This line was missing and is now restored.
        // The total discrepancy is calculated in the email template, so it's not strictly needed here
    };

    const newReport = new DayEndReport({
      closingDate: new Date(closingDate),
      expected,
      actual: {
        card: actualTotals.card || 0,
        upi: actualTotals.upi || 0,
        cashDenominations,
        totalCountedCash,
      },
      discrepancy,
      notes,
      closedBy: session.user.id,
    });

    await newReport.save();

    // --- CHANGE 2: Create the data object for the email function ---
    // This new `reportForEmail` object perfectly matches the `DayEndReportData` interface in mail.ts
    const reportForEmail = {
        closingDate,
        expectedTotals: {
            cash: expected.cash,
            card: expected.card,
            upi: expected.upi
        },
        actualTotals: {
            cash: totalCountedCash,
            card: actualTotals.card || 0,
            upi: actualTotals.upi || 0,
        },
        discrepancies: discrepancy, // Use the structured discrepancy object
        cashDenominations,
        notes,
    };
    
    // The rest of the logic remains the same. It's already perfect.
    try {
        await sendClosingReportEmail(reportForEmail);
    } catch (emailError) {
        console.error("Report was saved to DB, but email notification failed:", emailError);
    }

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