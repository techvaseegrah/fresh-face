import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/Appointment';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// ===================================================================================
//  TYPE DEFINITIONS
// ===================================================================================

interface LeanCustomer {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  name: string;
  email?: string;
  phoneNumber: string;
  isActive?: boolean;
}

interface AggregatedAppointment {
  _id: mongoose.Types.ObjectId; // This will be the customerId
  lastAppointmentDate: Date;
}

// ===================================================================================
//  GET: Handler for fetching customers with corrected status logic
// ===================================================================================
export async function GET(req: Request) {
  try {
    await connectToDatabase();

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_READ)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const searchQuery = searchParams.get('search');
    const skip = (page - 1) * limit;

    let query: any = { isActive: true };
    if (searchQuery) {
      const searchRegex = new RegExp(searchQuery, 'i');
      query.$or = [
        { name: searchRegex },
        { phoneNumber: searchRegex }
      ];
    }

    const [customersFromDb, totalCustomers] = await Promise.all([
      Customer.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<LeanCustomer[]>(),
      Customer.countDocuments(query)
    ]);

    const customerIds = customersFromDb.map(c => c._id);
    const latestAppointments = await Appointment.aggregate<AggregatedAppointment>([
      { $match: { customerId: { $in: customerIds } } },
      { $addFields: { unifiedDate: { $ifNull: ["$appointmentDateTime", "$date"] } } },
      { $sort: { unifiedDate: -1 } },
      { $group: { _id: '$customerId', lastAppointmentDate: { $first: '$unifiedDate' } } }
    ]);

    const appointmentMap = new Map(latestAppointments.map(a => [a._id.toString(), a.lastAppointmentDate]));
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    // --- CORRECTED STATUS CALCULATION LOGIC ---
    const customersWithStatus = customersFromDb.map(customer => {
      const lastAppointmentDate = appointmentMap.get(customer._id.toString());
      let status: 'Active' | 'Inactive' | 'New';

      // Case 1: The customer has an appointment history.
      if (lastAppointmentDate) {
        // If their last visit was within two months, they are Active. Otherwise, Inactive.
        status = new Date(lastAppointmentDate) >= twoMonthsAgo ? 'Active' : 'Inactive';
      } 
      // Case 2: The customer has NO appointment history.
      else {
        // If their account was created more than two months ago, they are Inactive. Otherwise, New.
        if (customer.createdAt && new Date(customer.createdAt) < twoMonthsAgo) {
          status = 'Inactive';
        } else {
          status = 'New';
        }
      }
      
      return {
        ...customer,
        id: customer._id.toString(),
        status: status,
      };
    });
    // --- END OF CORRECTION ---

    const totalPages = Math.ceil(totalCustomers / limit);

    return NextResponse.json({
      success: true,
      customers: customersWithStatus,
      pagination: { totalCustomers, totalPages, currentPage: page, limit }
    });

  } catch (error: any) {
    console.error("API Error fetching customers:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch customers" }, { status: 500 });
  }
}

// ===================================================================================
//  POST: Handler for creating a new customer
// ===================================================================================
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_CREATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    if (!body.name || !body.phoneNumber) {
      return NextResponse.json({ success: false, message: 'Name and Phone Number are required.' }, { status: 400 });
    }

    const normalizedPhoneNumber = String(body.phoneNumber).replace(/\D/g, '');

    const existingCustomer = await Customer.findOne({ phoneNumber: normalizedPhoneNumber });
    if (existingCustomer) {
      return NextResponse.json({ success: false, message: 'A customer with this phone number already exists.', exists: true, customer: existingCustomer }, { status: 409 });
    }

    const newCustomer = await Customer.create({
      ...body,
      phoneNumber: normalizedPhoneNumber,
      gender: body.gender || 'other',
    });

    return NextResponse.json({ success: true, customer: newCustomer }, { status: 201 });
  } catch (error: any) {
    console.error("API Error creating customer:", error);
    return NextResponse.json({ success: false, message: "Failed to create customer" }, { status: 500 });
  }
}