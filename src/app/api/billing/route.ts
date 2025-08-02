// FILE: /app/api/billing/route.ts

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import mongoose from 'mongoose';
import Appointment from '@/models/Appointment';
import Invoice from '@/models/invoice';
import Stylist from '@/models/Stylist';
import Customer from '@/models/customermodel';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import Setting from '@/models/Setting';
import Product, { IProduct } from '@/models/Product';
import { InventoryManager, InventoryUpdate } from '@/lib/inventoryManager';
//import { sendLowStockAlertEmail } from '@/lib/mail';

const MEMBERSHIP_FEE_ITEM_ID = 'MEMBERSHIP_FEE_PRODUCT_ID';

export async function POST(req: Request) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await connectToDatabase();

    const body = await req.json();
    console.log("--- RECEIVED BILLING BODY ---");

    const {
      appointmentId, customerId, stylistId, billingStaffId, items,
      serviceTotal, productTotal, subtotal, membershipDiscount, grandTotal,
      paymentDetails, notes, customerWasMember, membershipGrantedDuringBilling,
      manualDiscountType, manualDiscountValue, finalManualDiscountApplied,
    } = body;

    // --- 1. PRE-VALIDATION ---
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
        throw new Error('Invalid or missing Appointment ID.');
    }
    const totalPaid = Object.values(paymentDetails).reduce((sum: number, amount: unknown) => sum + (Number(amount) || 0), 0);
    if (Math.abs(totalPaid - grandTotal) > 0.01) {
      throw new Error(`Payment amount mismatch. Total: ₹${grandTotal}, Paid: ₹${totalPaid}`);
    }

    // --- 2. CRITICAL STOCK VALIDATION ---
    const productItemsToBill = items.filter((item: any) => item.itemType === 'product' && item.itemId !== MEMBERSHIP_FEE_ITEM_ID);
    
    if (productItemsToBill.length > 0) {
      const productIds = productItemsToBill.map((item: any) => item.itemId);
      const productsInDb = await Product.find({ _id: { $in: productIds } }).session(session);
      const productMap = new Map(productsInDb.map(p => [p._id.toString(), p]));

      for (const item of productItemsToBill) {
        const dbProduct = productMap.get(item.itemId);
        if (!dbProduct) {
          throw new Error(`Product "${item.name}" not found in database.`);
        }
        if (dbProduct.numberOfItems < item.quantity) {
          throw new Error(`Insufficient stock for "${dbProduct.name}". Requested: ${item.quantity}, Available: ${dbProduct.numberOfItems}.`);
        }
      }
      console.log("Stock validation passed for all products.");
    }

    // --- 3. DATA FETCHING ---
    const appointment = await Appointment.findById(appointmentId).populate('serviceIds').session(session);
    if (!appointment) throw new Error('Appointment not found');
    // MODIFICATION: Added a check to prevent re-billing a paid appointment
    if (appointment.status === 'Paid') {
      throw new Error('This appointment has already been paid for.');
    }

    const customer = await Customer.findById(customerId).session(session);
    if (!customer) throw new Error('Customer not found');
    const customerGender = customer.gender || 'other';

    // --- 4. INVENTORY LOGIC (Now inside the transaction) ---
    let allInventoryUpdates: InventoryUpdate[] = [];
    let lowStockProducts: IProduct[] = [];

    const serviceIds = appointment.serviceIds.map((s: any) => s._id.toString());
    if (serviceIds.length > 0) {
      const { totalUpdates: serviceProductUpdates } = await InventoryManager.calculateMultipleServicesInventoryImpact(
        serviceIds, customerGender
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
      console.log('Applying inventory updates...');
      const inventoryUpdateResult = await InventoryManager.applyInventoryUpdates(allInventoryUpdates, session);
      if (inventoryUpdateResult.success) {
        lowStockProducts = inventoryUpdateResult.lowStockProducts;
      } else {
        throw new Error('One or more inventory updates failed: ' + JSON.stringify(inventoryUpdateResult.errors));
      }
    }

    // --- 5. CREATE INVOICE ---
    const invoice = new Invoice({
      appointmentId, customerId, stylistId, billingStaffId, lineItems: items,
      serviceTotal, productTotal, subtotal, membershipDiscount, grandTotal,
      paymentDetails, notes, customerWasMember, membershipGrantedDuringBilling,
      paymentStatus: 'Paid',
      manualDiscount: {
        type: manualDiscountType || null,
        value: manualDiscountValue || 0,
        appliedAmount: finalManualDiscountApplied || 0,
      }
    });
    await invoice.save({ session });
    // MODIFICATION: Changed log to show the ID, since invoiceNumber is not generated here
    console.log('Created invoice with ID:', invoice._id);

    // --- 6. UPDATE APPOINTMENT (This is the critical part) ---
    await Appointment.updateOne({ _id: appointmentId }, {
      amount: subtotal,
      membershipDiscount,
      finalAmount: grandTotal,
      paymentDetails,
      billingStaffId,
      invoiceId: invoice._id, // This line ensures the link is created. It was already in your code but is essential.
      status: 'Paid',
    }, { session });
    console.log('Updated appointment to Paid status');

    // --- 7. LOYALTY POINTS LOGIC ---
    const loyaltySettingDoc = await Setting.findOne({ key: 'loyalty' }).session(session);
    if (loyaltySettingDoc?.value && grandTotal > 0) {
        const { rupeesForPoints, pointsAwarded } = loyaltySettingDoc.value;
        if (rupeesForPoints > 0 && pointsAwarded > 0) {
            const pointsEarned = Math.floor(grandTotal / rupeesForPoints) * pointsAwarded;
            if (pointsEarned > 0) {
                await LoyaltyTransaction.create([{
                    customerId, points: pointsEarned, type: 'Credit',
                    description: `Earned from an invoice`, // Changed to a generic message
                    reason: `Invoice`,
                    transactionDate: new Date(),
                }], { session });
                console.log(`Credited ${pointsEarned} loyalty points.`);
            }
        }
    }

    // --- 8. UPDATE STYLIST ---
    await Stylist.updateOne({ _id: stylistId }, {
      isAvailable: true,
      currentAppointmentId: null,
      lastAvailabilityChange: new Date(),
    }, { session });
    console.log('Unlocked stylist');

    // --- 9. COMMIT TRANSACTION ---
    await session.commitTransaction();
    console.log("--- TRANSACTION COMMITTED SUCCESSFULLY ---");

    // --- 10. POST-TRANSACTION ACTIONS (like sending emails) ---
    // if (lowStockProducts.length > 0) {
    //   ... your email logic ...
    // }

    return NextResponse.json({
      success: true,
      message: 'Payment processed successfully!',
      invoiceId: invoice._id,
    });

  } catch (error: any) {
    console.error('--- BILLING TRANSACTION FAILED, ROLLING BACK ---', error);
    await session.abortTransaction();
    return NextResponse.json({ success: false, message: error.message || 'Failed to process payment' }, { status: 400 });
  
  } finally {
    session.endSession();
  }
}