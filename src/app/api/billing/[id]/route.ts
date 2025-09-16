import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import mongoose from 'mongoose';
import Invoice from '@/models/invoice';
import Appointment from '@/models/Appointment';
import Customer from '@/models/customermodel';
import Setting from '@/models/Setting';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import Product, { IProduct } from '@/models/Product';
import { getTenantIdOrBail } from '@/lib/tenant';
import { FinalizeBillingPayload } from '@/app/(main)/appointment/billingmodal';
import { recalculateAndSaveDailySale } from '../route';
import { GiftCard } from '@/models/GiftCard';
import { GiftCardLog } from '@/models/GiftCardLog';
import CustomerPackage from '@/models/CustomerPackage';
import CustomerPackageLog from '@/models/CustomerPackageLog';
import PackageTemplate from '@/models/PackageTemplate';
import { GiftCardTemplate } from '@/models/GiftCardTemplate';
import Staff from '@/models/staff';

const generateUniqueCode = async (tenantId: string, session: mongoose.ClientSession, length = 8): Promise<string> => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let isUnique = false;
    let result = '';
    while (!isUnique) {
        result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const existingCard = await GiftCard.findOne({ uniqueCode: result, tenantId }).session(session).lean();
        if (!existingCard) {
            isUnique = true;
        }
    }
    return result;
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // This function remains unchanged
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
    return NextResponse.json({ success: false, message: 'Server error fetching invoice.', error: error.message }, { status: 500 });
  }
}

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
      manualDiscountValue, finalManualDiscountApplied, manualInventoryUpdates,
      giftCardRedemption, packageRedemptions
    } = body;
    
    const originalInvoice = await Invoice.findOne({ _id: id, tenantId }).session(dbSession);
    if (!originalInvoice) {
        throw new Error("Original invoice not found for correction.");
    }
    
    // --- REVERSAL PHASE ---

    // 1. Reverse gift cards used AS PAYMENT
    if (originalInvoice.giftCardPayment?.cardId) {
        await GiftCard.updateOne({ _id: originalInvoice.giftCardPayment.cardId }, { $inc: { currentBalance: originalInvoice.giftCardPayment.amount }, $set: { status: 'active' } }, { session: dbSession });
    }

    // 2. Reverse redeemed package items
    const originalPackageLogs = await CustomerPackageLog.find({ invoiceId: originalInvoice._id, tenantId }).session(dbSession);
    for (const log of originalPackageLogs) {
        await CustomerPackage.updateOne({ _id: log.customerPackageId, 'remainingItems.itemId': log.redeemedItemId }, { $inc: { 'remainingItems.$.remainingQuantity': log.quantityRedeemed }, $set: { status: 'active' } }, { session: dbSession });
    }
    await CustomerPackageLog.deleteMany({ invoiceId: originalInvoice._id, tenantId }).session(dbSession);
    
    // 3. Reverse packages that were SOLD on this invoice
    const oldSoldPackages = await CustomerPackage.find({ purchaseInvoiceId: originalInvoice._id, tenantId }).session(dbSession);
    for(const pkg of oldSoldPackages) {
        const usageLogs = await CustomerPackageLog.countDocuments({ customerPackageId: pkg._id, invoiceId: { $ne: originalInvoice._id } }).session(dbSession);
        if(usageLogs > 0) throw new Error(`Cannot correct invoice. The package "${pkg.packageName}" sold in this bill has already been used on another bill.`);
        await CustomerPackage.deleteOne({ _id: pkg._id }).session(dbSession);
    }

    // 4. --- MODIFIED LOGIC --- Reverse gift cards SOLD on this invoice, but save their codes
    const existingUniqueCodes = new Map<string, string>(); // Key: templateId, Value: uniqueCode
    const oldSoldCards = await GiftCard.find({ purchaseInvoiceId: originalInvoice._id, tenantId }).session(dbSession);
    for(const card of oldSoldCards) {
        if(card.currentBalance < card.initialBalance) throw new Error(`Cannot correct invoice. Gift Card #${card.uniqueCode} sold in this bill has already been used.`);
        
        // Before deleting, save its unique code mapped to its template ID
        existingUniqueCodes.set(card.giftCardTemplateId.toString(), card.uniqueCode);

        await GiftCard.deleteOne({ _id: card._id }).session(dbSession);
    }
    
    // --- APPLICATION PHASE ---
    const newlySoldPackages = [];
    const newlyIssuedGiftCards = [];

    // 1. Apply new gift card redemptions
    if (giftCardRedemption?.cardId && giftCardRedemption.amount > 0) {
        const giftCard = await GiftCard.findById(giftCardRedemption.cardId).session(dbSession);
        if (!giftCard) throw new Error("Applied gift card not found.");
        if (giftCard.currentBalance < giftCardRedemption.amount) throw new Error(`Insufficient gift card balance.`);
        giftCard.currentBalance -= giftCardRedemption.amount;
        if (giftCard.currentBalance < 0.01) giftCard.status = 'redeemed';
        await giftCard.save({ session: dbSession });
    }

    // 2. Apply new package item redemptions
    if (packageRedemptions && packageRedemptions.length > 0) {
      for (const redemption of packageRedemptions) {
        const customerPackage = await CustomerPackage.findById(redemption.customerPackageId).session(dbSession);
        if (!customerPackage) throw new Error(`Package for redemption not found.`);
        const itemToRedeem = customerPackage.remainingItems.find(item => item.itemId.toString() === redemption.redeemedItemId);
        if (!itemToRedeem || itemToRedeem.remainingQuantity < redemption.quantityRedeemed) throw new Error(`Insufficient quantity in package for item ${itemToRedeem?.itemId}.`);
        itemToRedeem.remainingQuantity -= redemption.quantityRedeemed;
        if (customerPackage.remainingItems.every(item => item.remainingQuantity === 0)) customerPackage.status = 'completed';
        await customerPackage.save({ session: dbSession });
      }
      await CustomerPackageLog.create(packageRedemptions.map(r => ({ ...r, tenantId, customerId, invoiceId: originalInvoice._id })), { session: dbSession });
    }

    // 3. Sell new packages
    for (const item of items.filter(i => i.itemType === 'package')) {
      const template = await PackageTemplate.findById(item.itemId).session(dbSession).lean();
      if (!template || !template.isActive) throw new Error(`Package "${item.name}" is not for sale.`);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + template.validityInDays);
      const [newPkg] = await CustomerPackage.create([{
        tenantId, customerId, packageTemplateId: template._id, purchaseDate: new Date(), expiryDate, status: 'active',
        remainingItems: template.items.map(i => ({ itemType: i.itemType, itemId: i.itemId, totalQuantity: i.quantity, remainingQuantity: i.quantity })),
        packageName: template.name, purchasePrice: item.finalPrice, soldBy: item.staffId,
        purchaseInvoiceId: originalInvoice._id,
      }], { session: dbSession });
      newlySoldPackages.push(newPkg.toObject());
    }

    // 4. --- MODIFIED LOGIC --- Sell new gift cards, reusing old codes if available
    for (const item of items.filter(i => i.itemType === 'gift_card')) {
        const template = await GiftCardTemplate.findById(item.itemId).session(dbSession).lean();
        if (!template || !template.isActive) throw new Error(`Gift Card type "${item.name}" is not for sale.`);
        
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + template.validityInDays);
        
        // Check if we have a pre-existing unique code for this card template.
        const codeToUse = existingUniqueCodes.get(item.itemId.toString()) || await generateUniqueCode(tenantId, dbSession);
        
        const [newCardDoc] = await GiftCard.create([{
            tenantId,
            uniqueCode: codeToUse, // Use the determined code
            initialBalance: template.amount,
            currentBalance: template.amount,
            issueDate: new Date(),
            expiryDate,
            status: 'active',
            customerId,
            purchaseInvoiceId: originalInvoice._id,
            issuedByStaffId: item.staffId,
            giftCardTemplateId: template._id,
        }], { session: dbSession });

        const populatedNewCard = await GiftCard.findById(newCardDoc._id).populate<{ issuedByStaffId: { name: string } }>({ path: 'issuedByStaffId', select: 'name' }).session(dbSession).lean();
        const cardToReturn = { ...populatedNewCard, invoice: { invoiceNumber: originalInvoice.invoiceNumber }, };
        newlyIssuedGiftCards.push(cardToReturn);
    }
    
    // --- INVENTORY & FINALIZATION PHASE ---
    if (manualInventoryUpdates && manualInventoryUpdates.length > 0) {
        for (const update of manualInventoryUpdates) {
            await Product.updateOne({ _id: update.productId, tenantId }, { $inc: { totalQuantity: -update.quantityToDeduct } }, { session: dbSession });
        }
    }

    const lineItemsWithTenantId = items.map(item => ({ ...item, tenantId }));
    
    const invoiceUpdateData = {
      lineItems: lineItemsWithTenantId, grandTotal, membershipDiscount, paymentDetails, 
      billingStaffId, serviceTotal, productTotal, subtotal, notes, customerId,
      manualDiscount: { type: manualDiscountType, value: manualDiscountValue, appliedAmount: finalManualDiscountApplied, },
      giftCardPayment: giftCardRedemption ? { cardId: giftCardRedemption.cardId, amount: giftCardRedemption.amount } : null,
      paymentStatus: 'Paid'
    };

    const updatedInvoiceDoc = await Invoice.findOneAndUpdate({ _id: id, tenantId }, invoiceUpdateData, { new: true, session: dbSession, runValidators: true });
    
    if (!updatedInvoiceDoc) { throw new Error('Invoice not found during update.'); }
    
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

    const newServiceIds = items.filter(item => item.itemType === 'service').map(serviceItem => serviceItem.itemId);
    const appointmentUpdatePayload = {
      finalAmount: updatedInvoiceDoc.grandTotal, amount: updatedInvoiceDoc.subtotal,
      membershipDiscount: updatedInvoiceDoc.membershipDiscount, paymentDetails: updatedInvoiceDoc.paymentDetails,
      billingStaffId: updatedInvoiceDoc.billingStaffId, serviceIds: newServiceIds, status: 'Paid',
    };
    await Appointment.updateOne({ _id: appointmentId, tenantId }, appointmentUpdatePayload, { session: dbSession });
    
    const appointmentForDate = await Appointment.findById(appointmentId).session(dbSession).lean();
    if(appointmentForDate) {
      const oldStaffIds = originalInvoice.lineItems.map(item => item.staffId?.toString()).filter(Boolean) as string[];
      const newStaffIds = items.map(item => item.staffId?.toString()).filter(Boolean) as string[];
      const allStaffInvolved = [...new Set([...oldStaffIds, ...newStaffIds])];
      await recalculateAndSaveDailySale({ tenantId, staffIds: allStaffInvolved, date: appointmentForDate.appointmentDateTime, dbSession });
    }
    
    await dbSession.commitTransaction();

    const finalInvoice = await Invoice.findById(id).populate({ path: 'customerId', select: 'name' }).populate({ path: 'billingStaffId', select: 'name' }).lean();

    const responseData = {
      ...finalInvoice,
      customer: finalInvoice?.customerId,
      billingStaff: finalInvoice?.billingStaffId,
      soldPackages: newlySoldPackages,
      issuedGiftCards: newlyIssuedGiftCards,
    };
    delete (responseData as any).customerId;
    delete (responseData as any).billingStaffId;

    return NextResponse.json({
      success: true, message: 'Invoice updated successfully.', data: responseData,
    }, { status: 200 });

  } catch (error: any) {
    await dbSession.abortTransaction();
    console.error(`[API ERROR] PUT /api/billing/${id}:`, error);
    return NextResponse.json(
      { success: false, message: error.message || 'Server error while updating the bill.' },
      { status: 500 }
    );
  } finally {
    dbSession.endSession();
  }
}