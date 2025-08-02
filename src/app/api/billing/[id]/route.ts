// FILE: /app/api/billing/[id]/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import mongoose from 'mongoose';
import Invoice from '@/models/invoice';
import Appointment from '@/models/Appointment';
import Customer from '@/models/customermodel'; // Assuming this is the correct model name
import Setting from '@/models/Setting';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import { FinalizeBillingPayload } from '@/app/(main)/appointment/billingmodal'; // Adjust path if necessary

// Your GET function can remain as is.
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  // ... (Your existing GET code is fine) ...
  const { id } = params;
  if (!id) {
    return NextResponse.json({ success: false, message: 'Invoice ID is required.' }, { status: 400 });
  }
  try {
    await dbConnect();
    const invoice = await Invoice.findById(id).lean();
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, invoice }, { status: 200 });
  } catch (error: any) {
    console.error(`[API ERROR] GET /api/billing/${id}:`, error);
    return NextResponse.json(
      { success: false, message: 'Server error fetching invoice.', error: error.message },
      { status: 500 }
    );
  }
}


// --- HANDLES UPDATING AN EXISTING INVOICE (For "Save Correction") ---
// This version includes full synchronization for Appointment AND Loyalty Points.
export async function PUT(
  request: Request,
  { params }: { params: { id: string } } // This is the INVOICE ID
) {
  const { id } = params;
  
  // Best Practice: Use a transaction for multi-document updates
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await dbConnect();
    const body: FinalizeBillingPayload = await request.json(); 
    
    const {
      appointmentId, customerId, items, grandTotal, membershipDiscount, paymentDetails, 
      billingStaffId, serviceTotal, productTotal, subtotal, notes, manualDiscountType,
      manualDiscountValue, finalManualDiscountApplied
    } = body;
    
    // --- 1. LOYALTY POINT RECONCILIATION ---

    const loyaltySettingDoc = await Setting.findOne({ key: 'loyalty' }).session(session).lean();
    let pointsDifference = 0;

    // Proceed only if loyalty settings are configured
    if (loyaltySettingDoc?.value) {
      const { rupeesForPoints, pointsAwarded } = loyaltySettingDoc.value;
      
      if (rupeesForPoints > 0 && pointsAwarded > 0) {
        // Fetch the original appointment to get the old total for calculation
        const originalAppointment = await Appointment.findById(appointmentId).session(session).lean();
        if (!originalAppointment) {
          throw new Error("Original appointment not found for loyalty point calculation.");
        }
        const oldGrandTotal = originalAppointment.finalAmount || 0;
        const newGrandTotal = grandTotal;

        // Calculate points based on your rule
        const oldPoints = Math.floor(oldGrandTotal / rupeesForPoints) * pointsAwarded;
        const newPoints = Math.floor(newGrandTotal / rupeesForPoints) * pointsAwarded;

        pointsDifference = newPoints - oldPoints;
      }
    }
    
    // --- 2. UPDATE THE INVOICE ---
    
    const invoiceUpdateData = {
      lineItems: items,
      grandTotal,
      membershipDiscount,
      paymentDetails,
      billingStaffId,
      serviceTotal,
      productTotal,
      subtotal,
      notes,
      manualDiscount: {
        type: manualDiscountType,
        value: manualDiscountValue,
        appliedAmount: finalManualDiscountApplied,
      },
      paymentStatus: 'Paid'
    };

    const updatedInvoice = await Invoice.findByIdAndUpdate(id, invoiceUpdateData, {
      new: true,
      session,
    });

    if (!updatedInvoice) {
      throw new Error('Invoice not found during update.');
    }
    
    // --- 3. CREATE LOYALTY ADJUSTMENT TRANSACTION (if necessary) ---

    if (pointsDifference !== 0 && customerId) {
      await LoyaltyTransaction.create([{
          customerId,
          points: Math.abs(pointsDifference), // Store the absolute value
          type: pointsDifference > 0 ? 'Credit' : 'Debit',
          description: `Point adjustment for corrected invoice #${updatedInvoice.invoiceNumber || id}`,
          reason: `Invoice Correction`,
          transactionDate: new Date(),
      }], { session });

      // OPTIONAL: Also update a running total on the Customer model if you have one.
      // await Customer.findByIdAndUpdate(customerId, { 
      //   $inc: { loyaltyPoints: pointsDifference } 
      // }, { session });
    }

    // --- 4. SYNCHRONIZE THE APPOINTMENT ---
    
    const newServiceIds = items
      .filter(item => item.itemType === 'service')
      .map(serviceItem => serviceItem.itemId);

    const appointmentUpdatePayload = {
      finalAmount: updatedInvoice.grandTotal,
      amount: updatedInvoice.subtotal,
      membershipDiscount: updatedInvoice.membershipDiscount,
      paymentDetails: updatedInvoice.paymentDetails,
      billingStaffId: updatedInvoice.billingStaffId,
      serviceIds: newServiceIds,
      status: 'Paid',
    };
    
    await Appointment.findByIdAndUpdate(appointmentId, appointmentUpdatePayload, { session });
    
    // --- 5. COMMIT AND RESPOND ---

    await session.commitTransaction();

    return NextResponse.json({
      success: true,
      message: 'Invoice, Appointment, and Loyalty Points updated successfully.',
      data: updatedInvoice,
    }, { status: 200 });

  } catch (error: any) {
    await session.abortTransaction();
    console.error(`[API ERROR] PUT /api/billing/${id}:`, error);
    return NextResponse.json(
      { success: false, message: 'Server error while updating the bill.', error: error.message },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}