// /api/billing/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import mongoose from 'mongoose';
import Invoice from '@/models/invoice';
import Appointment from '@/models/Appointment';
import Customer from '@/models/customermodel';
import Setting from '@/models/Setting';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import Product from '@/models/Product';
import { getTenantIdOrBail } from '@/lib/tenant';
import { FinalizeBillingPayload } from '@/app/(main)/appointment/billingmodal';
import { recalculateAndSaveDailySale } from '../route';

// ===================================================================================
//  GET: Fetches an existing invoice. (This is correct and remains unchanged)
// ===================================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = getTenantIdOrBail(request);
  if (tenantId instanceof NextResponse) return tenantId;
  
  const { id } = params;
  if (!id || id === 'undefined') {
    return NextResponse.json({ success: false, message: 'Invoice ID is required.' }, { status: 400 });
  }
  try {
    await dbConnect();
    const invoice = await Invoice.findOne({ _id: id, tenantId })
      .populate({ path: 'customerId', select: 'name phoneNumber isMembership' })
      .populate({ path: 'billingStaffId', select: 'name email' })
      .lean();
      
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found.' }, { status: 404 });
    }
    const responseData = { ...invoice, customer: invoice.customerId, billingStaff: invoice.billingStaffId };
    delete (responseData as any).customerId;
    delete (responseData as any).billingStaffId;

    return NextResponse.json({ success: true, invoice: responseData }, { status: 200 });
  } catch (error: any) {
    console.error(`[API ERROR] GET /api/billing/${id}:`, error);
    return NextResponse.json(
      { success: false, message: 'Server error fetching invoice.', error: error.message },
      { status: 500 }
    );
  }
}

// ===================================================================================
//  PUT: The final, simple, and correct handler.
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
      manualDiscountValue, finalManualDiscountApplied, manualInventoryUpdates
    } = body;
    
    const originalInvoice = await Invoice.findOne({ _id: id, tenantId }).session(dbSession).lean();
    if (!originalInvoice) {
        throw new Error("Original invoice not found for correction.");
    }
    
    // =========================================================================
    // --- NEW, SIMPLE, AND DIRECT INVENTORY LOGIC ---
    // =========================================================================

    // The history of the original invoice's inventory impact is completely ignored.
    // This was the source of all the problems. We only care about the user's final input.
    
    if (manualInventoryUpdates && manualInventoryUpdates.length > 0) {
        console.log("Applying direct manual deductions from user input.");
        for (const update of manualInventoryUpdates) {
            // We find the product and simply deduct the amount the user entered.
            // No other calculations are performed.
            await Product.updateOne(
                { _id: update.productId, tenantId },
                { $inc: { totalQuantity: -update.quantityToDeduct } },
                { session: dbSession }
            );
             console.log(`Deducted ${update.quantityToDeduct} from product ${update.productId}`);
        }
    } else {
        console.log("No manual inventory updates were provided for this correction.");
    }

    // --- END OF INVENTORY LOGIC ---
    // =========================================================================

    // The rest of the logic for updating the invoice document, loyalty, etc., remains the same.
    const invoiceUpdateData = {
      lineItems: items, grandTotal, membershipDiscount, paymentDetails, 
      billingStaffId, serviceTotal, productTotal, subtotal, notes, customerId,
      manualDiscount: { type: manualDiscountType, value: manualDiscountValue, appliedAmount: finalManualDiscountApplied, },
      paymentStatus: 'Paid'
    };

    const updatedInvoiceDoc = await Invoice.findOneAndUpdate({ _id: id, tenantId }, invoiceUpdateData, { new: true, session: dbSession, })
      .populate({ path: 'customerId', select: 'name phoneNumber isMembership' })
      .populate({ path: 'billingStaffId', select: 'name email' });
    
    if (!updatedInvoiceDoc) { throw new Error('Invoice not found during update.'); }
    
    // Adjust loyalty points
    const loyaltySettingDoc = await Setting.findOne({ key: 'loyalty', tenantId }).session(dbSession).lean();
    if (loyaltySettingDoc?.value) {
      const { rupeesForPoints, pointsAwarded } = loyaltySettingDoc.value;
      if (rupeesForPoints > 0 && pointsAwarded > 0) {
        const pointsDifference = (Math.floor(grandTotal / rupeesForPoints) * pointsAwarded) - (Math.floor((originalInvoice.grandTotal || 0) / rupeesForPoints) * pointsAwarded);
        if (pointsDifference !== 0) {
          await LoyaltyTransaction.create([{
              tenantId, customerId, points: Math.abs(pointsDifference),
              type: pointsDifference > 0 ? 'Credit' : 'Debit',
              description: `Point adjustment for corrected invoice #${updatedInvoiceDoc.invoiceNumber || id}`,
              reason: `Invoice Correction`, transactionDate: new Date(),
          }], { session: dbSession });
        }
      }
    }

    // Update the linked appointment
    const newServiceIds = items.filter(item => item.itemType === 'service').map(serviceItem => serviceItem.itemId);
    const appointmentUpdatePayload = {
      finalAmount: updatedInvoiceDoc.grandTotal, amount: updatedInvoiceDoc.subtotal,
      membershipDiscount: updatedInvoiceDoc.membershipDiscount, paymentDetails: updatedInvoiceDoc.paymentDetails,
      billingStaffId: updatedInvoiceDoc.billingStaffId, serviceIds: newServiceIds, status: 'Paid',
    };
    await Appointment.updateOne({ _id: appointmentId, tenantId }, appointmentUpdatePayload, { session: dbSession });
    
    // Recalculate daily sales reports
    const appointmentForDate = await Appointment.findById(appointmentId).session(dbSession).lean();
    if(appointmentForDate) {
      const oldStaffIds = originalInvoice.lineItems.map(item => item.staffId?.toString()).filter(Boolean) as string[];
      const newStaffIds = items.map(item => item.staffId?.toString()).filter(Boolean) as string[];
      const allStaffInvolved = [...new Set([...oldStaffIds, ...newStaffIds])];
      await recalculateAndSaveDailySale({ tenantId, staffIds: allStaffInvolved, date: appointmentForDate.appointmentDateTime, dbSession });
    }
    
    await dbSession.commitTransaction();

    const updatedInvoice = updatedInvoiceDoc.toObject();
    updatedInvoice.customer = updatedInvoice.customerId;
    updatedInvoice.billingStaff = updatedInvoice.billingStaffId;
    delete (updatedInvoice as any).customerId;
    delete (updatedInvoice as any).billingStaffId;

    return NextResponse.json({
      success: true, message: 'Invoice, Inventory, and Appointment updated successfully.', data: updatedInvoice,
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