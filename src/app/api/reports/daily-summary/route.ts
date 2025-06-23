// FILE: /app/api/reports/daily-summary/route.ts - (COMPLETE AND CORRECTED)

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Invoice from '@/models/invoice';

// Define the structure of the expected output
interface DailySummaryTotals {
  cash: number;
  card: number;
  upi: number;
  other: number; // Added 'other' for completeness
  total: number;
  [key: string]: number; // Allow for other potential payment methods
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, message: "Invalid or missing date parameter. Please use YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    await dbConnect();

    const startDate = new Date(date);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setUTCHours(23, 59, 59, 999);
    
    const paidInvoices = await Invoice.find({
      paymentStatus: 'Paid',
      createdAt: { $gte: startDate, $lte: endDate },
    }).lean();

    

    // --- THIS IS THE FIX ---
    // The aggregation logic is updated to handle the `paymentDetails` object.
    const expectedTotals = paidInvoices.reduce((accumulator, invoice) => {
        // First, add the invoice's total to the grand total for the day.
        accumulator.total += invoice.grandTotal || 0;

        // Check if paymentDetails exists and is an object
        if (invoice.paymentDetails && typeof invoice.paymentDetails === 'object') {
            // Iterate through each key-value pair in the paymentDetails object (e.g., ['cash', 500])
            for (const [method, amount] of Object.entries(invoice.paymentDetails)) {
                if (typeof amount === 'number') {
                    // Add the amount to the correct category in our accumulator.
                    // e.g., accumulator.cash = (accumulator.cash || 0) + 500
                    accumulator[method] = (accumulator[method] || 0) + amount;
                }
            }
        }
        
        return accumulator;
    }, {
        // This is the starting shape of our accumulator object.
        cash: 0,
        card: 0,
        upi: 0,
        other: 0,
        total: 0,
    } as DailySummaryTotals);
    
    return NextResponse.json({
      success: true,
      data: {
        date: date,
        expectedTotals: expectedTotals,
      },
    }, { status: 200 });

  } catch (error: any) {
    console.error("API Error in /api/reports/daily-summary:", error);
    return NextResponse.json(
      { success: false, message: error.message || "An internal server error occurred." },
      { status: 500 }
    );
  }
}