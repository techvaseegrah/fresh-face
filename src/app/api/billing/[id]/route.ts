import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import mongoose, { ClientSession, Types } from 'mongoose';
import Invoice, { IInvoice } from '@/models/invoice';
import Appointment, { IAppointment } from '@/models/Appointment';
import Customer from '@/models/customermodel';
import Setting from '@/models/Setting';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import Product, { IProduct } from '@/models/Product';
import { getTenantIdOrBail } from '@/lib/tenant';
// FIX 1: Corrected the import for a likely default export.
import {FinalizeBillingPayload} from '@/app/(main)/appointment/billingmodal';
import { recalculateAndSaveDailySale } from '../route';
import { GiftCard } from '@/models/GiftCard';
import { GiftCardLog } from '@/models/GiftCardLog';
import CustomerPackage from '@/models/CustomerPackage';
import CustomerPackageLog from '@/models/CustomerPackageLog';
import PackageTemplate from '@/models/PackageTemplate';
import { GiftCardTemplate } from '@/models/GiftCardTemplate';
import Staff from '@/models/staff';
import { decrypt } from '@/lib/crypto';

// --- TYPE DEFINITIONS for better type safety ---

// Represents a single item in the billing payload
interface BillingLineItem {
  itemType: 'service' | 'product' | 'package' | 'gift_card';
  itemId: string;
  name: string;
  quantity: number;
  staffId?: string | Types.ObjectId;
  finalPrice: number;
}

// Represents the shape of the invoice after populating related documents
interface PopulatedInvoice extends Omit<IInvoice, 'customerId' | 'billingStaffId'> {
  customerId: { name: string; phoneNumber: string; isMembership: boolean };
  billingStaffId: { name: string; email: string };
}

// --- HELPER FUNCTIONS (UNCHANGED) ---

const safeDecrypt = (data: string, fieldName: string): string => {
  if (!data) return '';
  if (!/^[0-9a-fA-F]{32,}/.test(data)) { return data; }
  try { return decrypt(data); } catch (e: any) { console.warn(`Decryption failed for ${fieldName} in Correct Bill: ${e.message}. Using as plain text.`); return data; }
};

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


// --- API ROUTE HANDLERS ---

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
    // FIX 2: Cast the result to the PopulatedInvoice interface to inform TypeScript of the populated fields.
    const invoice = await Invoice.findOne({ _id: id, tenantId })
      .populate({ path: 'customerId', select: 'name phoneNumber isMembership' })
      .populate({ path: 'billingStaffId', select: 'name email' })
      
      .lean() as PopulatedInvoice | null;

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found.' }, { status: 404 });
    }
    const decryptedCustomerName = invoice.customerId 
      ? safeDecrypt(invoice.customerId.name, 'customerName') 
      : 'N/A';

   const responseData = {
      ...invoice,
      customer: { 
        ...invoice.customerId, 
        name: decryptedCustomerName // Use the decrypted name here
      },
      billingStaff: invoice.billingStaffId
    };
    delete (responseData as any).customerId;
    delete (responseData as any).billingStaffId;
    return NextResponse.json({ success: true, invoice: responseData }, { status: 200 });
  } catch (error: any) {
    console.error(`[API ERROR] GET /api/billing/${id}:`, error);
    return NextResponse.json({ success: false, message: 'Server error fetching invoice.', error: error.message }, { status: 500 });
  }
}

