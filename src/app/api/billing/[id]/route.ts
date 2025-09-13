// /app/api/billing/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import mongoose from 'mongoose';
import Invoice from '@/models/invoice';
import Appointment from '@/models/Appointment';
import Customer from '@/models/customermodel';
import Setting from '@/models/Setting';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import { getTenantIdOrBail } from '@/lib/tenant';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions'; 
import { FinalizeBillingPayload } from '@/app/(main)/appointment/billingmodal';
import { recalculateAndSaveDailySale } from '../route';

// ===================================================================================
//  GET: Handler to fetch a single invoice by its ID
// ===================================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = getTenantIdOrBail(request);
  if (tenantId instanceof NextResponse) return tenantId;
  
  const { id } = params;
  if (!id) {
    return NextResponse.json({ success: false, message: 'Invoice ID is required.' }, { status: 400 });
  }
  try {
    await dbConnect();
    const invoice = await Invoice.findOne({ _id: id, tenantId }).lean();
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

// ===================================================================================
//  PUT: Handler to update an existing invoice (e.g., "Save Correction")
// ===================================================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = getTenantIdOrBail(request);
  if (tenantId instanceof NextResponse) return tenantId;
  
  const { id } = params;
  
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    await dbConnect();
    const body: FinalizeBillingPayload = await request.json(); 
    
    const {
      appointmentId, customerId, items, grandTotal, membershipDiscount, paymentDetails, 
      billingStaffId, serviceTotal, productTotal, subtotal, notes, manualDiscountType,
      manualDiscountValue, finalManualDiscountApplied
    } = body;
    
    // --- 1. LOYALTY POINT RECONCILIATION ---
    const loyaltySettingDoc = await Setting.findOne({ key: 'loyalty', tenantId }).session(dbSession).lean();
    let pointsDifference = 0;

    if (loyaltySettingDoc?.value) {
      const { rupeesForPoints, pointsAwarded } = loyaltySettingDoc.value;
      if (rupeesForPoints > 0 && pointsAwarded > 0) {
        const originalAppointment = await Appointment.findOne({ _id: appointmentId, tenantId }).session(dbSession).lean();
        if (!originalAppointment) {
          throw new Error("Original appointment not found for loyalty point calculation.");
        }
        const oldGrandTotal = originalAppointment.finalAmount || 0;
        const newGrandTotal = grandTotal;
        const oldPoints = Math.floor(oldGrandTotal / rupeesForPoints) * pointsAwarded;
        const newPoints = Math.floor(newGrandTotal / rupeesForPoints) * pointsAwarded;
        pointsDifference = newPoints - oldPoints;
      }
    }
    
    // --- 2. UPDATE THE INVOICE ---
    const invoiceUpdateData = {
      lineItems: items, grandTotal, membershipDiscount, paymentDetails, 
      billingStaffId, serviceTotal, productTotal, subtotal, notes, 
      manualDiscount: {
        type: manualDiscountType, value: manualDiscountValue, appliedAmount: finalManualDiscountApplied,
      },
      paymentStatus: 'Paid'
    };
    const updatedInvoice = await Invoice.findOneAndUpdate({ _id: id, tenantId }, invoiceUpdateData, {
      new: true,
      session: dbSession,
    });
    if (!updatedInvoice) {
      throw new Error('Invoice not found during update.');
    }
    
    // --- 3. CREATE LOYALTY ADJUSTMENT TRANSACTION (if necessary) ---
    if (pointsDifference !== 0 && customerId) {
      await LoyaltyTransaction.create([{
          tenantId: tenantId,
          customerId,
          points: Math.abs(pointsDifference),
          type: pointsDifference > 0 ? 'Credit' : 'Debit',
          description: `Point adjustment for corrected invoice #${updatedInvoice.invoiceNumber || id}`,
          reason: `Invoice Correction`,
          transactionDate: new Date(),
      }], { session: dbSession });
    }

    // --- 4. SYNCHRONIZE THE APPOINTMENT ---
    // ✅ FIX: Explicitly type the constant as string[] to resolve the TypeScript error.
    const newServiceIds: string[] = items
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
    await Appointment.updateOne({ _id: appointmentId, tenantId }, appointmentUpdatePayload, { session: dbSession });
    
    // --- 5. RECALCULATE DAILY SALE FOR INCENTIVES ---
    const relatedAppointment = await Appointment.findById(appointmentId).session(dbSession).lean();
    if (!relatedAppointment) {
        throw new Error("Could not find the related appointment to recalculate daily sales.");
    }
    
    const allStaffIdsInvolved: string[] = [...new Set(
        items.map((item: any) => item.staffId).filter((id: any) => id != null).map((id: any) => id.toString())
    )];

    if (allStaffIdsInvolved.length > 0) {
      await recalculateAndSaveDailySale({
          tenantId,
          staffIds: allStaffIdsInvolved,
          date: relatedAppointment.appointmentDateTime,
          dbSession,
      });
    }
    
    // --- 6. COMMIT AND RESPOND ---
    await dbSession.commitTransaction();

    return NextResponse.json({
      success: true,
      message: 'Invoice, Appointment, and Loyalty Points updated successfully.',
      data: updatedInvoice,
    }, { status: 200 });

  } catch (error: any) {
    await dbSession.abortTransaction();
    console.error(`[API ERROR] PUT /api/billing/${id}:`, error);
    return NextResponse.json(
      { success: false, message: 'Server error while updating the bill.', error: error.message },
      { status: 500 }
    );
  } finally {
    dbSession.endSession();
  }
}