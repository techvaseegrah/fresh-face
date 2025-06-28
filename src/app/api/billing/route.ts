// /app/api/billing/route.ts - FINAL CORRECTED VERSION

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import Invoice from '@/models/invoice';
import Stylist from '@/models/Stylist';
import Customer from '@/models/customermodel';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import Setting from '@/models/Setting'; // Import your existing Setting model
import { InventoryManager } from '@/lib/inventoryManager';
import mongoose from 'mongoose';

export async function POST(req: Request) {
  try {
    await connectToDatabase();

    const body = await req.json();
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

    // --- VALIDATION ---
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

    // --- DATA FETCHING ---
    const appointment = await Appointment.findById(appointmentId).populate('serviceIds customerId');
    if (!appointment) {
      return NextResponse.json({ success: false, message: 'Appointment not found' }, { status: 404 });
    }
    const customer = await Customer.findById(customerId);
    const customerGender = customer?.gender || 'other';

    // --- INVENTORY LOGIC ---
    try {
      const serviceIds = appointment.serviceIds.map((s: any) => s._id.toString());
      if (serviceIds.length > 0) {
        const allInventoryUpdates: any[] = [];
        for (const serviceId of serviceIds) {
          const serviceUpdates = await InventoryManager.calculateServiceInventoryUsage(serviceId, customerGender);
          allInventoryUpdates.push(...serviceUpdates);
        }
        if (allInventoryUpdates.length > 0) {
          await InventoryManager.applyInventoryUpdates(allInventoryUpdates);
        }
      }
    } catch (inventoryError) {
      console.error('Inventory update failed, but billing will continue:', inventoryError);
    }

    // --- INVOICE & APPOINTMENT UPDATE ---
    const invoice = await Invoice.create({
      appointmentId, customerId, stylistId, billingStaffId, lineItems: items,
      serviceTotal: serviceTotal || 0, productTotal: productTotal || 0,
      subtotal: subtotal || grandTotal, membershipDiscount: membershipDiscount || 0,
      grandTotal, paymentDetails, notes, customerWasMember: customerWasMember || false,
      membershipGrantedDuringBilling: membershipGrantedDuringBilling || false,
      paymentStatus: 'Paid',
    });
    console.log('Created invoice:', invoice.invoiceNumber);

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

    // --- THIS IS THE CORRECTED LOYALTY POINTS LOGIC ---
    
    // 1. Fetch the loyalty setting document.
    const loyaltySettingDoc = await Setting.findOne({ key: 'loyalty' });

    // 2. Safely check if the setting and its nested 'value' object exist.
    if (loyaltySettingDoc && loyaltySettingDoc.value && grandTotal > 0) {
      
      // 3. Destructure the rules from the nested 'value' object.
      const { rupeesForPoints, pointsAwarded } = loyaltySettingDoc.value;

      // 4. Validate that the rules are valid numbers.
      if (typeof rupeesForPoints === 'number' && rupeesForPoints > 0 && typeof pointsAwarded === 'number' && pointsAwarded > 0) {
        
        const timesThresholdMet = Math.floor(grandTotal / rupeesForPoints);

        if (timesThresholdMet > 0) {
          const totalPointsEarned = timesThresholdMet * pointsAwarded;

          if (totalPointsEarned > 0) {
            const reasonAndDescription = `Earned from Invoice #${invoice.invoiceNumber}`;
            await LoyaltyTransaction.create({
              customerId: customerId,
              points: totalPointsEarned,
              type: 'Credit',
              description: reasonAndDescription,
              reason: reasonAndDescription, // Fulfills the required 'reason' path
              transactionDate: new Date(),
            });
            console.log(`Successfully credited ${totalPointsEarned} loyalty points to customer ${customerId}.`);
          }
        }
      }
    }
    // --- END OF LOYALTY POINTS LOGIC ---

    // --- FINAL STEPS ---
    await Stylist.findByIdAndUpdate(stylistId, {
      isAvailable: true,
      currentAppointmentId: null,
      lastAvailabilityChange: new Date(),
    });
    console.log('Unlocked stylist');

    return NextResponse.json({
      success: true,
      message: 'Payment processed successfully!',
      invoice,
      appointment,
    });
  } catch (error: any) {
    console.error('Billing API Error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to process payment' }, { status: 500 });
  }
}