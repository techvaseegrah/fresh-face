// ===================================================================================
//  API ROUTE: /api/billing
//  Handles the entire billing finalization process for an appointment.
//  This is a critical, transactional endpoint that:
//  1. Validates payment, stock, and gift cards.
//  2. Creates an invoice.
//  3. Updates inventory, appointment status, stylist status, and incentives.
//  4. Processes loyalty points.
//  5. Issues new gift cards (if purchased).
//  6. Sends a WhatsApp confirmation.
// ===================================================================================

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
import { GiftCard } from '@/models/GiftCard';
import { GiftCardLog } from '@/models/GiftCardLog';

const MEMBERSHIP_FEE_ITEM_ID = 'MEMBERSHIP_FEE_PRODUCT_ID';

// Helper function for decryption
const safeDecrypt = (data: string, fieldName: string): string => {
  if (!data) return '';
  if (!/^[0-9a-fA-F]{32,}/.test(data)) { return data; }
  try { return decrypt(data); } catch (e: any) { console.warn(`Decryption failed for ${fieldName}: ${e.message}. Using as plain text.`); return data; }
};

// Interface for the shape of the populated invoice returned to the frontend
interface PopulatedInvoiceForReceipt extends Omit<IInvoice, 'customerId' | 'stylistId' | 'billingStaffId'> {
  customerId: ICustomer | null;
  stylistId: { name: string; } | null;
  billingStaffId: { name: string; } | null;
}