type CorrectBillPayload = FinalizeBillingPayload & { originalManualInventoryUpdates?: { productId: string; quantityToDeduct: number }[] };

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } } 
) {
  const tenantId = getTenantIdOrBail(request);
  if (tenantId instanceof NextResponse) return tenantId;
  
  const { id: invoiceId } = params;
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    await dbConnect();
    
    const body: CorrectBillPayload = await request.json(); 
    const { items, customerId, grandTotal } = body;
    
    const originalInvoice = await Invoice.findOne({ _id: invoiceId, tenantId }).session(dbSession);
    if (!originalInvoice) {
        throw new Error("Original invoice not found for correction.");
    }
    
    const { newlyIssuedGiftCards } = await handleGiftCardCorrection(originalInvoice, body, tenantId, dbSession);
    const { newlySoldPackages } = await handlePackageCorrection(originalInvoice, body, tenantId, dbSession);
    await handleInventoryCorrection(originalInvoice, body, tenantId, dbSession);
    const updatedInvoiceDoc = await updateInvoiceDocument(originalInvoice, body, invoiceId, tenantId, dbSession);
    await handleLoyaltyPointsAdjustment(originalInvoice, grandTotal, customerId, updatedInvoiceDoc.invoiceNumber, dbSession);
    await updateRelatedDocuments(updatedInvoiceDoc, originalInvoice, items, tenantId, dbSession);
    
    await dbSession.commitTransaction();

    const populatedInvoice = await updatedInvoiceDoc.populate([
        { path: 'customerId', select: 'name' },
        { path: 'billingStaffId', select: 'name' }
    ]);

    const customerObj = populatedInvoice.customerId as any;
    const decryptedCustomerName = customerObj ? safeDecrypt(customerObj.name, 'customerName') : 'N/A';

    const responseData = {
      ...populatedInvoice.toObject(),
      customer: { name: decryptedCustomerName },
      billingStaff: populatedInvoice.billingStaffId,
      soldPackages: newlySoldPackages,
      issuedGiftCards: newlyIssuedGiftCards,
    };
    delete (responseData as any).customerId;
    delete (responseData as any).billingStaffId;

    return NextResponse.json({
      success: true, 
      message: 'Invoice updated successfully.', 
      data: responseData,
    }, { status: 200 });

  } catch (error: any) {
    await dbSession.abortTransaction();
    console.error(`[API ERROR] PUT /api/billing/${invoiceId}:`, error);
    const isValidationError = error.name === 'ValidationError';
    return NextResponse.json(
      { success: false, message: error.message || 'Server error while updating the bill.' },
      { status: isValidationError ? 400 : 500 }
    );
  } finally {
    dbSession.endSession();
  }
}

// --- REFACTORED HELPER FUNCTIONS WITH EXPLICIT TYPES ---

async function handleGiftCardCorrection(originalInvoice: IInvoice, body: CorrectBillPayload, tenantId: string, session: ClientSession) {
    if (originalInvoice.giftCardPayment?.cardId) {
        await GiftCard.updateOne(
            { _id: originalInvoice.giftCardPayment.cardId },
            { $inc: { currentBalance: originalInvoice.giftCardPayment.amount }, $set: { status: 'active' } },
            { session }
        );
    }

    const oldSoldCards = await GiftCard.find({ purchaseInvoiceId: originalInvoice._id, tenantId }).session(session);
    const existingUniqueCodes = new Map<string, string>();
    for (const card of oldSoldCards) {
        if (card.currentBalance < card.initialBalance) {
            throw new Error(`Cannot correct invoice. Gift Card #${card.uniqueCode} sold in this bill has already been used.`);
        }
        existingUniqueCodes.set(card.giftCardTemplateId.toString(), card.uniqueCode);
        await GiftCard.deleteOne({ _id: card._id }).session(session);
    }

    const { giftCardRedemption, items, customerId } = body;
    if (giftCardRedemption?.cardId && giftCardRedemption.amount > 0) {
        const giftCard = await GiftCard.findById(giftCardRedemption.cardId).session(session);
        if (!giftCard) throw new Error("Applied gift card not found.");
        if (giftCard.currentBalance < giftCardRedemption.amount) throw new Error(`Insufficient gift card balance.`);
        
        giftCard.currentBalance -= giftCardRedemption.amount;
        if (giftCard.currentBalance < 0.01) giftCard.status = 'redeemed';
        await giftCard.save({ session });
    }

    const newlyIssuedGiftCards: any[] = [];
    // FIX 3: Added explicit type for 'item' parameter.
    for (const item of items.filter((i: BillingLineItem) => i.itemType === 'gift_card')) {
        const template = await GiftCardTemplate.findById(item.itemId).session(session).lean();
        if (!template || !template.isActive) throw new Error(`Gift Card type "${item.name}" is not for sale.`);

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + template.validityInDays);
        const codeToUse = existingUniqueCodes.get(item.itemId.toString()) || await generateUniqueCode(tenantId, session);

        const [newCardDoc] = await GiftCard.create([{
            tenantId, uniqueCode: codeToUse, initialBalance: template.amount, currentBalance: template.amount,
            issueDate: new Date(), expiryDate, status: 'active', customerId,
            purchaseInvoiceId: originalInvoice._id, issuedByStaffId: item.staffId,
            giftCardTemplateId: template._id,
        }], { session });

        const populatedNewCard = await GiftCard.findById(newCardDoc._id)
            .populate<{ issuedByStaffId: { name: string } }>({ path: 'issuedByStaffId', select: 'name' })
            .session(session)
            .lean();
            
        newlyIssuedGiftCards.push({ ...populatedNewCard, invoice: { invoiceNumber: originalInvoice.invoiceNumber } });
    }

    return { newlyIssuedGiftCards };
}

