import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/appointment';
import Service from '@/models/service';
import Stylist from '@/models/stylist';
import CustomerMembership from '@/models/customerMembership';
import MembershipPlan from '@/models/membershipPlan';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import mongoose from 'mongoose';

// --- TYPE DEFINITIONS ---
interface LeanCustomer { _id: mongoose.Types.ObjectId; createdAt?: Date; name: string; email?: string; phoneNumber: string; }

// ===================================================================================
//  GET: Handler for fetching full customer details for the side panel
// ===================================================================================
export async function GET(req: Request, { params }: { params: { id: string } }) {
  // ... Your existing GET function is excellent and does not need to be changed.
  // It correctly fetches all the necessary details.
  const customerId = params.id;
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    return NextResponse.json({ success: false, message: 'Invalid Customer ID.' }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const customer = await Customer.findById(customerId).lean<LeanCustomer>();
    if (!customer) {
      return NextResponse.json({ success: false, message: 'Customer not found.' }, { status: 404 });
    }
    const [activeMembership, allRecentAppointments, loyaltyData] = await Promise.all([
      CustomerMembership.findOne({ customerId: customer._id, status: 'Active', endDate: { $gte: new Date() } }).populate({ path: 'membershipPlanId', model: MembershipPlan, select: 'name status endDate' }),
      Appointment.find({ customerId: customer._id }).sort({ date: -1 }).limit(20).lean(),
      LoyaltyTransaction.aggregate([ { $match: { customerId: customer._id } }, { $group: { _id: null, totalPoints: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }] } } } } ])
    ]);
    let activityStatus: 'Active' | 'Inactive' | 'New' = 'New';
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    if (allRecentAppointments.length > 0) {
      const lastAppointmentDate = new Date(allRecentAppointments[0].date);
      activityStatus = lastAppointmentDate >= twoMonthsAgo ? 'Active' : 'Inactive';
    } else if (customer.createdAt) {
      const customerCreationDate = new Date(customer.createdAt);
      activityStatus = customerCreationDate < twoMonthsAgo ? 'Inactive' : 'New';
    }
    const calculatedLoyaltyPoints = loyaltyData.length > 0 ? loyaltyData[0].totalPoints : 0;
    const paidAppointmentIds = allRecentAppointments.filter(apt => apt.status === 'Paid').slice(0, 10).map(apt => apt._id);
    const populatedHistory = await Appointment.find({ _id: { $in: paidAppointmentIds } }).sort({ date: -1 }).populate({ path: 'stylistId', model: Stylist, select: 'name' }).populate({ path: 'serviceIds', model: Service, select: 'name' }).lean();
    const customerDetails = {
      ...customer, id: customer._id.toString(), status: activityStatus, loyaltyPoints: calculatedLoyaltyPoints,
      currentMembership: activeMembership ? { planName: (activeMembership.membershipPlanId as any)?.name || 'N/A', status: activeMembership.status, endDate: (activeMembership as any).endDate.toISOString(), } : null,
      appointmentHistory: populatedHistory.map(apt => ({ id: (apt as any)._id.toString(), date: (apt as any).date.toISOString(), totalAmount: (apt as any).amount || 0, stylistName: (apt as any).stylistId?.name || 'N/A', services: Array.isArray((apt as any).serviceIds) ? (apt as any).serviceIds.map((s: any) => s.name) : [], }))
    };
    return NextResponse.json({ success: true, customer: customerDetails });
  } catch (error: any) {
    console.error(`API Error fetching details for customer ${params.id}:`, error);
    return NextResponse.json({ success: false, message: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}


// ===================================================================================
//  PUT: Handler for UPDATING a customer
// ===================================================================================
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const customerId = params.id;
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    return NextResponse.json({ success: false, message: 'Invalid Customer ID.' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const body = await req.json();

    const updatedCustomer = await Customer.findByIdAndUpdate(
      customerId,
      {
        name: body.name,
        email: body.email,
        phoneNumber: body.phoneNumber,
      },
      { new: true, runValidators: true }
    );

    if (!updatedCustomer) {
      return NextResponse.json({ success: false, message: 'Customer not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, customer: updatedCustomer });
  } catch (error: any) {
    if (error.code === 11000) {
        return NextResponse.json({ success: false, message: 'Another customer with this phone number or email already exists.' }, { status: 409 });
    }
    console.error(`API Error updating customer ${customerId}:`, error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to update customer.' }, { status: 500 });
  }
}


// ===================================================================================
//  DELETE: Handler for "soft deleting" (deactivating) a customer
// ===================================================================================
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const customerId = params.id;
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    return NextResponse.json({ success: false, message: 'Invalid Customer ID.' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    
    // Instead of deleting, we find the customer and set their isActive flag to false.
    const deactivatedCustomer = await Customer.findByIdAndUpdate(
      customerId,
      { isActive: false },
      { new: true }
    );

    if (!deactivatedCustomer) {
      return NextResponse.json({ success: false, message: 'Customer not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Customer has been deactivated successfully.' });

  } catch (error: any) {
    console.error(`API Error deactivating customer ${customerId}:`, error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to deactivate customer.' }, { status: 500 });
  }
}