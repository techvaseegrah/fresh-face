// /app/api/customer/[id]/route.ts - FINAL CORRECTED VERSION

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/Appointment';
import ServiceItem from '@/models/ServiceItem';
import Stylist from '@/models/Stylist';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

interface LeanCustomer { 
  _id: mongoose.Types.ObjectId; 
  createdAt?: Date; 
  name: string; 
  email?: string; 
  phoneNumber: string; 
  gender?: string;
  isActive: boolean;
  isMembership: boolean;
}

// ===================================================================================
//  GET: Handler for fetching full customer details
// ===================================================================================
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const customerId = params.id;

  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_READ)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    return NextResponse.json({ success: false, message: 'Invalid Customer ID.' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    
    const customer = await Customer.findById(customerId).lean<LeanCustomer>();
    if (!customer) {
      return NextResponse.json({ success: false, message: 'Customer not found.' }, { status: 404 });
    }

    // Sort by new field first, then fallback to old field for sorting
    const [allRecentAppointments, loyaltyData] = await Promise.all([
      Appointment.find({ customerId: customer._id }).sort({ appointmentDateTime: -1, date: -1 }).limit(20).lean(),
      LoyaltyTransaction.aggregate([
        { $match: { customerId: customer._id } },
        { $group: { _id: null, totalPoints: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }] } } } }
      ])
    ]);

    let activityStatus: 'Active' | 'Inactive' | 'New' = 'New';
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    if (allRecentAppointments.length > 0) {
      // Use the first appointment's date, whether it's the new or old format
      const lastAppointmentDate = allRecentAppointments[0].appointmentDateTime || allRecentAppointments[0].date;
      if (lastAppointmentDate) {
        activityStatus = new Date(lastAppointmentDate) >= twoMonthsAgo ? 'Active' : 'Inactive';
      }
    } else if (customer.createdAt) {
      activityStatus = new Date(customer.createdAt) < twoMonthsAgo ? 'Inactive' : 'New';
    }

    const calculatedLoyaltyPoints = loyaltyData.length > 0 ? loyaltyData[0].totalPoints : 0;

    const paidAppointmentIds = allRecentAppointments.filter(apt => apt.status === 'Paid').slice(0, 10).map(apt => apt._id);
    const populatedHistory = await Appointment.find({ _id: { $in: paidAppointmentIds } })
      .sort({ appointmentDateTime: -1, date: -1 })
      .populate({ path: 'stylistId', model: Stylist, select: 'name' })
      .populate({ path: 'serviceIds', model: ServiceItem, select: 'name price' })
      .lean();

    const customerDetails = {
      id: customer._id.toString(),
      name: customer.name,
      email: customer.email,
      phoneNumber: customer.phoneNumber,
      gender: customer.gender,
      status: activityStatus,
      loyaltyPoints: calculatedLoyaltyPoints,
      currentMembership: customer.isMembership,
      createdAt: customer.createdAt || customer._id.getTimestamp(),

      // --- THIS IS THE FIX FOR THE APPOINTMENT HISTORY ---
      appointmentHistory: populatedHistory.map(apt => {
        let finalDateTime;

        // 1. Check if the new field exists and is valid (for new appointments)
        if (apt.appointmentDateTime && apt.appointmentDateTime instanceof Date) {
          finalDateTime = apt.appointmentDateTime;
        } 
        // 2. If not, construct it from the old fields (for old appointments)
        else if (apt.date && apt.time) {
          const dateStr = apt.date instanceof Date ? apt.date.toISOString().split('T')[0] : apt.date.toString();
          finalDateTime = new Date(`${dateStr}T${apt.time}:00.000Z`);
        } else {
          // 3. Fallback if all else fails
          finalDateTime = apt.createdAt || new Date();
        }

        return {
          _id: (apt as any)._id.toString(),
          id: (apt as any)._id.toString(),
          // 4. ALWAYS use the valid finalDateTime object
          date: finalDateTime.toISOString(), // The key 'date' is expected by the frontend history panel
          totalAmount: (apt as any).finalAmount || (apt as any).amount || 0,
          stylistName: (apt as any).stylistId?.name || 'N/A',
          services: Array.isArray((apt as any).serviceIds) ? (apt as any).serviceIds.map((s: any) => s.name) : [],
          status: (apt as any).status || 'N/A',
        };
      })
      // --- END OF FIX ---
    };

    return NextResponse.json({ success: true, customer: customerDetails });

  } catch (error: any) {
    console.error(`API Error fetching details for customer ${params.id}:`, error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
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

  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_UPDATE)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const body = await req.json();

    if (!body.name || !body.phoneNumber) {
      return NextResponse.json({ success: false, message: 'Name and phone number are required.' }, { status: 400 });
    }
    
    if (body.gender && !['male', 'female', 'other'].includes(body.gender)) {
        return NextResponse.json({ success: false, message: 'Invalid gender specified.' }, { status: 400 });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      customerId,
      {
        name: body.name.trim(),
        email: body.email?.trim(),
        phoneNumber: body.phoneNumber.trim(),
        gender: body.gender,
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

  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_DELETE)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    
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