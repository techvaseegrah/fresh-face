// app/api/billing/route.ts - CREATE INVOICE, UPDATE APPOINTMENT, AND AWARD LOYALTY POINTS
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import Invoice from '@/models/invoice';
import Stylist from '@/models/Stylist';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import Setting from '@/models/Setting';

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    
    // 1. Destructure all expected data from the request body
    const {
      appointmentId,
      customerId,
      stylistId,
      items,
      serviceTotal,
      productTotal,
      subtotal,
      membershipDiscount,
      grandTotal,
      paymentMethod,
      notes,
      customerWasMember,
      membershipGrantedDuringBilling
    } = await req.json();

    console.log('Processing billing for appointment:', appointmentId);
    console.log('Grand total:', grandTotal);

    // 2. Create the primary Invoice document
    const invoice = await Invoice.create({
      appointmentId,
      customerId,
      stylistId,
      lineItems: items,
      serviceTotal: serviceTotal || 0,
      productTotal: productTotal || 0,
      subtotal: subtotal || grandTotal,
      membershipDiscount: membershipDiscount || 0,
      grandTotal,
      paymentMethod,
      notes,
      customerWasMember: customerWasMember || false,
      membershipGrantedDuringBilling: membershipGrantedDuringBilling || false,
      paymentStatus: 'Paid'
    });

    console.log('Created invoice:', invoice.invoiceNumber);

    // 3. Dynamic Loyalty Point Logic
    // Fetch the current loyalty rule from settings.
    const loyaltySetting = await Setting.findOne({ key: 'loyalty_points_rule' }).lean();

    // Define a default rule as a robust fallback.
    const defaultRule = { pointsPerAmount: 6, amount: 100 };
    const currentRule = loyaltySetting ? loyaltySetting.value : defaultRule;

    // Calculate points earned for this transaction.
    let pointsToCredit = 0;
    if (currentRule && typeof currentRule.amount === 'number' && currentRule.amount > 0) {
        pointsToCredit = Math.floor(invoice.grandTotal / currentRule.amount) * currentRule.pointsPerAmount;
    }

    // If points were earned, create an auditable LoyaltyTransaction record.
    if (pointsToCredit > 0) {
        await LoyaltyTransaction.create({
            customerId: invoice.customerId,
            type: 'Credit',
            points: pointsToCredit,
            reason: 'Purchase',
            description: `Points earned from Invoice #${invoice.invoiceNumber}`,
            relatedInvoiceId: invoice._id,
        });
        console.log(`Awarded ${pointsToCredit} loyalty points for invoice ${invoice.invoiceNumber}.`);
    }

    // 4. Update the related Appointment document
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      {
        amount: subtotal || grandTotal,
        membershipDiscount: membershipDiscount || 0,
        finalAmount: grandTotal,
        invoiceId: invoice._id,
        status: 'Paid'
      },
      { new: true } // Return the updated document
    );

    console.log('Updated appointment with amount:', grandTotal);

    // 5. Update the Stylist's status to make them available again
    await Stylist.findByIdAndUpdate(stylistId, {
      isAvailable: true,
      currentAppointmentId: null,
      lastAvailabilityChange: new Date()
    });

    console.log('Unlocked stylist');

    // 6. Return a successful response to the frontend
    return NextResponse.json({
      success: true,
      message: 'Payment processed successfully!',
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        grandTotal: invoice.grandTotal,
        paymentMethod: invoice.paymentMethod
      },
      appointment: updatedAppointment
    });

  } catch (error: any) {
    // Catch any errors during the process and return a structured error message
    console.error('Billing API Error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to process payment'
    }, { status: 500 });
  }
}
