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

// This interface should reflect the actual fields in your Customer model
interface LeanCustomer { 
  _id: mongoose.Types.ObjectId; 
  createdAt?: Date; 
  name: string; 
  email?: string; 
  phoneNumber: string; 
  isActive: boolean; // Add this field
  isMembership: boolean; // This is the key field for your simple system
}

// ===================================================================================
//  GET: Handler for fetching full customer details (FIXED)
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
    
    // Fetch the core customer data, including the simple `isMembership` field
    const customer = await Customer.findById(customerId).lean<LeanCustomer>();
    if (!customer) {
      return NextResponse.json({ success: false, message: 'Customer not found.' }, { status: 404 });
    }

    // Fetch related data in parallel.
    // NOTE: We no longer need to query the complex CustomerMembership collection.
    const [allRecentAppointments, loyaltyData] = await Promise.all([
      Appointment.find({ customerId: customer._id }).sort({ date: -1 }).limit(20).lean(),
      LoyaltyTransaction.aggregate([
        { $match: { customerId: customer._id } },
        { $group: { _id: null, totalPoints: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }] } } } }
      ])
    ]);

    // Determine activity status
    let activityStatus: 'Active' | 'Inactive' | 'New' = 'New';
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    if (allRecentAppointments.length > 0) {
      activityStatus = new Date(allRecentAppointments[0].date) >= twoMonthsAgo ? 'Active' : 'Inactive';
    } else if (customer.createdAt) {
      activityStatus = new Date(customer.createdAt) < twoMonthsAgo ? 'Inactive' : 'New';
    }

    const calculatedLoyaltyPoints = loyaltyData.length > 0 ? loyaltyData[0].totalPoints : 0;

    // Get paid appointment history
    const paidAppointmentIds = allRecentAppointments.filter(apt => apt.status === 'Paid').slice(0, 10).map(apt => apt._id);
    const populatedHistory = await Appointment.find({ _id: { $in: paidAppointmentIds } })
      .sort({ date: -1 })
      .populate({ path: 'stylistId', model: Stylist, select: 'name' })
      .populate({ path: 'serviceIds', model: ServiceItem, select: 'name price' })
      .lean();

    // --- CONSTRUCT THE FINAL, CORRECT OBJECT ---
    const customerDetails = {
      id: customer._id.toString(),
      name: customer.name,
      email: customer.email,
      phoneNumber: customer.phoneNumber,
      status: activityStatus,
      loyaltyPoints: calculatedLoyaltyPoints,
      
      // --- THE CRITICAL FIX ---
      // We now use the simple `isMembership` boolean from the Customer model
      // as the single source of truth for the `currentMembership` property
      // that the front-end panel component uses.
      currentMembership: customer.isMembership,
      
      createdAt: customer.createdAt || customer._id.getTimestamp(),

      appointmentHistory: populatedHistory.map(apt => ({
        _id: (apt as any)._id.toString(),
        id: (apt as any)._id.toString(),
        date: (apt as any).date.toISOString(),
        totalAmount: (apt as any).amount || 0,
        stylistName: (apt as any).stylistId?.name || 'N/A',
        services: Array.isArray((apt as any).serviceIds) ? (apt as any).serviceIds.map((s: any) => s.name) : [],
      }))
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

    // Validate required fields
    if (!body.name || !body.phoneNumber) {
      return NextResponse.json({ 
        success: false, 
        message: 'Name and phone number are required.' 
      }, { status: 400 });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      customerId,
      {
        name: body.name.trim(),
        email: body.email?.trim(),
        phoneNumber: body.phoneNumber.trim(),
      },
      { new: true, runValidators: true }
    );

    if (!updatedCustomer) {
      return NextResponse.json({ success: false, message: 'Customer not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, customer: updatedCustomer });

  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({ 
        success: false, 
        message: 'Another customer with this phone number or email already exists.' 
      }, { status: 409 });
    }
    console.error(`API Error updating customer ${customerId}:`, error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Failed to update customer.' 
    }, { status: 500 });
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
    
    // Soft delete: set isActive to false instead of deleting
    const deactivatedCustomer = await Customer.findByIdAndUpdate(
      customerId,
      { isActive: false },
      { new: true }
    );

    if (!deactivatedCustomer) {
      return NextResponse.json({ success: false, message: 'Customer not found.' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Customer has been deactivated successfully.' 
    });

  } catch (error: any) {
    console.error(`API Error deactivating customer ${customerId}:`, error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Failed to deactivate customer.' 
    }, { status: 500 });
  }
}