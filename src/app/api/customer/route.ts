import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/appointment';
import mongoose from 'mongoose';

// ===================================================================================
//  TYPE DEFINITIONS
// ===================================================================================

// Defines the shape of the customer document for type safety with .lean()
interface LeanCustomer {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  name: string;
  email?: string;
  phoneNumber: string;
  isActive?: boolean;
}

// Defines the shape of the result from our aggregation query for status calculation
interface AggregatedAppointment {
  _id: mongoose.Types.ObjectId; // This will be the customerId
  lastAppointmentDate: Date;
}

// ===================================================================================
//  GET: Handler for fetching customers with search & pagination & active filter
// ===================================================================================
export async function GET(req: Request) {
  try {
    await connectToDatabase();
    
    // --- 1. Read Parameters from URL ---
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const searchQuery = searchParams.get('search');
    const skip = (page - 1) * limit;

    // --- 2. Build the Search Query object ---
    // The base query ALWAYS filters for active customers.
    let query: any = { isActive: true };

    // If a search query is provided, add the search logic on top of the base query.
    if (searchQuery) {
      const searchRegex = new RegExp(searchQuery, 'i'); // Case-insensitive
      query.$or = [
        { name: searchRegex },
        //{ email: searchRegex },
        { phoneNumber: searchRegex }
      ];
    }

    // --- 3. Perform Database Queries in Parallel for Efficiency ---
    const [customersFromDb, totalCustomers] = await Promise.all([
      // Query 1: Get the customers for the *current page* that are active and match search
      Customer.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<LeanCustomer[]>(),
      
      // Query 2: Get the *total count* of customers that are active and match search
      Customer.countDocuments(query)
    ]);
    
    // --- 4. Calculate 'Active/Inactive/New' Status for Each Customer ---
    const customerIds = customersFromDb.map(c => c._id);
    const latestAppointments = await Appointment.aggregate<AggregatedAppointment>([
      { $match: { customerId: { $in: customerIds } } },
      { $sort: { date: -1 } },
      { $group: { _id: '$customerId', lastAppointmentDate: { $first: '$date' } } }
    ]);
    
    const appointmentMap = new Map(latestAppointments.map(a => [a._id.toString(), a.lastAppointmentDate]));
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const customersWithStatus = customersFromDb.map(customer => {
      let status: 'Active' | 'Inactive' | 'New' = 'New';
      const lastAppointmentDate = appointmentMap.get(customer._id.toString());
      
      if (lastAppointmentDate) {
        status = new Date(lastAppointmentDate) >= twoMonthsAgo ? 'Active' : 'Inactive';
      } else if (customer.createdAt) {
        status = new Date(customer.createdAt) < twoMonthsAgo ? 'Inactive' : 'New';
      }
      
      return {
        ...customer,
        id: customer._id.toString(),
        status: status,
      };
    });

    // --- 5. Calculate Total Pages ---
    const totalPages = Math.ceil(totalCustomers / limit);

    // --- 6. Return the Final Response ---
    return NextResponse.json({
      success: true,
      customers: customersWithStatus,
      pagination: {
        totalCustomers,
        totalPages,
        currentPage: page,
        limit,
      }
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
    
    if (!body.name || !body.phoneNumber) {
        return NextResponse.json({ success: false, message: 'Name and Phone Number are required.' }, { status: 400 });
    }

    const normalizedPhoneNumber = String(body.phoneNumber).replace(/\D/g, '');

    const existingCustomer = await Customer.findOne({ phoneNumber: normalizedPhoneNumber });
    if (existingCustomer) {
        return NextResponse.json({ success: false, message: 'A customer with this phone number already exists.', exists: true, customer: existingCustomer }, { status: 409 });
    }

    // New customers are active by default because of the schema setting `isActive: true`
    const newCustomer = await Customer.create({
        ...body,
        phoneNumber: normalizedPhoneNumber,
    });

    return NextResponse.json({ success: true, customer: newCustomer }, { status: 201 });
  } catch (error: any) {
    console.error("API Error creating customer:", error);
    return NextResponse.json({ success: false, message: "Failed to create customer" }, { status: 500 });
  }
}