// ===================================================================================
//  MAIN POST HANDLER
// ===================================================================================
export async function POST(req: NextRequest) {
  
  // SECTION 0: INITIAL SETUP AND SECURITY
  // -----------------------------------------------------------------------------------
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;

  // Start a MongoDB session to perform all database operations as an atomic transaction.
  // This means either ALL operations succeed, or they ALL fail and get rolled back.
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  let pointsEarned = 0;
  let createdInvoiceId: mongoose.Types.ObjectId | null = null;

  try {
    await connectToDatabase();
    
    // SECTION 1: REQUEST BODY DESTRUCTURING & PRE-VALIDATION
    // -----------------------------------------------------------------------------------
    const body = await req.json();
    const {
      appointmentId, customerId, stylistId, billingStaffId, items,
      serviceTotal, productTotal, subtotal, membershipDiscount, grandTotal,
      paymentDetails, notes, customerWasMember, membershipGrantedDuringBilling,
      manualDiscountType, manualDiscountValue, finalManualDiscountApplied,
      giftCardRedemption, // Data for redeeming an existing gift card
    } = body;

    const lineItemsWithTenantId = items.map((item: any) => ({ ...item, tenantId: tenantId, }));

    // Validate that the total paid amount (including gift card) matches the grand total.
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) { throw new Error('Invalid or missing Appointment ID.'); }
    const totalPaidByMethods = Object.values(paymentDetails).reduce((sum: number, amount: unknown) => sum + (Number(amount) || 0), 0);
    const giftCardAmountPaid = giftCardRedemption?.amount || 0;
    const totalPaid = totalPaidByMethods + giftCardAmountPaid;
    if (Math.abs(totalPaid - grandTotal) > 0.01) { throw new Error(`Payment amount mismatch. Grand Total: ₹${grandTotal.toFixed(2)}, Paid: ₹${totalPaid.toFixed(2)}`); }

    
    // SECTION 2: GIFT CARD REDEMPTION LOGIC (TRANSACTIONAL)
    // -----------------------------------------------------------------------------------
    // If a gift card is being used for payment, validate and update its balance.
    if (giftCardRedemption && giftCardRedemption.cardId && giftCardRedemption.amount > 0) {
        const { cardId, amount } = giftCardRedemption;
        // Find the card within the transaction session.
        const giftCard = await GiftCard.findById(cardId).session(dbSession);
        // Security and validation checks.
        if (!giftCard || giftCard.tenantId.toString() !== tenantId) { throw new Error("Applied gift card not found for this salon."); }
        if (giftCard.status !== 'active') { throw new Error(`Applied gift card is not active (status: ${giftCard.status}).`); }
        if (giftCard.currentBalance < amount) { throw new Error(`Insufficient gift card balance. Available: ${giftCard.currentBalance}, Tried to use: ${amount}.`); }
        // Update the card's balance and status.
        giftCard.currentBalance -= amount;
        if (giftCard.currentBalance < 0.01) { giftCard.status = 'redeemed'; }
        await giftCard.save({ session: dbSession });
    }

    // SECTION 3: CRITICAL STOCK VALIDATION (TRANSACTIONAL)
    // -----------------------------------------------------------------------------------
    // Before creating an invoice, ensure all products being sold are actually in stock.
    const productItemsToBill = items.filter((item: any) => item.itemType === 'product' && item.itemId !== MEMBERSHIP_FEE_ITEM_ID);
    if (productItemsToBill.length > 0) {
      const productIds = productItemsToBill.map((item: any) => item.itemId);
      const productsInDb = await Product.find({ _id: { $in: productIds }, tenantId }).session(dbSession);
      if (productsInDb.length !== productIds.length) { throw new Error('One or more products being billed are invalid for this salon.'); }
      const productMap = new Map(productsInDb.map(p => [p._id.toString(), p]));
      for (const item of productItemsToBill) { const dbProduct = productMap.get(item.itemId); if (!dbProduct || dbProduct.numberOfItems < item.quantity) { throw new Error(`Insufficient stock for "${item.name}". Requested: ${item.quantity}, Available: ${dbProduct?.numberOfItems || 0}.`); } }
    }

    // SECTION 4: CORE DATA FETCHING (TRANSACTIONAL)
    // -----------------------------------------------------------------------------------
    const appointment = await Appointment.findOne({ _id: appointmentId, tenantId }).populate('serviceIds').session(dbSession) as (IAppointment & Document) | null;
    if (!appointment) throw new Error('Appointment not found');
    if (appointment.status === 'Paid') { throw new Error('This appointment has already been paid for.'); }
    const customer = await Customer.findOne({ _id: customerId, tenantId }).session(dbSession) as (ICustomer & Document) | null;
    if (!customer) throw new Error('Customer not found');
    const customerGender = customer.gender || 'other';

    // SECTION 5: INVENTORY DEDUCTION LOGIC (TRANSACTIONAL)
    // -----------------------------------------------------------------------------------
    // Calculate and apply deductions from inventory for services (consumables) and retail products.
    let allInventoryUpdates: InventoryUpdate[] = [];
    if (items.some((item: any) => item.itemType === 'service' || item.itemType === 'product')) {
        const serviceItemsInBill = items.filter((item: any) => item.itemType === 'service');
        const serviceIds = serviceItemsInBill.map((s: any) => s.itemId);
        if (serviceIds.length > 0) { const { totalUpdates: serviceProductUpdates } = await InventoryManager.calculateMultipleServicesInventoryImpact(serviceIds, customerGender, tenantId); allInventoryUpdates.push(...serviceProductUpdates); }
        const retailProductUpdates: InventoryUpdate[] = productItemsToBill.map((item: any) => ({ productId: item.itemId, productName: item.name, quantityToDeduct: item.quantity, unit: 'piece' }));
        allInventoryUpdates.push(...retailProductUpdates);
        if (allInventoryUpdates.length > 0) { const inventoryUpdateResult = await InventoryManager.applyInventoryUpdates(allInventoryUpdates, dbSession, tenantId); if (!inventoryUpdateResult.success) { const errorMessages = inventoryUpdateResult.errors.map(e => e.message).join(', '); throw new Error('One or more inventory updates failed: ' + errorMessages); } }
    }

    // SECTION 6: INVOICE CREATION (TRANSACTIONAL)
    // -----------------------------------------------------------------------------------
    // Create the primary invoice record, which is the source of truth for the sale.
    const invoice = new Invoice({ tenantId, appointmentId, customerId, stylistId, billingStaffId, lineItems: lineItemsWithTenantId, serviceTotal, productTotal, subtotal, membershipDiscount, grandTotal, paymentDetails, notes, customerWasMember, membershipGrantedDuringBilling, paymentStatus: 'Paid', manualDiscount: { type: manualDiscountType || null, value: manualDiscountValue || 0, appliedAmount: finalManualDiscountApplied || 0 }, giftCardPayment: giftCardRedemption ? { cardId: giftCardRedemption.cardId, amount: giftCardRedemption.amount } : undefined });
    await invoice.save({ session: dbSession });
    createdInvoiceId = invoice._id;

    // SECTION 7: LOGGING & RELATED DOCUMENT UPDATES (TRANSACTIONAL)
    // -----------------------------------------------------------------------------------
    // --- A. Create Gift Card Redemption Log ---
    if (giftCardRedemption && giftCardRedemption.cardId && giftCardRedemption.amount > 0) { const giftCard = await GiftCard.findById(giftCardRedemption.cardId).session(dbSession); if (giftCard) { await GiftCardLog.create([{ tenantId, giftCardId: giftCardRedemption.cardId, invoiceId: createdInvoiceId, customerId, amountRedeemed: giftCardRedemption.amount, balanceBefore: giftCard.currentBalance + giftCardRedemption.amount, balanceAfter: giftCard.currentBalance, }], { session: dbSession }); } }
    
    // --- B. Update Appointment Status ---
    await Appointment.updateOne({ _id: appointmentId, tenantId }, { amount: subtotal, membershipDiscount, finalAmount: grandTotal, paymentDetails, billingStaffId, invoiceId: invoice._id, status: 'Paid', }, { session: dbSession });
    
    // --- C. Process Loyalty Points ---
    const loyaltySettingDoc = await Setting.findOne({ key: 'loyalty', tenantId }).session(dbSession);
    if (loyaltySettingDoc?.value && grandTotal > 0) { const { rupeesForPoints, pointsAwarded: awarded } = loyaltySettingDoc.value; if (rupeesForPoints > 0 && awarded > 0) { pointsEarned = Math.floor(grandTotal / rupeesForPoints) * awarded; if (pointsEarned > 0) { await LoyaltyTransaction.create([{ tenantId, customerId, points: pointsEarned, type: 'Credit', description: `Earned from an invoice`, reason: `Invoice`, transactionDate: new Date(), }], { session: dbSession }); } } }
    
    // --- D. Update Stylist Availability ---
    if (stylistId) { await Stylist.updateOne({ _id: stylistId, tenantId }, { isAvailable: true, currentAppointmentId: null, lastAvailabilityChange: new Date(), }, { session: dbSession }); }

    // --- E. Update Staff Daily Sales for Incentives ---
    const allStaffIdsInvolved = [...new Set(items.map((item: any) => item.staffId).filter(Boolean).map(String))];
    if (allStaffIdsInvolved.length > 0) {
        const correctDate = appointment.appointmentDateTime;
        const dayStart = new Date(Date.UTC(correctDate.getUTCFullYear(), correctDate.getUTCMonth(), correctDate.getUTCDate()));
        const dayEnd = new Date(Date.UTC(correctDate.getUTCFullYear(), correctDate.getUTCMonth(), correctDate.getUTCDate(), 23, 59, 59, 999));
        const activeRuleDb = await IncentiveRule.findOne({ type: 'daily', tenantId, createdAt: { $lte: dayEnd } }).sort({ createdAt: -1 }).session(dbSession).lean<IIncentiveRule>();
        const defaultDaily = { target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 }, incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'totalSaleValue' } };
        const ruleSnapshot = { target: { ...defaultDaily.target, ...(activeRuleDb?.target || {}) }, sales: { ...defaultDaily.sales, ...(activeRuleDb?.sales || {}) }, incentive: { ...defaultDaily.incentive, ...(activeRuleDb?.incentive || {}) } };
        const allPaidInvoicesForDay = await Invoice.find({ tenantId, createdAt: { $gte: dayStart, $lte: dayEnd }, paymentStatus: 'Paid' }).session(dbSession).lean();
        for (const staffId of allStaffIdsInvolved) { let newServiceSale = 0; let newProductSale = 0; const customerIds = new Set<string>(); for (const item of items) { if (item.staffId?.toString() === staffId) { if (item.itemType === 'service') newServiceSale += item.finalPrice; if (item.itemType === 'product') newProductSale += item.finalPrice; } } for (const inv of [...allPaidInvoicesForDay, invoice.toObject()]) { for (const item of (inv.lineItems || [])) { if (item.staffId?.toString() === staffId) { customerIds.add(inv.customerId.toString()); break; } } } if (newServiceSale > 0 || newProductSale > 0) { await DailySale.findOneAndUpdate( { staff: staffId, date: dayStart, tenantId }, { $inc: { serviceSale: newServiceSale, productSale: newProductSale, }, $set: { customerCount: customerIds.size, appliedRule: ruleSnapshot, tenantId: tenantId }, $setOnInsert: { reviewsWithName: 0, reviewsWithPhoto: 0 } }, { new: true, upsert: true, setDefaultsOnInsert: true, session: dbSession }); } }
    }

    // SECTION 8: COMMIT TRANSACTION
    // -----------------------------------------------------------------------------------
    // If all previous operations were successful, commit the changes to the database.
    await dbSession.commitTransaction();

    // SECTION 9: POST-TRANSACTION ACTIONS (NON-TRANSACTIONAL)
    // -----------------------------------------------------------------------------------
    // These actions are performed after the payment is secured.
    // A failure here will NOT roll back the payment.
    
    // --- A. GIFT CARD ISSUING TRIGGER ---
    // If a gift card was PURCHASED, call the API to create the unique card instance.
    const newlyIssuedCards = []; 
