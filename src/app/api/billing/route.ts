import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { InventoryManager } from '@/lib/inventoryManager';

// Import all required Mongoose Models
import Appointment from '@/models/Appointment';
import Invoice from '@/models/invoice';
import Stylist from '@/models/Stylist';
import Customer from '@/models/customermodel';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import Setting, { ILoyaltySettings } from '@/models/Setting';

/**
 * Fetches the current loyalty program rules from the 'settings' collection.
 * Provides a safe, non-awarding default if settings are not found or an error occurs.
 * @returns {Promise<ILoyaltySettings>} The current loyalty rules.
 */
async function getLoyaltySettings(): Promise<ILoyaltySettings> {
  // Default: Award 0 points if no setting is found. This is a safe fallback.
  const defaultSettings: ILoyaltySettings = { rupeesForPoints: 100, pointsAwarded: 0 }; 
  try {
    const settingDoc = await Setting.findOne({ key: 'loyalty' }).lean();
    // If a setting document is found, return its value, otherwise return the safe default.
    return settingDoc ? (settingDoc.value as ILoyaltySettings) : defaultSettings;
  } catch (error) {
    console.error("Critical: Could not fetch loyalty settings from database. Using safe default (0 points).", error);
    return defaultSettings;
  }
}

// POST handler for processing a new billing transaction
export async function POST(req: Request) {
  try {
    await connectToDatabase();

    const body = await req.json();
    console.log("RECEIVED BILLING REQUEST BODY:", body);

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
    } = body;

    // --- 1. Crucial Validation --- (No changes here)
    if (!appointmentId) {
      return NextResponse.json(
          { success: false, message: 'CRITICAL: appointmentId was not provided in the request body from the frontend.' },
          { status: 400 }
      );
    }
    if (!paymentDetails || typeof paymentDetails !== 'object' || Object.keys(paymentDetails).length === 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid or missing payment details' },
        { status: 400 }
      );
    }
    const totalPaid = Object.values(paymentDetails).reduce((sum: number, amount: any) => sum + (Number(amount) || 0), 0);
    if (Math.abs(totalPaid - grandTotal) > 0.01) {
      return NextResponse.json(
        { success: false, message: `Payment amount mismatch. Total: ₹${grandTotal}, Paid: ₹${totalPaid}` },
        { status: 400 }
      );
    }

    // --- 2. Inventory Management --- (No changes here)
    try {
      const appointmentForInventory = await Appointment.findById(appointmentId).populate('serviceIds');
      if (appointmentForInventory) {
        const customer = await Customer.findById(customerId);
        const customerGender = customer?.gender || 'other';
        const serviceIds = appointmentForInventory.serviceIds.map((s: any) => s._id.toString());
        
        const allInventoryUpdates = [];
        for (const serviceId of serviceIds) {
          const serviceUpdates = await InventoryManager.calculateServiceInventoryUsage(serviceId, customerGender);
          allInventoryUpdates.push(...serviceUpdates);
        }

        if (allInventoryUpdates.length > 0) {
          const inventoryResult = await InventoryManager.applyInventoryUpdates(allInventoryUpdates);
          if (!inventoryResult.success) {
             console.warn('Inventory update had non-critical errors:', inventoryResult.errors);
          }
          console.log('Inventory for consumables successfully updated.');
        }
      }
    } catch (inventoryError) {
      console.error('Critical: Inventory update failed, but billing will proceed.', inventoryError);
    }

    // --- 3. Create the Invoice --- (No changes here)
    const invoice = await Invoice.create({
      appointmentId,
      customerId,
      stylistId,
      billingStaffId,
      lineItems: items,
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
    });
    console.log(`Created Invoice #${invoice.invoiceNumber}`);

    // --- 4. Update Related Documents --- (No changes here)
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      {
        amount: subtotal,
        finalAmount: grandTotal,
        paymentDetails,
        billingStaffId,
        invoiceId: invoice._id,
        status: 'Paid',
      },
      { new: true }
    );
    console.log(`Updated Appointment ${appointmentId} to 'Paid'`);

    await Stylist.findByIdAndUpdate(stylistId, {
      isAvailable: true,
      currentAppointmentId: null,
      lastAvailabilityChange: new Date(),
    });
    console.log(`Unlocked Stylist ${stylistId}`);

    // --- 5. Dynamic Loyalty Point Awarding --- (THIS SECTION IS UPDATED) ---
    const loyaltyRules = await getLoyaltySettings();
    let pointsToAward = 0;
    
    if (loyaltyRules.rupeesForPoints > 0) {
      const calculationBasis = grandTotal;
      pointsToAward = Math.floor(calculationBasis / loyaltyRules.rupeesForPoints) * loyaltyRules.pointsAwarded;
    }

    if (pointsToAward > 0) {
      // Step 5a: Create the transaction record for the audit log
      await LoyaltyTransaction.create({
        customerId,
        appointmentId,
        points: pointsToAward,
        type: 'Credit',
        reason: `Points earned from Invoice #${invoice.invoiceNumber}`, 
      });
      console.log(`Created loyalty transaction for ${pointsToAward} points.`);

      // Step 5b: Atomically update the customer's total point balance
      await Customer.findByIdAndUpdate(customerId, {
        $inc: { loyaltyPoints: pointsToAward }
      });
      console.log(`Updated customer ${customerId}'s total loyalty points.`);
    }

    // --- 6. Final Success Response --- (No changes here)
    return NextResponse.json({
      success: true,
      message: 'Payment processed successfully! Inventory and loyalty points updated.',
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        grandTotal: invoice.grandTotal,
      },
      appointment: updatedAppointment,
    });

  } catch (error: any) {
    console.error('Billing API Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'An unexpected error occurred during billing.' },
      { status: 500 }
    );
  }
}