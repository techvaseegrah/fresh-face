import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Invoice from '@/models/invoice';
import DailyReconciliation from '@/models/DailyReconciliation'; // STEP 1: Import the Reconciliation model
import { getTenantIdOrBail } from '@/lib/tenant';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    // Standard tenant and date validation
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) return tenantId;
    
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    if (!date) {
      return NextResponse.json({ message: 'Date URL parameter is required.' }, { status: 400 });
    }

    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // --- STEP 2: FIND THE PREVIOUS DAY'S REPORT TO GET THE OPENING BALANCE ---
    // This is the crucial logic that was missing from your original file.
    const lastClosingReport = await DailyReconciliation.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      date: { $lt: startOfDay }, // Find the most recent report with a date *before* the start of today
    }).sort({ date: -1 }); // Sort descending to ensure we get the latest one

    // Safely get the closing cash from that report. If no report is found, default to 0.
    const openingBalance = lastClosingReport?.cash?.closingCash || 0;
    
    // --- STEP 3: EXECUTE YOUR EXISTING PIPELINE FOR TODAY'S SALES ---
    // This part of your code is perfect for its job and remains unchanged.
    const pipeline = [
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId), 
          'createdAt': { $gte: startOfDay, $lte: endOfDay },
          'paymentStatus': { $regex: /^Paid$/i } 
        },
      },
      {
        $addFields: {
          'paymentDetails.cash': { $ifNull: ['$paymentDetails.cash', 0] },
          'paymentDetails.card': { $ifNull: ['$paymentDetails.card', 0] },
          'paymentDetails.upi': { $ifNull: ['$paymentDetails.upi', 0] },
        }
      },
      { $unwind: '$lineItems' },
      {
        $group: {
            _id: '$_id',
            invoiceServiceTotal: { $sum: '$serviceTotal' },
            invoiceProductTotal: { $sum: '$productTotal' },
            cashPaid: { $first: '$paymentDetails.cash' },
            cardPaid: { $first: '$paymentDetails.card' },
            upiPaid: { $first: '$paymentDetails.upi' },
            grandTotal: { $first: '$grandTotal' }
        }
      },
      {
        $group: {
          _id: null,
          serviceTotal: { $sum: '$invoiceServiceTotal' },
          productTotal: { $sum: '$invoiceProductTotal' },
          cash: { $sum: '$cashPaid' },
          gpay: { $sum: '$upiPaid' },
          card: { $sum: '$cardPaid' },
          sumup: { $sum: 0 },
          total: { $sum: '$grandTotal' },
        },
      },
      {
        $project: { _id: 0, serviceTotal: 1, productTotal: 1, cash: 1, gpay: 1, card: 1, sumup: 1, total: 1 }
      }
    ];
    
    const result = await Invoice.aggregate(pipeline);
    
    // Get the summary of today's sales, defaulting to all zeros if no sales occurred.
    const summaryOfTodaySales = result[0] || { serviceTotal: 0, productTotal: 0, cash: 0, gpay: 0, card: 0, sumup: 0, total: 0 };
    
    // --- STEP 4: COMBINE TODAY'S SALES WITH THE OPENING BALANCE INTO A SINGLE RESPONSE ---
    const finalResponse = {
      ...summaryOfTodaySales,
      openingBalance: openingBalance,
    };
    
    return NextResponse.json(finalResponse);

  } catch (error) {
    console.error('[ERROR] in /api/reconciliation/software-summary:', error);
    return NextResponse.json({ message: 'Internal Server Error', error: (error as Error).message }, { status: 500 });
  }
}