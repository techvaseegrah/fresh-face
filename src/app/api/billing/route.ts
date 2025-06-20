// app/api/billing/route.ts - CREATE INVOICE AND UPDATE APPOINTMENT
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import Invoice from '@/models/invoice';
import Stylist from '@/models/Stylist';

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    
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

    // Create invoice
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

    // Update appointment with amount and mark as paid
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      {
        amount: subtotal || grandTotal,
        membershipDiscount: membershipDiscount || 0,
        finalAmount: grandTotal,
        invoiceId: invoice._id,
        status: 'Paid'
      },
      { new: true }
    );

    console.log('Updated appointment with amount:', grandTotal);

    // Unlock stylist
    await Stylist.findByIdAndUpdate(stylistId, {
      isAvailable: true,
      currentAppointmentId: null,
      lastAvailabilityChange: new Date()
    });

    console.log('Unlocked stylist');

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
    console.error('Billing API Error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to process payment'
    }, { status: 500 });
  }
}