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
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { FinalizeBillingPayload } from '@/app/(main)/appointment/billingmodal';
import { InventoryManager } from '@/lib/inventoryManager'; 
import { Gender } from '@/types/gender'; 

// GET function can remain as it was in the last correct version (with population)
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
    
    const originalInvoice = await Invoice.findOne({ _id: id, tenantId }).session(dbSession).lean();
    if (!originalInvoice) {
        throw new Error("Original invoice not found for correction.");
    }

    // =========================================================================
    // --- 2. INVENTORY ADJUSTMENT (REVISED LOGIC) ---
    // =========================================================================

    // Part A: Direct Product Adjustments
    const productDelta = new Map<string, number>();
    originalInvoice.lineItems.forEach(item => { if (item.itemType === 'product') { const productId = item.itemId.toString(); productDelta.set(productId, (productDelta.get(productId) || 0) - item.quantity); } });
    items.forEach(item => { if (item.itemType === 'product') { const productId = item.itemId.toString(); productDelta.set(productId, (productDelta.get(productId) || 0) + item.quantity); } });
    for (const [productId, quantityChange] of productDelta.entries()) {
        if (quantityChange !== 0) {
            await Product.updateOne({ _id: productId, tenantId }, { $inc: { stock: -quantityChange } }, { session: dbSession });
        }
    }

    // Part B: Service-Based Inventory Adjustments
    const serviceDelta = new Map<string, number>();
    originalInvoice.lineItems.forEach(item => { if (item.itemType === 'service') { const serviceId = item.itemId.toString(); serviceDelta.set(serviceId, (serviceDelta.get(serviceId) || 0) - item.quantity); } });
    items.forEach(item => { if (item.itemType === 'service') { const serviceId = item.itemId.toString(); serviceDelta.set(serviceId, (serviceDelta.get(serviceId) || 0) + item.quantity); } });

    const servicesAddedIds: string[] = [];
    const servicesRemovedIds: string[] = [];

    serviceDelta.forEach((quantityChange, serviceId) => {
        if (quantityChange > 0) {
            for (let i = 0; i < quantityChange; i++) servicesAddedIds.push(serviceId);
        } else if (quantityChange < 0) {
            for (let i = 0; i < Math.abs(quantityChange); i++) servicesRemovedIds.push(serviceId);
        }
    });

    if (servicesAddedIds.length > 0 || servicesRemovedIds.length > 0) {
      const customer = await Customer.findById(customerId).session(dbSession).lean();
      const customerGender = customer?.gender || Gender.Other;

      // Handle added services -> Deduct stock
      if (servicesAddedIds.length > 0) {
        const impact = await InventoryManager.calculateMultipleServicesInventoryImpact(servicesAddedIds, customerGender, tenantId);
        for (const productImpact of impact.impactSummary) {
          await Product.updateOne(
            { _id: productImpact.productId, tenantId },
            { $inc: { totalQuantity: -productImpact.usageQuantity } }, // Using totalQuantity as per InventoryManager
            { session: dbSession }
          );
        }
      }

      // Handle removed services -> Add stock back
      if (servicesRemovedIds.length > 0) {
        const impact = await InventoryManager.calculateMultipleServicesInventoryImpact(servicesRemovedIds, customerGender, tenantId);
        for (const productImpact of impact.impactSummary) {
          await Product.updateOne(
            { _id: productImpact.productId, tenantId },
            { $inc: { totalQuantity: productImpact.usageQuantity } }, // Using totalQuantity as per InventoryManager
            { session: dbSession }
          );
        }
      }
    }

    // The rest of the logic remains the same...
    const loyaltySettingDoc = await Setting.findOne({ key: 'loyalty', tenantId }).session(dbSession).lean();
    let pointsDifference = 0;
    if (loyaltySettingDoc?.value) {
      const { rupeesForPoints, pointsAwarded } = loyaltySettingDoc.value;
      if (rupeesForPoints > 0 && pointsAwarded > 0) {
        const oldGrandTotal = originalInvoice.grandTotal || 0;
        const newGrandTotal = grandTotal;
        const oldPoints = Math.floor(oldGrandTotal / rupeesForPoints) * pointsAwarded;
        const newPoints = Math.floor(newGrandTotal / rupeesForPoints) * pointsAwarded;
        pointsDifference = newPoints - oldPoints;
      }
    }
    
    const invoiceUpdateData = {
      lineItems: items, grandTotal, membershipDiscount, paymentDetails, 
      billingStaffId, serviceTotal, productTotal, subtotal, notes, customerId,
      manualDiscount: { type: manualDiscountType, value: manualDiscountValue, appliedAmount: finalManualDiscountApplied, },
      paymentStatus: 'Paid'
    };

    let updatedInvoiceDoc = await Invoice.findOneAndUpdate({ _id: id, tenantId }, invoiceUpdateData, { new: true, session: dbSession, })
      .populate({ path: 'customerId', select: 'name phoneNumber isMembership' })
      .populate({ path: 'billingStaffId', select: 'name email' });
    
    if (!updatedInvoiceDoc) { throw new Error('Invoice not found during update.'); }
    
    if (pointsDifference !== 0 && customerId) {
      await LoyaltyTransaction.create([{
          tenantId: tenantId, customerId, points: Math.abs(pointsDifference),
          type: pointsDifference > 0 ? 'Credit' : 'Debit',
          description: `Point adjustment for corrected invoice #${updatedInvoiceDoc.invoiceNumber || id}`,
          reason: `Invoice Correction`, transactionDate: new Date(),
      }], { session: dbSession });
    }

    const newServiceIds = items.filter(item => item.itemType === 'service').map(serviceItem => serviceItem.itemId);
    const appointmentUpdatePayload = {
      finalAmount: updatedInvoiceDoc.grandTotal, amount: updatedInvoiceDoc.subtotal,
      membershipDiscount: updatedInvoiceDoc.membershipDiscount, paymentDetails: updatedInvoiceDoc.paymentDetails,
      billingStaffId: updatedInvoiceDoc.billingStaffId, serviceIds: newServiceIds, status: 'Paid',
    };
    await Appointment.updateOne({ _id: appointmentId, tenantId }, appointmentUpdatePayload, { session: dbSession });
    
    await dbSession.commitTransaction();

    const updatedInvoice = updatedInvoiceDoc.toObject();
    updatedInvoice.customer = updatedInvoice.customerId;
    updatedInvoice.billingStaff = updatedInvoice.billingStaffId;
    delete updatedInvoice.customerId;
    delete updatedInvoice.billingStaffId;

    return NextResponse.json({
      success: true,
      message: 'Invoice, Inventory, and Appointment updated successfully.',
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