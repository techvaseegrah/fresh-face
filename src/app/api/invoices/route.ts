import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect'; // Assuming you have a dbConnect file
import Invoice from '@/models/invoice';
import Appointment from '@/models/Appointment';
import ShopSetting from '@/models/ShopSetting'; // Use the correct settings model
import Customer from '@/models/customermodel';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import Stylist from '@/models/Stylist'; // Added Stylist model

export async function POST(request: Request) {
  try {
    await dbConnect();

    const body = await request.json();
    const { 
      appointmentId, 
      customerId,
      stylistId, // Make sure to send this from the frontend
      grandTotal, 
      lineItems 
    } = body;

    // Validate essential data
    if (!appointmentId || !customerId || !stylistId || grandTotal === undefined || !lineItems) {
      return NextResponse.json(
        { success: false, message: "Missing required fields (appointmentId, customerId, stylistId, grandTotal, lineItems)." },
        { status: 400 }
      );
    }
    
    // --- CORRECT LOYALTY POINTS LOGIC ---
    const settings = await ShopSetting.findOne({ key: 'defaultSettings' }).lean();
    let pointsEarned = 0;
    const grandTotalValue = Number(grandTotal);

    // Default rule as a fallback
    const loyaltyRule = settings 
      ? { price: settings.loyaltyPointPerPrice, points: settings.loyaltyPointsAwarded }
      : { price: 100, points: 1 }; // Default: 1 point per 100

    if (loyaltyRule.price > 0 && !isNaN(grandTotalValue) && grandTotalValue > 0) {
        // This is the key calculation. It correctly drops the remainder.
        // Example: Math.floor(560 / 100) = Math.floor(5.6) = 5
        const spendingBlocks = Math.floor(grandTotalValue / loyaltyRule.price);
        
        // Example: 5 * 4 points = 20 points
        pointsEarned = spendingBlocks * loyaltyRule.points;
    }

    // --- Create Invoice and Update Records ---
    const newInvoice = new Invoice({
      ...body, 
      paymentStatus: 'Paid'
    });
    
    const savedInvoice = await newInvoice.save();

    // Perform all database updates concurrently for better performance
    await Promise.all([
      // 1. Update Appointment Status
      Appointment.findByIdAndUpdate(appointmentId, {
          $set: { status: 'Paid', finalAmount: grandTotal, invoiceId: savedInvoice._id }
      }),
      // 2. Make Stylist Available Again
      Stylist.findByIdAndUpdate(stylistId, {
          isAvailable: true,
          currentAppointmentId: null
      }),
      // 3. Award Loyalty Points (if any)
      pointsEarned > 0 ? Customer.findByIdAndUpdate(customerId, { $inc: { loyaltyPoints: pointsEarned } }) : Promise.resolve(),
      // 4. Create a Loyalty Transaction for Auditing
      pointsEarned > 0 ? LoyaltyTransaction.create({
          customerId,
          points: pointsEarned,
          type: 'Credit',
          reason: `Purchase from Invoice #${savedInvoice.invoiceNumber}`,
          relatedInvoiceId: savedInvoice._id
      }) : Promise.resolve()
    ]);

    return NextResponse.json({ 
        success: true,
        message: `Invoice created successfully. ${pointsEarned} loyalty points awarded.`,
        data: savedInvoice
    }, { status: 201 });

  } catch (error) {
    console.error("API Error POST /api/invoices:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ success: false, message: "Error creating invoice", error: errorMessage }, { status: 500 });
  }
}