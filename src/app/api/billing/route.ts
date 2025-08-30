// /app/api/billing/route.ts - FINAL CORRECTED VERSION

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import mongoose, { Document, Types } from 'mongoose';
import Appointment, { IAppointment } from '@/models/Appointment';
import Invoice, { IInvoice } from '@/models/invoice';
import Stylist from '@/models/Stylist';
import Customer, { ICustomer } from '@/models/customermodel';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import Setting from '@/models/Setting';
import Product, { IProduct } from '@/models/Product';
import User from '@/models/user';
import { InventoryManager, InventoryUpdate } from '@/lib/inventoryManager';
import { getTenantIdOrBail } from '@/lib/tenant';
import { whatsAppService } from '@/lib/whatsapp';
import { decrypt } from '@/lib/crypto';
import DailySale from '@/models/DailySale';
import IncentiveRule, { IIncentiveRule } from '@/models/IncentiveRule';

const MEMBERSHIP_FEE_ITEM_ID = 'MEMBERSHIP_FEE_PRODUCT_ID';

// Helper function for decryption
const safeDecrypt = (data: string, fieldName: string): string => {
  if (!data) return '';
  // Basic check to see if the data looks like our encrypted format
  if (!/^[0-9a-fA-F]{32,}/.test(data)) { 
    return data; // Assume it's plain text if it doesn't match the pattern
  }
  try {
    return decrypt(data);
  } catch (e: any) {
    console.warn(`Decryption failed for ${fieldName}: ${e.message}. Using as plain text.`);
    return data;
  }
};

// Interface for the shape of the populated invoice, including the full customer object
interface PopulatedInvoiceForReceipt extends Omit<IInvoice, 'customerId' | 'stylistId' | 'billingStaffId'> {
  customerId: ICustomer | null;
  stylistId: { name: string; } | null;
  billingStaffId: { name: string; } | null;
}


