// /api/billing/route.ts

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
import CustomerPackage from '@/models/CustomerPackage';
import CustomerPackageLog from '@/models/CustomerPackageLog';
import PackageTemplate from '@/models/PackageTemplate';
import Staff from '@/models/staff';

const MEMBERSHIP_FEE_ITEM_ID = 'MEMBERSHIP_FEE_PRODUCT_ID';

const safeDecrypt = (data: string, fieldName: string): string => {
  if (!data) return '';
  if (!/^[0-9a-fA-F]{32,}/.test(data)) { return data; }
  try { return decrypt(data); } catch (e: any) { console.warn(`Decryption failed for ${fieldName}: ${e.message}. Using as plain text.`); return data; }
};

interface PopulatedInvoiceForReceipt extends Omit<IInvoice, 'customerId' | 'stylistId' | 'billingStaffId'> {
  customerId: ICustomer | null;
  stylistId: { name: string; } | null;
  billingStaffId: { name: string; } | null;
}

// ✅ FIX: The logic inside this function has been updated to be correct.
export async function recalculateAndSaveDailySale(
    { tenantId, staffIds, date, dbSession }:
    { tenantId: string, staffIds: string[], date: Date, dbSession: mongoose.ClientSession }
) {
    if (staffIds.length === 0) return;

    const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));

    // --- START OF THE FIX ---
    // 1. Find all appointments for the target date first.
    const appointmentsForDay = await Appointment.find({
        tenantId,
        appointmentDateTime: { $gte: dayStart, $lte: dayEnd }
    }).select('_id').session(dbSession).lean();

    const appointmentIdsForDay = appointmentsForDay.map(a => a._id);

    // 2. Now find all paid invoices linked to those specific appointments.
    // This correctly captures all relevant sales regardless of when the invoice was created or updated.
    const allInvoicesForDay = await Invoice.find({
        tenantId,
        appointmentId: { $in: appointmentIdsForDay },
        paymentStatus: 'Paid'
    }).session(dbSession).lean();
    // --- END OF THE FIX ---

    const dailyRule = await IncentiveRule.findOne({ type: 'daily', tenantId, createdAt: { $lte: dayEnd } }).sort({ createdAt: -1 }).session(dbSession).lean();
    const monthlyRule = await IncentiveRule.findOne({ type: 'monthly', tenantId, createdAt: { $lte: dayEnd } }).sort({ createdAt: -1 }).session(dbSession).lean();
    const packageRule = await IncentiveRule.findOne({ type: 'package', tenantId, createdAt: { $lte: dayEnd } }).sort({ createdAt: -1 }).session(dbSession).lean();
    const giftCardRule = await IncentiveRule.findOne({ type: 'giftCard', tenantId, createdAt: { $lte: dayEnd } }).sort({ createdAt: -1 }).session(dbSession).lean();

    const ruleSnapshot = {
        daily: dailyRule,
        monthly: monthlyRule,
        package: packageRule,
        giftCard: giftCardRule,
    };

    const salesByStaff = new Map<string, { serviceSale: number, productSale: number, packageSale: number, giftCardSale: number }>();
    const customersByStaff = new Map<string, Set<string>>();

    for (const invoice of allInvoicesForDay) {
        for (const item of (invoice.lineItems || [])) {
            if (!item.staffId) continue;
            const staffIdStr = item.staffId.toString();

            if (!salesByStaff.has(staffIdStr)) {
                salesByStaff.set(staffIdStr, { serviceSale: 0, productSale: 0, packageSale: 0, giftCardSale: 0 });
                customersByStaff.set(staffIdStr, new Set<string>());
            }

            const totals = salesByStaff.get(staffIdStr)!;
            if (item.itemType === 'service') totals.serviceSale += item.finalPrice;
            if (item.itemType === 'product') totals.productSale += item.finalPrice;
            if (item.itemType === 'package') totals.packageSale += item.finalPrice;
            if (item.itemType === 'gift_card') totals.giftCardSale += item.finalPrice;

            const customerSet = customersByStaff.get(staffIdStr);
            if (customerSet) {
                customerSet.add(invoice.customerId.toString());
            }
        }
    }

    const allStaffInvolved = [...new Set([...staffIds, ...Array.from(salesByStaff.keys())])];

    for (const staffId of allStaffInvolved) {
        const totals = salesByStaff.get(staffId) || { serviceSale: 0, productSale: 0, packageSale: 0, giftCardSale: 0 };
        const customerCount = customersByStaff.get(staffId)?.size || 0;

        await DailySale.findOneAndUpdate(
            { staff: staffId, date: dayStart, tenantId },
            {
                $set: {
                    serviceSale: totals.serviceSale,
                    productSale: totals.productSale,
                    packageSale: totals.packageSale,
                    giftCardSale: totals.giftCardSale,
                    customerCount: customerCount,
                    appliedRule: ruleSnapshot,
                    tenantId: tenantId
                },
                $setOnInsert: { reviewsWithName: 0, reviewsWithPhoto: 0 }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true, session: dbSession }
        );
    }
}

