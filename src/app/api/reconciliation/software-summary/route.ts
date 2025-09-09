import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Invoice from '@/models/invoice';
import DailyReconciliation from '@/models/DailyReconciliation';
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
    // This logic remains unchanged.
    const lastClosingReport = await DailyReconciliation.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      date: { $lt: startOfDay },
    }).sort({ date: -1 });

    const openingBalance = lastClosingReport?.cash?.closingCash || 0;
    
    // --- STEP 3: EXECUTE THE PIPELINE WITH PROPORTIONAL DISCOUNT LOGIC ADDED ---
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
            invoiceServiceTotal: { $first: '$serviceTotal' },
            invoiceProductTotal: { $first: '$productTotal' },
            cashPaid: { $first: '$paymentDetails.cash' },
            cardPaid: { $first: '$paymentDetails.card' },
            upiPaid: { $first: '$paymentDetails.upi' },
            grandTotal: { $first: '$grandTotal' },
            // MODIFICATION 1: Carry the discount amount for each invoice
            discountAmount: { $first: { $ifNull: ['$manualDiscount.appliedAmount', 0] } }
        }
      },

      // MODIFICATION 2: ADD A NEW STAGE to calculate the final totals AFTER discount
      {
        $addFields: {
          // Calculate the final service total for this invoice after applying its share of the discount
          finalServiceTotal: {
            $subtract: [
              '$invoiceServiceTotal',
              { // This block calculates the service portion of the discount
                $multiply: [
                  '$discountAmount',
                  { $divide: ['$invoiceServiceTotal', { $add: ['$invoiceServiceTotal', '$invoiceProductTotal', 0.0001] }] } // (Service Total / Subtotal)
                ]
              }
            ]
          },
          // Calculate the final product total for this invoice after applying its share of the discount
          finalProductTotal: {
            $subtract: [
              '$invoiceProductTotal',
              { // This block calculates the product portion of the discount
                $multiply: [
                  '$discountAmount',
                  { $divide: ['$invoiceProductTotal', { $add: ['$invoiceServiceTotal', '$invoiceProductTotal', 0.0001] }] } // (Product Total / Subtotal)
                ]
              }
            ]
          }
        }
      },
      
      {
        $group: {
          _id: null,
          // MODIFICATION 3: Sum the NEW final totals instead of the old pre-discount ones
          serviceTotal: { $sum: '$finalServiceTotal' },
          productTotal: { $sum: '$finalProductTotal' },
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