async function handlePackageCorrection(originalInvoice: IInvoice, body: CorrectBillPayload, tenantId: string, session: ClientSession) {
    const originalPackageLogs = await CustomerPackageLog.find({ invoiceId: originalInvoice._id, tenantId }).session(session);
    for (const log of originalPackageLogs) {
        await CustomerPackage.updateOne(
            { _id: log.customerPackageId, 'remainingItems.itemId': log.redeemedItemId },
            { $inc: { 'remainingItems.$.remainingQuantity': log.quantityRedeemed }, $set: { status: 'active' } },
            { session }
        );
    }
    await CustomerPackageLog.deleteMany({ invoiceId: originalInvoice._id, tenantId }).session(session);

    const oldSoldPackages = await CustomerPackage.find({ purchaseInvoiceId: originalInvoice._id, tenantId }).session(session);
    for (const pkg of oldSoldPackages) {
        const usageLogs = await CustomerPackageLog.countDocuments({ customerPackageId: pkg._id, invoiceId: { $ne: originalInvoice._id } }).session(session);
        if (usageLogs > 0) {
            throw new Error(`Cannot correct invoice. The package "${pkg.packageName}" sold in this bill has already been used on another bill.`);
        }
        await CustomerPackage.deleteOne({ _id: pkg._id }).session(session);
    }

    const { packageRedemptions, customerId, items } = body;
    if (packageRedemptions && packageRedemptions.length > 0) {
        for (const redemption of packageRedemptions) {
            const customerPackage = await CustomerPackage.findById(redemption.customerPackageId).session(session);
            if (!customerPackage) throw new Error(`Package for redemption not found.`);
            
            const itemToRedeem = customerPackage.remainingItems.find(item => item.itemId.toString() === redemption.redeemedItemId);
            if (!itemToRedeem || itemToRedeem.remainingQuantity < redemption.quantityRedeemed) {
                throw new Error(`Insufficient quantity in package for item ${itemToRedeem?.itemId}.`);
            }
            
            itemToRedeem.remainingQuantity -= redemption.quantityRedeemed;
            if (customerPackage.remainingItems.every(item => item.remainingQuantity === 0)) {
                customerPackage.status = 'completed';
            }
            await customerPackage.save({ session });
        }
        // FIX 4: Added explicit type for 'r' parameter. Assuming 'packageRedemptions' is an array of objects.
        await CustomerPackageLog.create(
            packageRedemptions.map((r: any) => ({ ...r, tenantId, customerId, invoiceId: originalInvoice._id })),
            { session }
        );
    }
    
    const newlySoldPackages: any[] = [];
    // FIX 5: Added explicit type for 'item' parameter.
    for (const item of items.filter((i: BillingLineItem) => i.itemType === 'package')) {
        const template = await PackageTemplate.findById(item.itemId).session(session).lean();
        if (!template || !template.isActive) throw new Error(`Package "${item.name}" is not for sale.`);

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + template.validityInDays);

        const [newPkg] = await CustomerPackage.create([{
            tenantId, customerId, packageTemplateId: template._id, purchaseDate: new Date(),
            expiryDate, status: 'active',
            remainingItems: template.items.map((i: any) => ({ itemType: i.itemType, itemId: i.itemId, totalQuantity: i.quantity, remainingQuantity: i.quantity })),
            packageName: template.name, purchasePrice: item.finalPrice, soldBy: item.staffId,
            purchaseInvoiceId: originalInvoice._id,
        }], { session });
        newlySoldPackages.push(newPkg.toObject());
    }

    return { newlySoldPackages };
}

