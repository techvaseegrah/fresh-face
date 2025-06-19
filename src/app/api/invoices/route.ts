// src/app/api/invoices/route.ts - FINAL CORRECTED VERSION
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Invoice from '@/models/invoice';
import Appointment from '@/models/Appointment';
import ShopSetting from '@/models/ShopSetting';
import Customer from '@/models/customermodel';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import Stylist from '@/models/Stylist'; // Added for updating stylist status

export async function POST(request: Request) {
  await dbConnect();

  try {
    const body = await request.json();
    // 1. Destructure all necessary fields, including serviceTotal and stylistId
    const { 
        appointmentId, 
        customerId, 
        stylistId, 
        serviceTotal, // <-- Key field for loyalty points
        grandTotal, 
        lineItems 
    } = body;

    // Updated validation to check for all required fields
    if (!appointmentId || !customerId || !stylistId || serviceTotal === undefined || grandTotal === undefined || !lineItems) {
      return NextResponse.json(
        { success: false, message: "Missing required fields." },
        { status: 400 }
      );
    }
    
    // ==================== START OF MODIFIED LOGIC ====================

    // --- LOYALTY LOGIC (Based on Service Total) ---
    const settings = await ShopSetting.findOne({ key: 'defaultSettings' }).lean();
    let pointsEarned = 0;
    
    // Use serviceTotal for the calculation
    const eligibleAmountForPoints = Number(serviceTotal);

    // Default rule as a fallback
    const loyaltyRule = settings 
      ? { price: settings.loyaltyPointPerPrice, points: settings.loyaltyPointsAwarded }
      : { price: 100, points: 1 }; // Default: 1 point per 100

    if (loyaltyRule.price > 0 && eligibleAmountForPoints > 0) {
        // Use Math.floor to correctly calculate spending blocks from the service total
        // Example: Math.floor(560 / 100) = 5
        const spendingBlocks = Math.floor(eligibleAmountForPoints / loyaltyRule.price);
        
        // Example: 5 blocks * 4 points/block = 20 points
        pointsEarned = spendingBlocks * loyaltyRule.points;
    }

    // ===================== END OF MODIFIED LOGIC =====================

    // Create the new invoice
    const newInvoice = new Invoice({
      ...body, 
      paymentStatus: 'Paid'
    });
    
    const savedInvoice = await newInvoice.save();

    // Use Promise.all to run database updates concurrently for better performance
    await Promise.all([
        // Update the Appointment
        Appointment.findByIdAndUpdate(appointmentId, {
            $set: { status: 'Paid', finalAmount: grandTotal, invoiceId: savedInvoice._id }
        }),
        // Make the Stylist available again
        Stylist.findByIdAndUpdate(stylistId, {
            isAvailable: true,
            currentAppointmentId: null
        }),
        // Award loyalty points to the customer (if any were earned)
        pointsEarned > 0 
            ? Customer.findByIdAndUpdate(customerId, { $inc: { loyaltyPoints: pointsEarned } }) 
            : Promise.resolve(),
        // Create a transaction record for auditing purposes (if points were earned)
        pointsEarned > 0 
            ? LoyaltyTransaction.create({
                customerId,
                points: pointsEarned,
                type: 'Credit',
                reason: 'Completed Appointment Service',
                relatedInvoiceId: savedInvoice._id,
                relatedAppointmentId: appointmentId
            }) 
            : Promise.resolve()
    ]);

    // Return a successful response
    return NextResponse.json(
        { 
            success: true,
            message: `Invoice created successfully. ${pointsEarned} points awarded based on service total.`,
            data: savedInvoice
        }, 
        { status: 201 }
    );

  } catch (error) {
    console.error("API Error POST /api/invoices:", error);
    let errorMessage = "Internal Server Error";
    if (error instanceof Error) {
        errorMessage = error.message;
        if (error.name === 'ValidationError') {
            return NextResponse.json({ success: false, message: "Database Validation Failed", error: errorMessage }, { status: 400 });
        }
    }
    return NextResponse.json({ success: false, message: "Error creating invoice", error: errorMessage }, { status: 500 });
  }
}