// ===================================================================================
//  MAIN POST HANDLER (This remains unchanged)
// ===================================================================================
export async function POST(req: NextRequest) {
  // ... (The rest of your POST handler code is unchanged)
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;

  const dbSession = await mongoose.startSession();

  let createdInvoiceId: mongoose.Types.ObjectId | null = null;
  let pointsEarned = 0;
  const newlySoldPackages = [];
  const body = await req.json();
  const {
      appointmentId, customerId, stylistId, billingStaffId, items,
      serviceTotal, productTotal, subtotal, membershipDiscount, grandTotal,
      paymentDetails, notes, customerWasMember, membershipGrantedDuringBilling,
      manualDiscountType, manualDiscountValue, finalManualDiscountApplied,
      giftCardRedemption, packageRedemptions,
  } = body;

  try {
    dbSession.startTransaction();
    await connectToDatabase();

    const lineItemsWithTenantId = items.map((item: any) => ({ ...item, tenantId: tenantId, }));

    const totalPaidByMethods = Object.values(paymentDetails).reduce((sum: number, amount: unknown) => sum + (Number(amount) || 0), 0);
    const giftCardAmountPaid = giftCardRedemption?.amount || 0;
    const totalPaid = totalPaidByMethods + giftCardAmountPaid;
    if (Math.abs(totalPaid - grandTotal) > 0.01) { throw new Error(`Payment amount mismatch. Grand Total: ₹${grandTotal.toFixed(2)}, Paid: ₹${totalPaid.toFixed(2)}`); }

    if (giftCardRedemption && giftCardRedemption.cardId && giftCardRedemption.amount > 0) {
        const { cardId, amount } = giftCardRedemption;
        const giftCard = await GiftCard.findById(cardId).session(dbSession);
        if (!giftCard || giftCard.tenantId.toString() !== tenantId) { throw new Error("Applied gift card not found for this salon."); }
        if (giftCard.status !== 'active') { throw new Error(`Applied gift card is not active (status: ${giftCard.status}).`); }
        if (giftCard.currentBalance < amount) { throw new Error(`Insufficient gift card balance. Available: ${giftCard.currentBalance}, Tried to use: ${amount}.`); }
        giftCard.currentBalance -= amount;
        if (giftCard.currentBalance < 0.01) { giftCard.status = 'redeemed'; }
        await giftCard.save({ session: dbSession });
    }

    if (packageRedemptions && Array.isArray(packageRedemptions) && packageRedemptions.length > 0) {
      for (const redemption of packageRedemptions) {
        const { customerPackageId, redeemedItemId, redeemedItemType, quantityRedeemed } = redemption;
        const customerPackage = await CustomerPackage.findOne({ _id: customerPackageId, tenantId }).session(dbSession);
        if (!customerPackage) { throw new Error(`Package not found.`); }
        if (customerPackage.status !== 'active' || new Date() > customerPackage.expiryDate) {
            if (customerPackage.status === 'active') { customerPackage.status = 'expired'; await customerPackage.save({ session: dbSession }); }
            throw new Error(`Package redemption failed: The package is not active or has expired.`);
        }
        const itemToRedeem = customerPackage.remainingItems.find((item) => item.itemId.toString() === redeemedItemId && item.itemType === redeemedItemType);
        if (!itemToRedeem || itemToRedeem.remainingQuantity < quantityRedeemed) { throw new Error(`Package redemption failed: Insufficient quantity for item ${redeemedItemId}.`); }
        itemToRedeem.remainingQuantity -= quantityRedeemed;
        if (customerPackage.remainingItems.every(item => item.remainingQuantity === 0)) { customerPackage.status = 'completed'; }
        await customerPackage.save({ session: dbSession });
      }
    }

    const packageItemsToSell = items.filter((item: any) => item.itemType === 'package');
    for (const packageItem of packageItemsToSell) {
      const packageTemplateId = packageItem.itemId;
      const purchasePrice = packageItem.finalPrice;
      const template = await PackageTemplate.findById(packageTemplateId).session(dbSession).lean();
      if (!template || !template.isActive) { throw new Error(`The package "${packageItem.name}" is no longer available for sale.`); }
      const purchaseDate = new Date();
      const expiryDate = new Date(purchaseDate);
      expiryDate.setDate(expiryDate.getDate() + template.validityInDays);
      const remainingItems = template.items.map(item => ({ itemType: item.itemType, itemId: item.itemId, totalQuantity: item.quantity, remainingQuantity: item.quantity, }));

      const staffIdForSale = packageItem.staffId;
      if (!staffIdForSale) {
        throw new Error(`The package "${packageItem.name}" must be assigned to a staff member to be sold.`);
      }

      const newCustomerPackage = new CustomerPackage({
        tenantId, customerId, packageTemplateId, purchaseDate, expiryDate, status: 'active', remainingItems, packageName: template.name, purchasePrice: purchasePrice,
        soldBy: staffIdForSale,
      });
      await newCustomerPackage.save({ session: dbSession });
      newlySoldPackages.push(newCustomerPackage.toObject());
    }

    const productItemsToBill = items.filter((item: any) => item.itemType === 'product' && item.itemId !== MEMBERSHIP_FEE_ITEM_ID);
    if (productItemsToBill.length > 0) {
      const productIds = productItemsToBill.map((item: any) => item.itemId);
      const productsInDb = await Product.find({ _id: { $in: productIds }, tenantId }).session(dbSession);
      if (productsInDb.length !== productIds.length) { throw new Error('One or more products being billed are invalid for this salon.'); }
      const productMap = new Map(productsInDb.map(p => [p._id.toString(), p]));
      for (const item of productItemsToBill) { const dbProduct = productMap.get(item.itemId); if (!dbProduct || dbProduct.numberOfItems < item.quantity) { throw new Error(`Insufficient stock for "${item.name}". Requested: ${item.quantity}, Available: ${dbProduct?.numberOfItems || 0}.`); } }
    }

    const appointment = await Appointment.findOne({ _id: appointmentId, tenantId }).populate('serviceIds').session(dbSession) as (IAppointment & Document) | null;
    if (!appointment) throw new Error('Appointment not found');
    if (appointment.status === 'Paid') { throw new Error('This appointment has already been paid for.'); }
    const customer = await Customer.findOne({ _id: customerId, tenantId }).session(dbSession) as (ICustomer & Document) | null;
    if (!customer) throw new Error('Customer not found');
    const customerGender = customer.gender || 'other';

    let allInventoryUpdates: InventoryUpdate[] = [];
    if (items.some((item: any) => item.itemType === 'service' || item.itemType === 'product')) {
        const serviceItemsInBill = items.filter((item: any) => item.itemType === 'service');
        const serviceIds = serviceItemsInBill.map((s: any) => s.itemId);
        if (serviceIds.length > 0) { const { totalUpdates: serviceProductUpdates } = await InventoryManager.calculateMultipleServicesInventoryImpact(serviceIds, customerGender, tenantId); allInventoryUpdates.push(...serviceProductUpdates); }
        const retailProductUpdates: InventoryUpdate[] = productItemsToBill.map((item: any) => ({ productId: item.itemId, productName: item.name, quantityToDeduct: item.quantity, unit: 'piece' }));
        allInventoryUpdates.push(...retailProductUpdates);
        if (allInventoryUpdates.length > 0) { const inventoryUpdateResult = await InventoryManager.applyInventoryUpdates(allInventoryUpdates, dbSession, tenantId); if (!inventoryUpdateResult.success) { const errorMessages = inventoryUpdateResult.errors.map(e => e.message).join(', '); throw new Error('One or more inventory updates failed: ' + errorMessages); } }
    }

    const invoice = new Invoice({ tenantId, appointmentId, customerId, stylistId, billingStaffId, lineItems: lineItemsWithTenantId, serviceTotal, productTotal, subtotal, membershipDiscount, grandTotal, paymentDetails, notes, customerWasMember, membershipGrantedDuringBilling, paymentStatus: 'Paid', manualDiscount: { type: manualDiscountType || null, value: manualDiscountValue || 0, appliedAmount: finalManualDiscountApplied || 0 }, giftCardPayment: giftCardRedemption ? { cardId: giftCardRedemption.cardId, amount: giftCardRedemption.amount } : undefined });
    await invoice.save({ session: dbSession });
    createdInvoiceId = invoice._id;

    if (giftCardRedemption && giftCardRedemption.cardId && giftCardRedemption.amount > 0) { const giftCard = await GiftCard.findById(giftCardRedemption.cardId).session(dbSession); if (giftCard) { await GiftCardLog.create([{ tenantId, giftCardId: giftCardRedemption.cardId, invoiceId: createdInvoiceId, customerId, amountRedeemed: giftCardRedemption.amount, balanceBefore: giftCard.currentBalance + giftCardRedemption.amount, balanceAfter: giftCard.currentBalance, }], { session: dbSession, ordered: true }); } }

    if (packageRedemptions && Array.isArray(packageRedemptions) && packageRedemptions.length > 0) {
      const logEntries = packageRedemptions.map((redemption: any) => {
        const staffIdForRedemption = redemption.redeemedBy;
        if (!staffIdForRedemption) {
          const redeemedItemName = items.find((i: any) => i.itemId === redemption.redeemedItemId)?.name || `item ID ${redemption.redeemedItemId}`;
          throw new Error(`A staff member must be assigned to the redeemed item: "${redeemedItemName}".`);
        }

        return {
          tenantId,
          customerPackageId: redemption.customerPackageId,
          customerId: customerId,
          redeemedItemId: redemption.redeemedItemId,
          redeemedItemType: redemption.redeemedItemType,
          quantityRedeemed: redemption.quantityRedeemed,
          invoiceId: createdInvoiceId,
          redeemedBy: staffIdForRedemption,
        };
      });
      await CustomerPackageLog.create(logEntries, { session: dbSession, ordered: true });
    }

    await Appointment.updateOne({ _id: appointmentId, tenantId }, { amount: subtotal, membershipDiscount, finalAmount: grandTotal, paymentDetails, billingStaffId, invoiceId: invoice._id, status: 'Paid', }, { session: dbSession });

    const loyaltySettingDoc = await Setting.findOne({ key: 'loyalty', tenantId }).session(dbSession);
    if (loyaltySettingDoc?.value && grandTotal > 0) { const { rupeesForPoints, pointsAwarded: awarded } = loyaltySettingDoc.value; if (rupeesForPoints > 0 && awarded > 0) { pointsEarned = Math.floor(grandTotal / rupeesForPoints) * awarded; if (pointsEarned > 0) { await LoyaltyTransaction.create([{ tenantId, customerId, points: pointsEarned, type: 'Credit', description: `Earned from an invoice`, reason: `Invoice`, transactionDate: new Date(), }], { session: dbSession, ordered: true }); } } }

    if (stylistId) { await Stylist.updateOne({ _id: stylistId, tenantId }, { isAvailable: true, currentAppointmentId: null, lastAvailabilityChange: new Date(), }, { session: dbSession }); }

    const allStaffIdsInvolved = [...new Set(items.map((item: any) => item.staffId).filter((id: any) => id != null).map((id: any) => id.toString()))];

    await recalculateAndSaveDailySale({
        tenantId,
        staffIds: allStaffIdsInvolved,
        date: appointment.appointmentDateTime,
        dbSession,
    });

    await dbSession.commitTransaction();

  } catch (error: any) {
    await dbSession.abortTransaction();
    console.error("Billing transaction failed and was aborted:", error);
    dbSession.endSession();
    if (error.name === 'ValidationError') { return NextResponse.json({ success: false, message: `Validation Error: ${error.message}` }, { status: 400 }); }
    const errorMessage = error.message || String(error);
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }

  const newlyIssuedCards = [];
  try {
    for (const item of items) {
      if (item.itemType === 'gift_card') {
        const url = new URL('/api/billing/issue-gift-card', process.env.NEXTAUTH_URL || 'http://localhost:3000');
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cookie': req.headers.get('cookie') || '', 'x-tenant-id': tenantId, },
          body: JSON.stringify({ templateId: item.itemId, customerId: customerId, invoiceId: createdInvoiceId, staffId: item.staffId }),
        });
        if (!response.ok) { throw new Error(`Failed to issue gift card, status: ${response.status}`); }
        const issuedCard = await response.json();
        newlyIssuedCards.push(issuedCard);
      }
    }

    const customerForWhatsApp = await Customer.findById(customerId).lean();
    if (customerForWhatsApp && customerForWhatsApp.phoneNumber) {
      const billingUser = await User.findById(billingStaffId, 'name').lean().exec() as { name: string } | null;
      const billingStaffName = billingUser?.name || 'Staff';
      const decryptedPhone = safeDecrypt(customerForWhatsApp.phoneNumber, 'phoneNumber');
      const decryptedName = safeDecrypt(customerForWhatsApp.name, 'name');
      const cleanPhone = decryptedPhone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        const serviceItems = items.filter((item: any) => item.itemType === 'service' || item.itemType === 'fee');
        const servicesText = serviceItems.map((item: any) => `${item.name} x${item.quantity} = ₹${item.finalPrice.toFixed(0)}`).join(', ');
        const productItems = items.filter((item: any) => item.itemType === 'product');
        const productsText = productItems.map((item: any) => `${item.name} x${item.quantity} = ₹${item.finalPrice.toFixed(0)}`).join(', ');
        const totalDiscountAmount = (membershipDiscount || 0) + (finalManualDiscountApplied || 0);
        const discountsText = totalDiscountAmount > 0 ? `₹${totalDiscountAmount.toFixed(0)} saved` : '';
        let paymentMethods = Object.entries(paymentDetails).filter(([_, amount]) => Number(amount) > 0).map(([method, _]) => method.charAt(0).toUpperCase() + method.slice(1));
        if (giftCardRedemption && giftCardRedemption.amount > 0) { paymentMethods.unshift('Gift Card'); }
        const paymentSummary = paymentMethods.join(', ');
        await whatsAppService.sendBillingConfirmation({ phoneNumber: cleanPhone, customerName: decryptedName, servicesDetails: servicesText, productsDetails: productsText, finalAmount: `₹${grandTotal.toFixed(0)}`, discountsApplied: discountsText, paymentMethod: paymentSummary, staffName: billingStaffName, loyaltyPoints: `${pointsEarned} points`, });
      }
    }
  } catch (postTransactionError: any) {
    console.error("A non-critical, post-transaction error occurred:", postTransactionError.message);
  }

  try {
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
      giftCardPayment: populatedInvoice.giftCardPayment,
      issuedGiftCards: newlyIssuedCards,
      soldPackages: newlySoldPackages,
    };

    return NextResponse.json({ success: true, invoice: responsePayload, });

  } catch (finalResponseError: any) {
    console.error("Error preparing the final successful response:", finalResponseError);
    return NextResponse.json({ success: true, invoiceId: createdInvoiceId?.toString(), message: "Payment successful, but failed to generate full receipt data." });
  } finally {
    dbSession.endSession();
  }
}