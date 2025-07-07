// FILE: /app/api/billing/route.ts

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import Invoice from '@/models/invoice'; // Ensure this imports your UPDATED schema
import Stylist from '@/models/Stylist';
import Customer from '@/models/customermodel';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import Setting from '@/models/Setting';
import { InventoryManager, InventoryUpdate } from '@/lib/inventoryManager';
import { sendLowStockAlertEmail } from '@/lib/mail';
import mongoose from 'mongoose';
import { IProduct } from '@/models/Product';

// In a shared types file or here, define your special ID
const MEMBERSHIP_FEE_ITEM_ID = 'MEMBERSHIP_FEE_PRODUCT_ID';

export async function POST(req: Request) {
  try {
    await connectToDatabase();

    const body = await req.json();
    console.log("--- RECEIVED BILLING BODY ---", JSON.stringify(body, null, 2)); 

    // --- MODIFIED: Destructure the new discount fields ---
    const {
      appointmentId,
      customerId,
      stylistId,
      billingStaffId,
      items,
      serviceTotal,
      productTotal,
      subtotal,
      membershipDiscount,
      grandTotal,
      paymentDetails,
      notes,
      customerWasMember,
      membershipGrantedDuringBilling,
      // --- ADDED: New fields from the payload ---
      manualDiscountType,
      manualDiscountValue,
      finalManualDiscountApplied,
    } = body;

    // --- VALIDATION (no changes needed here) ---
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
        return NextResponse.json({ success: false, message: 'Invalid or missing Appointment ID.' }, { status: 400 });
    }
    if (!paymentDetails || typeof paymentDetails !== 'object' || Object.keys(paymentDetails).length === 0) {
      return NextResponse.json({ success: false, message: 'Invalid or missing payment details' }, { status: 400 });
    }
    const totalPaid = Object.values(paymentDetails).reduce((sum: number, amount: unknown) => sum + (Number(amount) || 0), 0);
    if (Math.abs(totalPaid - grandTotal) > 0.01) {
      return NextResponse.json({ success: false, message: `Payment amount mismatch. Total: ₹${grandTotal}, Paid: ₹${totalPaid}` }, { status: 400 });
    }

    // --- DATA FETCHING (no changes needed here) ---
    const appointment = await Appointment.findById(appointmentId).populate('serviceIds customerId');
    if (!appointment) {
      return NextResponse.json({ success: false, message: 'Appointment not found' }, { status: 404 });
    }
    const customer = await Customer.findById(customerId);
    const customerGender = customer?.gender || 'other';
    
    let lowStockProducts: IProduct[] = [];

    // --- INVENTORY LOGIC ---
    try {
      let allInventoryUpdates: InventoryUpdate[] =[];
      const serviceIds = appointment.serviceIds.map((s: any) => s._id.toString());
      if (serviceIds.length > 0) {
        const { totalUpdates: serviceProductUpdates } = await InventoryManager.calculateMultipleServicesInventoryImpact(
          serviceIds,
          customerGender
        );
          allInventoryUpdates.push(...serviceProductUpdates);
      }
      
      // --- MODIFIED: Filter out the membership fee before processing inventory ---
      const retailProductUpdates: InventoryUpdate[] = items
          .filter((item: any) => 
              item.itemType === 'product' && 
              item.quantity > 0 &&
              item.itemId !== MEMBERSHIP_FEE_ITEM_ID // Crucial filter
          )
          .map((item: any) => ({
            productId: item.itemId,
            productName: item.name,
            quantityToDeduct: item.quantity,
            unit:'piece',
          }));
      // --- END MODIFICATION ---

      allInventoryUpdates.push(...retailProductUpdates);

      if (allInventoryUpdates.length > 0) {
        console.log('Applying inventory updates for:', allInventoryUpdates);
        const inventoryUpdateResult = await InventoryManager.applyInventoryUpdates(allInventoryUpdates);

        if (inventoryUpdateResult.success) {
          lowStockProducts = inventoryUpdateResult.lowStockProducts;
        } else {
          console.error('One or more inventory updates failed:', inventoryUpdateResult.errors);
        }
      }
    } catch (inventoryError) {
      console.error('Inventory update failed, but billing will continue:', inventoryError);
    }

    // --- MODIFIED: INVOICE CREATION with Manual Discount ---
    const invoice = await Invoice.create({
      appointmentId, 
      customerId, 
      stylistId, 
      billingStaffId, 
      lineItems: items,
      serviceTotal: serviceTotal || 0, 
      productTotal: productTotal || 0,
      subtotal: subtotal || grandTotal, 
      membershipDiscount: membershipDiscount || 0,
      grandTotal, 
      paymentDetails, 
      notes, 
      customerWasMember: customerWasMember || false,
      membershipGrantedDuringBilling: membershipGrantedDuringBilling || false,
      paymentStatus: 'Paid',
      // --- ADDED: Map payload to the nested manualDiscount object in your schema ---
      manualDiscount: {
        type: manualDiscountType || null,
        value: manualDiscountValue || 0,
        appliedAmount: finalManualDiscountApplied || 0,
      }
    });
    console.log('Created invoice:', invoice.invoiceNumber);
    // --- END MODIFICATION ---

    // The rest of your code remains the same
    await Appointment.findByIdAndUpdate(appointmentId, {
      amount: subtotal || grandTotal,
      membershipDiscount: membershipDiscount || 0,
      finalAmount: grandTotal,
      paymentDetails,
      billingStaffId,
      invoiceId: invoice._id,
      status: 'Paid',
    }, { new: true });
    console.log('Updated appointment to Paid status');

    // --- LOYALTY POINTS LOGIC (no changes) ---
    const loyaltySettingDoc = await Setting.findOne({ key: 'loyalty' });
    if (loyaltySettingDoc && loyaltySettingDoc.value && grandTotal > 0) {
      const { rupeesForPoints, pointsAwarded } = loyaltySettingDoc.value;
      if (typeof rupeesForPoints === 'number' && rupeesForPoints > 0 && typeof pointsAwarded === 'number' && pointsAwarded > 0) {
        const timesThresholdMet = Math.floor(grandTotal / rupeesForPoints);
        if (timesThresholdMet > 0) {
          const totalPointsEarned = timesThresholdMet * pointsAwarded;
          if (totalPointsEarned > 0) {
            const reasonAndDescription = `Earned from Invoice #${invoice.invoiceNumber}`;
            await LoyaltyTransaction.create({
              customerId: customerId, points: totalPointsEarned, type: 'Credit',
              description: reasonAndDescription, reason: reasonAndDescription,
              transactionDate: new Date(),
            });
            console.log(`Successfully credited ${totalPointsEarned} loyalty points to customer ${customerId}.`);
          }
        }
      }
    }

    // --- FINAL STEPS & NOTIFICATIONS (no changes) ---
    await Stylist.findByIdAndUpdate(stylistId, {
      isAvailable: true,
      currentAppointmentId: null,
      lastAvailabilityChange: new Date(),
    });
    console.log('Unlocked stylist');

    console.log(`Checking if low stock alert is needed for ${lowStockProducts.length} product(s).`);
    if (lowStockProducts.length > 0) {
      try {
        const thresholdSetting = await Setting.findOne({ key: 'globalLowStockThreshold' }).lean();
        const globalThreshold = thresholdSetting ? parseInt(thresholdSetting.value, 10) : 10;
        console.log(`Low stock detected. Triggering email with threshold: ${globalThreshold}`);
        sendLowStockAlertEmail(lowStockProducts, globalThreshold);
      } catch (emailError) {
          console.error("Failed to fetch settings for or send low stock email:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment processed successfully!',
      invoice,
    });
  } catch (error: any) {
    console.error('Billing API Error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to process payment' }, { status: 500 });
  }
}