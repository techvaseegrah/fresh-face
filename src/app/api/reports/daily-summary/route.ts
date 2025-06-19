// FILE: /app/api/reports/daily-summary/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect'; // Using @/ alias is cleaner in App Router
import Invoice from '@/models/invoice';   // Using @/ alias here as well

// Define the structure of the expected output
interface ExpectedTotals {
  cash: number;
  card: number;
  upi: number;
  total: number;
  [key: string]: number; // Allow for other potential payment methods
}

// Export a NAMED function for the GET HTTP method
export async function GET(request: NextRequest) {
  try {
    // In the App Router, query parameters are accessed from the URL object
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    // 1. Validate the input date
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, message: "Invalid or missing date parameter. Please use YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    await dbConnect();

    // 2. Create a date range for the entire day in UTC
    const startDate = new Date(date);
    startDate.setUTCHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setUTCHours(23, 59, 59, 999);
    
    // 3. Find all paid invoices within the date range
    const paidInvoices = await Invoice.find({
      paymentStatus: 'Paid',
      createdAt: { $gte: startDate, $lte: endDate },
    }).lean();

    // 4. Aggregate the totals by payment method
    const expectedTotals = paidInvoices.reduce((accumulator, invoice) => {
        const amount = invoice.grandTotal || 0;
        
        accumulator.total += amount;

        // Defensive code to handle missing payment methods
        const paymentMethod = (invoice.paymentMethod || 'unknown').toLowerCase();

        accumulator[paymentMethod] = (accumulator[paymentMethod] || 0) + amount;
        
        return accumulator;
    }, {
        cash: 0,
        card: 0,
        upi: 0,
        total: 0,
        unknown: 0, // Track amounts with missing payment methods
    } as ExpectedTotals);
    
    // 5. Send the successful response using NextResponse.json
    return NextResponse.json({
      success: true,
      data: {
        date: date,
        expectedTotals: expectedTotals,
      },
    }, { status: 200 });

  } catch (error: any) {
    // Log the error on the server for debugging
    console.error("API Error in /api/reports/daily-summary:", error);

    // Return a JSON error response
    return NextResponse.json(
      { success: false, message: error.message || "An internal server error occurred." },
      { status: 500 }
    );
  }
}