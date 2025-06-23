// app/api/customer/search-by-barcode/route.ts - UPDATED WITH PROPER TYPING
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer, { ICustomer } from '@/models/customermodel';
import Appointment from '@/models/Appointment';

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(req.url);
    const barcode = searchParams.get('barcode');
    
    if (!barcode) {
      return NextResponse.json({
        success: false,
        message: 'Barcode is required'
      }, { status: 400 });
    }
    
    // Find customer by barcode using the static method
    const customer: ICustomer | null = await Customer.findByBarcode(barcode);
    
    if (!customer) {
      return NextResponse.json({
        success: false,
        message: 'No customer found with this barcode'
      }, { status: 404 });
    }
    
    // Get appointment history for the customer
    const appointmentHistory = await Appointment.find({
      customerId: customer._id
    })
    .populate('stylistId', 'name')
    .populate('serviceIds', 'name')
    .sort({ date: -1 })
    .limit(10);

    const formattedHistory = appointmentHistory.map(apt => ({
      _id: apt._id,
      date: apt.date,
      services: apt.serviceIds?.map((s: any) => s.name) || [],
      totalAmount: apt.finalAmount || 0,
      stylistName: apt.stylistId?.name || 'N/A',
      status: apt.status
    }));

    const customerDetails = {
      _id: customer._id,
      name: customer.name,
      email: customer.email,
      phoneNumber: customer.phoneNumber,
      isMember: customer.isMembership,
      membershipBarcode: customer.membershipBarcode,
      membershipDetails: customer.isMembership ? {
        planName: 'Member',
        status: 'Active'
      } : null,
      lastVisit: appointmentHistory.length > 0 ? appointmentHistory[0].date : null,
      appointmentHistory: formattedHistory,
      loyaltyPoints: customer.loyaltyPoints || 0
    };
    
    return NextResponse.json({
      success: true,
      customer: customerDetails
    });
    
  } catch (error) {
    console.error('Error searching customer by barcode:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to search customer by barcode'
    }, { status: 500 });
  }
}