async function handleInventoryCorrection(originalInvoice: IInvoice, body: CorrectBillPayload, tenantId: string, session: ClientSession) {
    const { items, manualInventoryUpdates, originalManualInventoryUpdates } = body;
    const inventoryChangeMap = new Map<string, { numberOfItemsChange: number, totalQuantityChange: number, name: string }>();

    const updateChangeMap = (productId: string, name: string, numChange: number, quantChange: number) => {
        if (!inventoryChangeMap.has(productId)) {
            inventoryChangeMap.set(productId, { numberOfItemsChange: 0, totalQuantityChange: 0, name });
        }
        const entry = inventoryChangeMap.get(productId)!;
        entry.numberOfItemsChange += numChange;
        entry.totalQuantityChange += quantChange;
        if (name) entry.name = name;
    };

    for (const item of originalInvoice.lineItems.filter((i: any) => i.itemType === 'product')) {
        if (item.itemId) updateChangeMap(item.itemId.toString(), item.name, item.quantity, 0);
    }
    if (originalManualInventoryUpdates) {
        for (const item of originalManualInventoryUpdates) {
            updateChangeMap(item.productId, "Manual Update", 0, item.quantityToDeduct);
        }
    }

    for (const item of items.filter((i: BillingLineItem) => i.itemType === 'product')) {
        updateChangeMap(item.itemId.toString(), item.name, -item.quantity, 0);
    }
    if (manualInventoryUpdates) {
        for (const item of manualInventoryUpdates) {
            updateChangeMap(item.productId, "Manual Update", 0, -item.quantityToDeduct);
        }
    }

    if (inventoryChangeMap.size === 0) return;

    const productIds = Array.from(inventoryChangeMap.keys());
    const productsInDb = await Product.find({ _id: { $in: productIds }, tenantId }).session(session);
    const productMap = new Map(productsInDb.map(p => [p._id.toString(), p]));

    for (const [productId, change] of inventoryChangeMap.entries()) {
        const dbProduct = productMap.get(productId);
        if (!dbProduct) throw new Error(`Product "${change.name}" not found in inventory.`);
        
        const newNumberOfItems = dbProduct.numberOfItems + change.numberOfItemsChange;
        const newTotalQuantity = dbProduct.totalQuantity + change.totalQuantityChange;

        if (change.numberOfItemsChange !== 0 && newNumberOfItems < 0) {
            throw new Error(`Insufficient stock for "${change.name}". Current: ${dbProduct.numberOfItems}, Required Change: ${change.numberOfItemsChange}`);
        }
        if (change.totalQuantityChange !== 0 && newTotalQuantity < 0) {
            throw new Error(`Insufficient stock for "${change.name}". Current: ${dbProduct.totalQuantity}, Required Change: ${change.totalQuantityChange}`);
        }
        
        if (change.numberOfItemsChange !== 0 || change.totalQuantityChange !== 0) {
            await Product.updateOne(
                { _id: productId, tenantId },
                { $inc: { numberOfItems: change.numberOfItemsChange, totalQuantity: change.totalQuantityChange } },
                { session }
            );
        }
    }
}

