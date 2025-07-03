// FILE: /app/api/reports/day-end-closing/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Invoice from '@/models/invoice';
import DayEndReport from '@/models/DayEndReport';
import { sendClosingReportEmail } from '@/lib/mail';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// --- FIX STARTS HERE ---
// The helper function is now rewritten to use a more efficient and correct aggregation pipeline.

/**
 * Calculates the expected totals for a given date by aggregating paid invoices.
 * This is more efficient than fetching all documents and reducing in JS.
 * It correctly sums the split payment details from the `paymentDetails` object.
 * @param {string} date - The closing date in 'YYYY-MM-DD' format.
 * @returns {Promise<{cash: number, card: number, upi: number, total: number}>}
 */
async function getExpectedTotalsForDate(date: string) {
  const startDate = new Date(date);
  startDate.setUTCHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setUTCHours(23, 59, 59, 999);

  const aggregationPipeline = [
    {
      // Step 1: Filter for paid invoices within the specified date range
      $match: {
        paymentStatus: 'Paid',
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      // Step 2: Group all matching invoices and sum their payment details
      $group: {
        _id: null, // Group all documents into a single result
        cash: { $sum: '$paymentDetails.cash' },
        card: { $sum: '$paymentDetails.card' },
        upi: { $sum: '$paymentDetails.upi' },
        total: { $sum: '$grandTotal' }, // Also sum the grand total for consistency
      },
    },
  ];

  const result = await Invoice.aggregate(aggregationPipeline);

  // If there are no paid invoices for the day, result will be an empty array
  if (result.length === 0) {
    return { cash: 0, card: 0, upi: 0, total: 0 };
  }
  
  // Return the calculated totals from the first (and only) element of the result
  const totals = result[0];
  return {
    cash: totals.cash || 0,
    card: totals.card || 0,
    upi: totals.upi || 0,
    total: totals.total || 0,
  };
}
// --- FIX ENDS HERE ---


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

    // This now calls the corrected function and gets the right values
    const expected = await getExpectedTotalsForDate(closingDate);

    const totalCountedCash = Object.entries(cashDenominations).reduce((total, [denomKey, count]) => {
        const value = parseInt(denomKey.replace('d', ''));
        return total + value * (count as number);
    }, 0);
    
    const actualGrandTotal = totalCountedCash + (actualTotals.card || 0) + (actualTotals.upi || 0);
    
    // This discrepancy calculation will now be correct
    const discrepancy = {
        cash: totalCountedCash - expected.cash,
        card: (actualTotals.card || 0) - expected.card,
        upi: (actualTotals.upi || 0) - expected.upi,
        total: actualGrandTotal - expected.total,
    };

    const newReport = new DayEndReport({
      closingDate: new Date(closingDate),
      expected, // Now contains correct system totals
      actual: {
        card: actualTotals.card || 0,
        upi: actualTotals.upi || 0,
        cashDenominations,
        totalCountedCash,
      },
      discrepancy, // Now contains correct discrepancy values
      notes,
      closedBy: session.user.id,
    });

    await newReport.save();
    
    // Prepare the data for the email with the correct values
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
        discrepancies: discrepancy,
        cashDenominations,
        notes,
    };
    
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