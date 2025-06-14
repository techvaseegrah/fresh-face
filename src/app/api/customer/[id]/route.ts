// In /api/customer/[id]/route.ts

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/appointment';
import Service from '@/models/service';
import Stylist from '@/models/stylist';
import Staff from '@/models/staff'; // IMPORTANT: Make sure the Staff model is imported
import CustomerMembership from '@/models/customerMembership';
import MembershipPlan from '@/models/membershipPlan';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import mongoose from 'mongoose';

// --- TYPE DEFINITIONS ---
interface LeanCustomer { _id: mongoose.Types.ObjectId; createdAt?: Date; name: string; email?: string; phoneNumber: string; }

// ===================================================================================
//  GET: Handler for fetching full customer details (FINAL CORRECTED VERSION)
// ===================================================================================
export async function GET(req: Request, { params }: { params: { id: string } }) {
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

    // --- Fetch all related data in parallel for efficiency ---
    const [activeMembership, allRecentAppointments, loyaltyData] = await Promise.all([
      CustomerMembership.findOne({ customerId: customer._id, status: 'Active', endDate: { $gte: new Date() } }).populate({ path: 'membershipPlanId', model: MembershipPlan, select: 'name' }),
      
      // Fetch appointments ONCE with all necessary data populated
      Appointment.find({ customerId: customer._id })
        .sort({ date: -1 })
        .limit(20) // Limit history for performance
        .populate('serviceIds', 'name') // Populate service names
        .populate({
            path: 'stylistId', // 1. Populate the stylistId field...
            populate: {
                path: 'staffInfo', // 2. ...then, within that, populate the staffInfo field
                model: Staff,      // 3. USE THE IMPORTED MODEL DIRECTLY - This is the safest way
                select: 'name'     // 4. Select the name from the Staff model
            }
        })
        .lean(),

      LoyaltyTransaction.aggregate([ { $match: { customerId: customer._id } }, { $group: { _id: null, totalPoints: { $sum: '$points' } } } ])
    ]);

    // --- Determine Activity Status ---
    let activityStatus: 'Active' | 'Inactive' | 'New' = 'New';
    const twoMonthsAgo = new Date(); twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    if (allRecentAppointments.length > 0) {
      const lastAppointmentDate = new Date(allRecentAppointments[0].date);
      activityStatus = lastAppointmentDate >= twoMonthsAgo ? 'Active' : 'Inactive';
    } else if (customer.createdAt) {
      const customerCreationDate = new Date(customer.createdAt);
      activityStatus = customerCreationDate < twoMonthsAgo ? 'Inactive' : 'New';
    }
    
    // --- Final Data Formatting ---
    const calculatedLoyaltyPoints = loyaltyData.length > 0 ? loyaltyData[0].totalPoints : 0;
    
    const customerDetails = {
      ...customer,
      id: customer._id.toString(),
      status: activityStatus,
      loyaltyPoints: calculatedLoyaltyPoints,
      currentMembership: activeMembership ? { planName: (activeMembership.membershipPlanId as any)?.name || 'N/A', status: activeMembership.status, endDate: (activeMembership as any).endDate.toISOString() } : null,
      
      // Map over the correctly populated appointment history
      appointmentHistory: allRecentAppointments
        .filter(apt => apt.status === 'Paid' || apt.status === 'Billed') // Show paid or billed history
        .slice(0, 10)
        .map(apt => ({
          id: (apt as any)._id.toString(),
          date: (apt as any).date.toISOString(),
          totalAmount: (apt as any).amount || 0,
          // This fallback logic handles both old and new appointments
          stylistName: (apt as any).stylistName || (apt as any).stylistId?.staffInfo?.name || 'N/A',
          services: Array.isArray((apt as any).serviceIds) ? (apt as any).serviceIds.map((s: any) => s.name) : [],
      }))
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