for (const item of items) {
  if (item.itemType === 'gift_card') {
    try {
      const url = new URL('/api/billing/issue-gift-card', process.env.NEXTAUTH_URL || 'http://localhost:3000');
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': req.headers.get('cookie') || '', 'x-tenant-id': tenantId, },
        body: JSON.stringify({ templateId: item.itemId, customerId: customerId, invoiceId: createdInvoiceId, staffId: item.staffId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to issue gift card, status: ${response.status}`);
      }
      
      // Capture the response and add it to our array
      const issuedCard = await response.json();
      newlyIssuedCards.push(issuedCard);

      console.log(`Successfully triggered gift card issue for template: ${item.itemId}`);
    } catch (issueError) {
      console.error(`CRITICAL FAILURE: Payment taken but failed to issue gift card. Invoice: ${createdInvoiceId}, Template: ${item.itemId}`, issueError);
    }
  }
}

    // --- B. WHATSAPP NOTIFICATION ---
    if (customer && customer.phoneNumber) {
      try {
        let billingStaffName = 'Staff';
        if (billingStaffId && mongoose.Types.ObjectId.isValid(billingStaffId)) {
          const billingUser = await User.findById(billingStaffId, 'name').lean().exec() as { name: string } | null;
          if (billingUser?.name) { billingStaffName = billingUser.name; } 
          else { console.warn('Billing staff not found in User model for ID:', billingStaffId); }
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
          
          let paymentMethods = Object.entries(paymentDetails).filter(([_, amount]) => Number(amount) > 0).map(([method, _]) => method.charAt(0).toUpperCase() + method.slice(1));
          if (giftCardRedemption && giftCardRedemption.amount > 0) { paymentMethods.unshift('Gift Card'); }
          const paymentSummary = paymentMethods.join(', ');

          await whatsAppService.sendBillingConfirmation({ phoneNumber: cleanPhone, customerName: decryptedName, servicesDetails: servicesText, productsDetails: productsText, finalAmount: `₹${grandTotal.toFixed(0)}`, discountsApplied: discountsText, paymentMethod: paymentSummary, staffName: billingStaffName, loyaltyPoints: `${pointsEarned} points`, });
          console.log('WhatsApp billing confirmation sent successfully.');
        } else { console.warn(`Invalid phone number: '${cleanPhone}', skipping WhatsApp notification.`); }
      } catch (whatsappError: unknown) {
        const errorMessage = (whatsappError instanceof Error) ? whatsappError.message : String(whatsappError);
        console.error('Failed to send WhatsApp billing confirmation:', errorMessage);
      }
    } else { console.warn("No customer phone number found. Skipping billing confirmation message."); }
    
    // SECTION 10: PREPARE AND SEND FINAL RESPONSE
    // -----------------------------------------------------------------------------------
    // Fetch the newly created invoice with populated details to send back to the frontend for the receipt.
    if (!createdInvoiceId) { throw new Error("Invoice was created but its ID was not captured."); }
    const populatedInvoice = await Invoice.findById(createdInvoiceId).populate('customerId').populate('stylistId').populate('billingStaffId').lean() as IInvoice & PopulatedInvoiceForReceipt | null;
    if (!populatedInvoice) { throw new Error('Failed to retrieve the created invoice after saving.'); }

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
      giftCardPayment: populatedInvoice.giftCardPayment, // This is crucial for the receipt
     issuedGiftCards: newlyIssuedCards, // Add the array of new cards to the response
    };
    
    return NextResponse.json({ success: true, invoice: responsePayload, });

  } catch (error: any) {
    // FINAL BLOCKS: ERROR HANDLING & CLEANUP
    // -----------------------------------------------------------------------------------
    // If any error occurred in the `try` block, abort the transaction and roll back all changes.
    await dbSession.abortTransaction();
    console.error("Billing transaction failed and was aborted:", error);
    if (error.name === 'ValidationError') { return NextResponse.json({ success: false, message: `Validation Error: ${error.message}` }, { status: 400 }); }
    const errorMessage = error.message || String(error);
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  } finally {
    // Always end the session to release resources on the database server.
    dbSession.endSession();
  }
}