export async function POST(req: NextRequest) {
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  let pointsEarned = 0;
  let createdInvoiceId: mongoose.Types.ObjectId | null = null;

  try {
    await connectToDatabase();
    const body = await req.json();

    const {
      appointmentId, customerId, stylistId, billingStaffId, items,
      serviceTotal, productTotal, subtotal, membershipDiscount, grandTotal,
      paymentDetails, notes, customerWasMember, membershipGrantedDuringBilling,
      manualDiscountType, manualDiscountValue, finalManualDiscountApplied,
    } = body;

    const lineItemsWithTenantId = items.map((item: any) => ({
      ...item,
      tenantId: tenantId,
    }));

    // --- 1. PRE-VALIDATION ---
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      throw new Error('Invalid or missing Appointment ID.');
    }
    const totalPaid = Object.values(paymentDetails).reduce((sum: number, amount: unknown) => sum + (Number(amount) || 0), 0);
    if (Math.abs(totalPaid - grandTotal) > 0.01) {
      throw new Error(`Payment amount mismatch. Grand Total: ₹${grandTotal.toFixed(2)}, Paid: ₹${totalPaid.toFixed(2)}`);
    }

    // --- 2. CRITICAL STOCK VALIDATION ---
    const productItemsToBill = items.filter((item: any) => item.itemType === 'product' && item.itemId !== MEMBERSHIP_FEE_ITEM_ID);
    if (productItemsToBill.length > 0) {
      const productIds = productItemsToBill.map((item: any) => item.itemId);
      const productsInDb = await Product.find({ _id: { $in: productIds }, tenantId }).session(dbSession);
      if (productsInDb.length !== productIds.length) {
        throw new Error('One or more products being billed are invalid for this salon.');
      }
      const productMap = new Map(productsInDb.map(p => [p._id.toString(), p]));
      for (const item of productItemsToBill) {
        const dbProduct = productMap.get(item.itemId);
        if (!dbProduct || dbProduct.numberOfItems < item.quantity) {
          throw new Error(`Insufficient stock for "${item.name}". Requested: ${item.quantity}, Available: ${dbProduct?.numberOfItems || 0}.`);
        }
      }
    }

    // --- 3. DATA FETCHING ---
    const appointment = await Appointment.findOne({ _id: appointmentId, tenantId }).populate('serviceIds').session(dbSession) as (IAppointment & Document) | null;
    if (!appointment) throw new Error('Appointment not found');
    if (appointment.status === 'Paid') {
      throw new Error('This appointment has already been paid for.');
    }
    const customer = await Customer.findOne({ _id: customerId, tenantId }).session(dbSession) as (ICustomer & Document) | null;
    if (!customer) throw new Error('Customer not found');
    const customerGender = customer.gender || 'other';

    // --- 4. INVENTORY LOGIC ---
    let allInventoryUpdates: InventoryUpdate[] = [];
    let lowStockProducts: IProduct[] = [];
    const serviceIds = (appointment.serviceIds as any[]).map((s: any) => s._id.toString());
    if (serviceIds.length > 0) {
      const { totalUpdates: serviceProductUpdates } = await InventoryManager.calculateMultipleServicesInventoryImpact(
        serviceIds, customerGender, tenantId
      );
      allInventoryUpdates.push(...serviceProductUpdates);
    }
    const retailProductUpdates: InventoryUpdate[] = productItemsToBill.map((item: any) => ({
      productId: item.itemId,
      productName: item.name,
      quantityToDeduct: item.quantity,
      unit: 'piece',
    }));
    allInventoryUpdates.push(...retailProductUpdates);
    if (allInventoryUpdates.length > 0) {
      const inventoryUpdateResult = await InventoryManager.applyInventoryUpdates(allInventoryUpdates, dbSession, tenantId);
      if (inventoryUpdateResult.success) {
        lowStockProducts = inventoryUpdateResult.lowStockProducts;
      } else {
        const errorMessages = inventoryUpdateResult.errors.map(e => e.message).join(', ');
        throw new Error('One or more inventory updates failed: ' + errorMessages);
      }
    }

    // --- 5. CREATE INVOICE ---
    const invoice = new Invoice({
      tenantId,
      appointmentId,
      customerId,
      stylistId,
      billingStaffId,
      lineItems: lineItemsWithTenantId,
      serviceTotal,
      productTotal,
      subtotal,
      membershipDiscount,
      grandTotal,
      paymentDetails,
      notes,
      customerWasMember,
      membershipGrantedDuringBilling,
      paymentStatus: 'Paid',
      manualDiscount: {
        type: manualDiscountType || null, value: manualDiscountValue || 0,
        appliedAmount: finalManualDiscountApplied || 0,
      }
    });
    await invoice.save({ session: dbSession });
    createdInvoiceId = invoice._id;

    // --- 6. UPDATE APPOINTMENT ---
    await Appointment.updateOne({ _id: appointmentId, tenantId }, {
      amount: subtotal,
      membershipDiscount,
      finalAmount: grandTotal,
      paymentDetails,
      billingStaffId,
      invoiceId: invoice._id,
      status: 'Paid',
    }, { session: dbSession });

    // --- 7. LOYALTY POINTS LOGIC ---
    const loyaltySettingDoc = await Setting.findOne({ key: 'loyalty', tenantId }).session(dbSession);
    if (loyaltySettingDoc?.value && grandTotal > 0) {
      const { rupeesForPoints, pointsAwarded: awarded } = loyaltySettingDoc.value;
      if (rupeesForPoints > 0 && awarded > 0) {
        pointsEarned = Math.floor(grandTotal / rupeesForPoints) * awarded;
        if (pointsEarned > 0) {
          await LoyaltyTransaction.create([{
            tenantId,
            customerId,
            points: pointsEarned,
            type: 'Credit',
            description: `Earned from an invoice`,
            reason: `Invoice`,
            transactionDate: new Date(),
          }], { session: dbSession });
        }
      }
    }

    // --- 8. UPDATE STYLIST ---
    if (stylistId) {
      await Stylist.updateOne({ _id: stylistId, tenantId }, {
        isAvailable: true,
        currentAppointmentId: null,
        lastAvailabilityChange: new Date(),
      }, { session: dbSession });
    }

    // --- 8a. UPDATE INCENTIVES (WITH CUSTOMER COUNT) ---
    const allStaffIdsInvolved = [...new Set(items.map((item: any) => item.staffId).filter(Boolean).map(String))];
    if (allStaffIdsInvolved.length > 0) {
        const correctDate = appointment.appointmentDateTime;
        const dayStart = new Date(Date.UTC(correctDate.getUTCFullYear(), correctDate.getUTCMonth(), correctDate.getUTCDate()));
        const dayEnd = new Date(Date.UTC(correctDate.getUTCFullYear(), correctDate.getUTCMonth(), correctDate.getUTCDate(), 23, 59, 59, 999));
        const activeRuleDb = await IncentiveRule.findOne({ type: 'daily', tenantId, createdAt: { $lte: dayEnd } }).sort({ createdAt: -1 }).session(dbSession).lean<IIncentiveRule>();
        const defaultDaily = { target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'totalSaleValue' } };
        const ruleSnapshot = { target: { ...defaultDaily.target, ...(activeRuleDb?.target || {}) }, sales: { ...defaultDaily.sales, ...(activeRuleDb?.sales || {}) }, incentive: { ...defaultDaily.incentive, ...(activeRuleDb?.incentive || {}) } };
        const allPaidInvoicesForDay = await Invoice.find({ tenantId, createdAt: { $gte: dayStart, $lte: dayEnd }, paymentStatus: 'Paid' }).session(dbSession).lean();
        for (const staffId of allStaffIdsInvolved) {
            let newServiceSale = 0;
            let newProductSale = 0;
            const customerIds = new Set<string>();
            for (const item of items) { if (item.staffId?.toString() === staffId) { if (item.itemType === 'service') newServiceSale += item.finalPrice; if (item.itemType === 'product') newProductSale += item.finalPrice; } }
            for (const inv of [...allPaidInvoicesForDay, invoice.toObject()]) { for (const item of (inv.lineItems || [])) { if (item.staffId?.toString() === staffId) { customerIds.add(inv.customerId.toString()); break; } } }
            if (newServiceSale > 0 || newProductSale > 0) {
                await DailySale.findOneAndUpdate( { staff: staffId, date: dayStart, tenantId }, { $inc: { serviceSale: newServiceSale, productSale: newProductSale, }, $set: { customerCount: customerIds.size, appliedRule: ruleSnapshot, tenantId: tenantId }, $setOnInsert: { reviewsWithName: 0, reviewsWithPhoto: 0 } }, { new: true, upsert: true, setDefaultsOnInsert: true, session: dbSession });
            }
        }
    }

    // --- 9. COMMIT TRANSACTION ---
    await dbSession.commitTransaction();

    // --- 10. POST-TRANSACTION ACTIONS (WHATSAPP NOTIFICATION) ---
    if (customer && customer.phoneNumber) {
      try {
        let billingStaffName = 'Staff';
        if (billingStaffId && mongoose.Types.ObjectId.isValid(billingStaffId)) {
          const billingUser = await User.findById(billingStaffId, 'name').lean().exec() as { name: string } | null;
          if (billingUser && billingUser.name) {
            billingStaffName = billingUser.name;
          } else { console.warn('Billing staff not found in User model for ID:', billingStaffId); }
        }
        const decryptedPhone = safeDecrypt(customer.phoneNumber, 'phoneNumber');
        const decryptedName = safeDecrypt(customer.name, 'name');
        const cleanPhone = decryptedPhone.replace(/\D/g, '');

        if (cleanPhone.length >= 10) {
          const serviceItems = items.filter((item: any) => item.itemType === 'service' || item.itemType === 'fee');
          const servicesText = serviceItems.length > 0 ? serviceItems.map((item: any) => `${item.name} x${item.quantity} = ₹${item.finalPrice.toFixed(0)}`).join(', ') : '';
          const productItems = items.filter((item: any) => item.itemType === 'product');
          const productsText = productItems.length > 0 ? productItems.map((item: any) => `${item.name} x${item.quantity} = ₹${item.finalPrice.toFixed(0)}`).join(', ') : '';
          const totalDiscountAmount = (membershipDiscount || 0) + (finalManualDiscountApplied || 0);
          const discountsText = totalDiscountAmount > 0 ? `₹${totalDiscountAmount.toFixed(0)} saved` : '';
          const paymentSummary = Object.entries(paymentDetails).filter(([_, amount]) => Number(amount) > 0).map(([method, _]) => method.charAt(0).toUpperCase() + method.slice(1)).join(', ');
          await whatsAppService.sendBillingConfirmation({ phoneNumber: cleanPhone, customerName: decryptedName, servicesDetails: servicesText, productsDetails: productsText, finalAmount: `₹${grandTotal.toFixed(0)}`, discountsApplied: discountsText, paymentMethod: paymentSummary, staffName: billingStaffName, loyaltyPoints: `${pointsEarned} points`, });
          console.log('WhatsApp billing confirmation sent successfully.');
        } else { console.warn(`Invalid phone number: '${cleanPhone}', skipping WhatsApp notification.`); }
      } catch (whatsappError: unknown) {
        const errorMessage = (whatsappError instanceof Error) ? whatsappError.message : String(whatsappError);
        console.error('Failed to send WhatsApp billing confirmation:', errorMessage);
      }
    } else { console.warn("No customer phone number found. Skipping billing confirmation message."); }
    
    // ===================================================================
    // PREPARE AND SEND FINAL RESPONSE FOR RECEIPT
    // ===================================================================

    if (!createdInvoiceId) {
      throw new Error("Invoice was created but its ID was not captured.");
    }
    
    const populatedInvoice = await Invoice.findById(createdInvoiceId)
      .populate('customerId')
      .populate('stylistId')
      .populate('billingStaffId')
      .lean() as PopulatedInvoiceForReceipt | null;

    if (!populatedInvoice) {
      throw new Error('Failed to retrieve the created invoice after saving.');
    }

    const customerName = populatedInvoice.customerId ? safeDecrypt(populatedInvoice.customerId.name, 'customerName') : 'N/A';
    const stylistName = populatedInvoice.stylistId ? populatedInvoice.stylistId.name : 'N/A';
    const billingStaffName = populatedInvoice.billingStaffId ? populatedInvoice.billingStaffId.name : 'N/A';

    const responsePayload = {
      _id: populatedInvoice._id.toString(),
      invoiceNumber: populatedInvoice.invoiceNumber,
      grandTotal: populatedInvoice.grandTotal,
      createdAt: populatedInvoice.createdAt.toISOString(),
      finalManualDiscountApplied: populatedInvoice.manualDiscount.appliedAmount,
      membershipDiscount: populatedInvoice.membershipDiscount,
      paymentDetails: populatedInvoice.paymentDetails,
      lineItems: populatedInvoice.lineItems,
      customer: { name: customerName },
      stylist: { name: stylistName },
      billingStaff: { name: billingStaffName },
    };
    
    return NextResponse.json({
      success: true,
      invoice: responsePayload,
    });
    // ===================================================================

  } catch (error: any) {
    await dbSession.abortTransaction();
    console.error("Billing transaction failed and was aborted:", error);
    if (error.name === 'ValidationError') {
      return NextResponse.json({ success: false, message: `Validation Error: ${error.message}` }, { status: 400 });
    }
    const errorMessage = error.message || String(error);
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  } finally {
    dbSession.endSession();
  }
}