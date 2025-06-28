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

// This interface should reflect the actual fields your lean() query returns
interface LeanCustomer {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  name: string;
  email?: string;
  phoneNumber: string;
  gender?: string;
  isActive: boolean;
  isMembership: boolean;
  membershipBarcode?: string;
}

// ===================================================================================
//  GET: Handler for fetching full customer details (This function is already correct)
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

    const [allRecentAppointments, loyaltyData] = await Promise.all([
      Appointment.find({ customerId: customer._id }).sort({ appointmentDateTime: -1, date: -1 }).limit(20).lean(),
      LoyaltyTransaction.aggregate([
        { $match: { customerId: customer._id } },
        { $group: { _id: null, totalPoints: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }] } } } }
      ])
    ]);

    let activityStatus: 'Active' | 'Inactive' | 'New' = 'New';
    let lastVisit: string | null = null;
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    if (allRecentAppointments.length > 0) {
      const lastAppointmentDate = allRecentAppointments[0].appointmentDateTime || allRecentAppointments[0].date;
      if (lastAppointmentDate) {
        activityStatus = new Date(lastAppointmentDate) >= twoMonthsAgo ? 'Active' : 'Inactive';
        lastVisit = new Date(lastAppointmentDate).toISOString();
      }
    } else if (customer.createdAt) {
      activityStatus = new Date(customer.createdAt) < twoMonthsAgo ? 'Inactive' : 'New';
    }

    const calculatedLoyaltyPoints = loyaltyData.length > 0 ? loyaltyData[0].totalPoints : 0;

    const paidAppointmentIds = allRecentAppointments.filter(apt => apt.status === 'Paid').map(apt => apt._id);
    const populatedHistory = await Appointment.find({ _id: { $in: paidAppointmentIds } })
      .sort({ appointmentDateTime: -1, date: -1 })
      .populate({ path: 'stylistId', model: Stylist, select: 'name' })
      .populate({ path: 'serviceIds', model: ServiceItem, select: 'name price' })
      .lean();

    const customerDetails = {
      id: customer._id.toString(),
      _id: customer._id.toString(),
      name: customer.name,
      email: customer.email,
      phoneNumber: customer.phoneNumber,
      gender: customer.gender,
      isMember: customer.isMembership,
      membershipBarcode: customer.membershipBarcode,
      membershipDetails: customer.isMembership ? { planName: 'Member', status: 'Active' } : null,
      status: activityStatus,
      lastVisit: lastVisit,
      loyaltyPoints: calculatedLoyaltyPoints,
      currentMembership: customer.isMembership,
      createdAt: customer.createdAt || customer._id.getTimestamp(),
      appointmentHistory: populatedHistory.map(apt => {
        let finalDateTime;
        if (apt.appointmentDateTime && apt.appointmentDateTime instanceof Date) {
          finalDateTime = apt.appointmentDateTime;
        } else if (apt.date && apt.time) {
          const dateStr = apt.date instanceof Date ? apt.date.toISOString().split('T')[0] : apt.date.toString();
          finalDateTime = new Date(`${dateStr}T${apt.time}:00.000Z`);
        } else {
          finalDateTime = apt.createdAt || new Date();
        }
        return {
          _id: (apt as any)._id.toString(),
          id: (apt as any)._id.toString(),
          date: finalDateTime.toISOString(),
          totalAmount: (apt as any).finalAmount || (apt as any).amount || 0,
          stylistName: (apt as any).stylistId?.name || 'N/A',
          services: Array.isArray((apt as any).serviceIds) ? (apt as any).serviceIds.map((s: any) => s.name) : [],
          status: (apt as any).status || 'N/A',
        };
      })
    };

    return NextResponse.json({ success: true, customer: customerDetails });

  } catch (error: any) {
    console.error(`API Error fetching details for customer ${params.id}:`, error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}

// ===================================================================================
//  PUT: Handler for UPDATING a customer (CORRECTED)
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
    
    // --- THIS IS THE FIX TO ENSURE ENCRYPTION ON UPDATE ---

    // 1. Find the existing customer document first. Do NOT use findByIdAndUpdate.
    const customer = await Customer.findById(customerId);

    if (!customer) {
      return NextResponse.json({ success: false, message: 'Customer not found.' }, { status: 404 });
    }

    // 2. Update the fields on the Mongoose document instance.
    customer.name = body.name.trim();
    customer.email = body.email?.trim();
    customer.phoneNumber = body.phoneNumber.trim();
    if (body.gender && ['male', 'female', 'other'].includes(body.gender)) {
      customer.gender = body.gender;
    }

    // 3. Call .save(). This will trigger your 'pre-save' hook,
    // which automatically handles encrypting the updated fields before saving.
    const updatedCustomer = await customer.save();

    // --- END OF FIX ---

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
//  DELETE: Handler for "soft deleting" (deactivating) a customer (This is correct)
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