async function updateInvoiceDocument(originalInvoice: IInvoice, body: CorrectBillPayload, invoiceId: string, tenantId: string, session: ClientSession) {
    const {
      items, grandTotal, membershipDiscount, paymentDetails, billingStaffId, serviceTotal, 
      productTotal, subtotal, notes, customerId, manualDiscountType, manualDiscountValue, 
      finalManualDiscountApplied, giftCardRedemption
    } = body;
    
    // FIX 6: Added explicit type for 'item' parameter.
    originalInvoice.lineItems = items.map((item: BillingLineItem) => ({ ...item, tenantId }));
    originalInvoice.grandTotal = grandTotal;
    originalInvoice.membershipDiscount = membershipDiscount;
    originalInvoice.paymentDetails = paymentDetails;
    originalInvoice.billingStaffId = billingStaffId;
    originalInvoice.serviceTotal = serviceTotal;
    originalInvoice.productTotal = productTotal;
    originalInvoice.subtotal = subtotal;
    originalInvoice.notes = notes;
    originalInvoice.customerId = customerId;
    originalInvoice.manualDiscount = {
        type: manualDiscountType, value: manualDiscountValue, appliedAmount: finalManualDiscountApplied,
    };
    originalInvoice.giftCardPayment = giftCardRedemption
        ? { cardId: giftCardRedemption.cardId, amount: giftCardRedemption.amount }
        : undefined;
    originalInvoice.paymentStatus = 'Paid';

    return await originalInvoice.save({ session });
}

async function handleLoyaltyPointsAdjustment(originalInvoice: IInvoice, newGrandTotal: number, customerId: string, invoiceNumber: string, session: ClientSession) {
    const loyaltySettingDoc = await Setting.findOne({ key: 'loyalty', tenantId: originalInvoice.tenantId }).session(session).lean();
    if (!loyaltySettingDoc?.value) return;

    const { rupeesForPoints, pointsAwarded } = loyaltySettingDoc.value;
    if (rupeesForPoints <= 0 || pointsAwarded <= 0) return;

    const calculatePoints = (total: number) => Math.floor(total / rupeesForPoints) * pointsAwarded;
    
    const originalPoints = calculatePoints(originalInvoice.grandTotal || 0);
    const newPoints = calculatePoints(newGrandTotal);
    const pointsDifference = newPoints - originalPoints;

    if (pointsDifference !== 0) {
        await LoyaltyTransaction.create([{
            tenantId: originalInvoice.tenantId, customerId,
            points: Math.abs(pointsDifference),
            type: pointsDifference > 0 ? 'Credit' : 'Debit',
            description: `Point adjustment for corrected invoice #${invoiceNumber || originalInvoice._id}`,
            reason: `Invoice Correction`, transactionDate: new Date(),
        }], { session });
    }
}

async function updateRelatedDocuments(updatedInvoice: IInvoice, originalInvoice: IInvoice, newItems: BillingLineItem[], tenantId: string, dbSession: ClientSession) {
    const { appointmentId } = updatedInvoice;
    if (!appointmentId) return;

    // FIX 7: Added explicit types for 'item' and 'serviceItem' parameters.
    const newServiceIds = newItems
      .filter((item: BillingLineItem) => item.itemType === 'service')
      .map((serviceItem: BillingLineItem) => serviceItem.itemId);
      
    const appointmentUpdatePayload = {
        finalAmount: updatedInvoice.grandTotal, amount: updatedInvoice.subtotal,
        membershipDiscount: updatedInvoice.membershipDiscount, paymentDetails: updatedInvoice.paymentDetails,
        billingStaffId: updatedInvoice.billingStaffId, serviceIds: newServiceIds, status: 'Paid',
    };
    await Appointment.updateOne({ _id: appointmentId, tenantId }, appointmentUpdatePayload, { session: dbSession });
    
    // FIX 8: Cast the query result to IAppointment to inform TS of its shape.
    const appointmentForDate = await Appointment.findById(appointmentId).session(dbSession).lean() as IAppointment | null;
    if(appointmentForDate) {
        const oldStaffIds = originalInvoice.lineItems.map((item: any) => item.staffId?.toString()).filter(Boolean) as string[];
        const newStaffIds = newItems.map((item: BillingLineItem) => item.staffId?.toString()).filter(Boolean) as string[];
        const allStaffInvolved = [...new Set([...oldStaffIds, ...newStaffIds])];
        
        await recalculateAndSaveDailySale({
            tenantId,
            staffIds: allStaffInvolved,
            date: appointmentForDate.appointmentDateTime,
            dbSession
        });
    }
}