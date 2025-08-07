// FILE: /app/api/billing/route.ts - MULTI-TENANT REFACTORED VERSION

import { NextRequest, NextResponse } from 'next/server';
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
import { getTenantIdOrBail } from '@/lib/tenant';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

const MEMBERSHIP_FEE_ITEM_ID = 'MEMBERSHIP_FEE_PRODUCT_ID';

export async function POST(req: NextRequest) {
  // --- MT: Get tenantId and check permissions first ---
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;

  // const authSession = await getServerSession(authOptions);
  // if (!authSession || !hasPermission(authSession.user.role.permissions, PERMISSIONS.BILLING_CREATE)) { // Assuming a permission exists
  //     return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  // }

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    await connectToDatabase();
    const body = await req.json();
    
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
      // --- MT: Scope product lookup by tenantId ---
      const productsInDb = await Product.find({ _id: { $in: productIds }, tenantId }).session(dbSession);

      if (productsInDb.length !== productIds.length) {
          throw new Error('One or more products being billed are invalid for this salon.');
      }
      
      const productMap = new Map(productsInDb.map(p => [p._id.toString(), p]));
      for (const item of productItemsToBill) {
        const dbProduct = productMap.get(item.itemId);
        if (dbProduct!.numberOfItems < item.quantity) {
          throw new Error(`Insufficient stock for "${dbProduct!.name}". Requested: ${item.quantity}, Available: ${dbProduct!.numberOfItems}.`);
        }
      }
    }

    // --- 3. DATA FETCHING ---
    // --- MT: Scope all data fetches by tenantId ---
    const appointment = await Appointment.findOne({ _id: appointmentId, tenantId }).populate('serviceIds').session(dbSession);
    if (!appointment) throw new Error('Appointment not found');
    if (appointment.status === 'Paid') {
      throw new Error('This appointment has already been paid for.');
    }

    const customer = await Customer.findOne({ _id: customerId, tenantId }).session(dbSession);
    if (!customer) throw new Error('Customer not found');
    const customerGender = customer.gender || 'other';

    // --- 4. INVENTORY LOGIC ---
    let allInventoryUpdates: InventoryUpdate[] = [];
    let lowStockProducts: IProduct[] = [];

    const serviceIds = appointment.serviceIds.map((s: any) => s._id.toString());
    if (serviceIds.length > 0) {
      // --- MT: Pass tenantId to inventory manager ---
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
      // --- MT: Pass tenantId to inventory manager ---
      const inventoryUpdateResult = await InventoryManager.applyInventoryUpdates(allInventoryUpdates, dbSession, tenantId);
      if (inventoryUpdateResult.success) {
        lowStockProducts = inventoryUpdateResult.lowStockProducts;
      } else {
        throw new Error('One or more inventory updates failed: ' + JSON.stringify(inventoryUpdateResult.errors));
      }
    }

    // --- 5. CREATE INVOICE ---
    // --- MT: Add tenantId to the new invoice document ---
    const invoice = new Invoice({
      tenantId, // Add the tenantId
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
    await invoice.save({ session: dbSession });
    
    // --- 6. UPDATE APPOINTMENT ---
    // --- MT: Scope update by tenantId ---
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
    // --- MT: Scope settings lookup by tenantId ---
    const loyaltySettingDoc = await Setting.findOne({ key: 'loyalty', tenantId }).session(dbSession);
    if (loyaltySettingDoc?.value && grandTotal > 0) {
        const { rupeesForPoints, pointsAwarded } = loyaltySettingDoc.value;
        if (rupeesForPoints > 0 && pointsAwarded > 0) {
            const pointsEarned = Math.floor(grandTotal / rupeesForPoints) * pointsAwarded;
            if (pointsEarned > 0) {
                // --- MT: Add tenantId to the new loyalty transaction ---
                await LoyaltyTransaction.create([{
                    tenantId, // Add the tenantId
                    customerId, points: pointsEarned, type: 'Credit',
                    description: `Earned from an invoice`,
                    reason: `Invoice`,
                    transactionDate: new Date(),
                }], { session: dbSession });
            }
        }
    }

    // --- 8. UPDATE STYLIST ---
    // --- MT: Scope stylist update by tenantId ---
    if (stylistId) {
        await Stylist.updateOne({ _id: stylistId, tenantId }, {
          isAvailable: true, // This field name is from your original code
          currentAppointmentId: null,
          lastAvailabilityChange: new Date(),
        }, { session: dbSession });
    }

    // --- 9. COMMIT TRANSACTION ---
    await dbSession.commitTransaction();

    // --- 10. POST-TRANSACTION ACTIONS (kept simple as requested) ---
    // (Your original code had this commented out, so it remains that way)
    // if (lowStockProducts.length > 0) {
    //   ... your email logic ...
    // }

    return NextResponse.json({
      success: true,
      message: 'Payment processed successfully!',
      invoiceId: invoice._id,
    });

  } catch (error: any) {
    await dbSession.abortTransaction();
    return NextResponse.json({ success: false, message: error.message || 'Failed to process payment' }, { status: 400 });
  
  } finally {
    dbSession.endSession();
  }
}