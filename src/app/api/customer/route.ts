// /api/customer/route.ts - COMPLETE VERSION WITH DEBUGGING

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/Appointment';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import { createSearchHash } from '@/lib/crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import mongoose from 'mongoose';

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
  isMembership?: boolean;
}

interface AggregatedAppointment {
  _id: mongoose.Types.ObjectId; // customerId
  lastAppointmentDate: Date;
}

// ===================================================================================
//  GET: Handler for fetching customers with full details
// ===================================================================================
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_READ)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const searchQuery = searchParams.get('search');
    const skip = (page - 1) * limit;

    let query: any = { isActive: true };

    if (searchQuery) {
      const normalizedPhone = String(searchQuery).replace(/\D/g, '');
      if (normalizedPhone) {
        query.phoneHash = createSearchHash(normalizedPhone);
      } else {
        // If search is present but invalid, return no results.
        query._id = new mongoose.Types.ObjectId();
      }
    }

    // Fetch customers and total count concurrently
    const [customersFromDb, totalCustomers] = await Promise.all([
      Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Customer.countDocuments(query)
    ]);
    
    const customerIds = customersFromDb.map(c => c._id);

    // Fetch related data (appointments and loyalty) concurrently
    const [latestAppointments, loyaltyPointsData] = await Promise.all([
      // --- FINAL FIX: This aggregation now correctly fetches service names ---
      Appointment.aggregate([
        // Stage 1: Find all appointments for the customers on the current page
        { $match: { customerId: { $in: customerIds } } },
        // Stage 2: Standardize the date field for reliable sorting
        { $addFields: { unifiedDate: { $ifNull: ["$appointmentDateTime", "$date"] } } },
        // Stage 3: Sort all appointments by date to find the most recent ones
        { $sort: { unifiedDate: -1 } },
        // Stage 4: JOIN with the 'serviceitems' collection to get service details
        {
          $lookup: {
            from: 'serviceitems',      // The name of the services collection in MongoDB
            localField: 'serviceIds',  // The field from the Appointment document
            foreignField: '_id',       // The field from the 'serviceitems' collection
            as: 'populatedServices'    // The name of the new array to add to each appointment
          }
        },
        // Stage 5: Group by customer to get only their single latest appointment
        { 
          $group: { 
            _id: '$customerId', 
            lastAppointmentDate: { $first: '$unifiedDate' },
            // Get the array of populated service documents from that latest appointment
            lastServicesDetails: { $first: '$populatedServices' }
          } 
        }
      ]),
      // Loyalty transaction aggregation remains the same
      LoyaltyTransaction.aggregate([
        { $match: { customerId: { $in: customerIds } } },
        { 
          $group: { 
            _id: '$customerId', 
            totalPoints: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }] } }
          }
        }
      ])
    ]);

    // Create maps for quick data lookup
    const appointmentMap = new Map(latestAppointments.map(a => [a._id.toString(), a]));
    const loyaltyMap = new Map(loyaltyPointsData.map(l => [l._id.toString(), l.totalPoints]));
    
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    // Combine all data into the final customer objects for the frontend
    const customersWithDetails = customersFromDb.map((customer: any) => {
      const latestAppointmentDetails = appointmentMap.get(customer._id.toString());
      const loyaltyPoints = loyaltyMap.get(customer._id.toString()) || 0;
      let status: 'Active' | 'Inactive' | 'New';

      if (latestAppointmentDetails) {
        status = new Date(latestAppointmentDetails.lastAppointmentDate) >= twoMonthsAgo ? 'Active' : 'Inactive';
      } else {
        status = (customer.createdAt && new Date(customer.createdAt) < twoMonthsAgo) ? 'Inactive' : 'New';
      }
      
      const finalCustomerObject = {
        ...customer,
        id: customer._id.toString(),
        status: status,
        loyaltyPoints: loyaltyPoints,
        // --- FINAL FIX: Construct the appointmentHistory object correctly ---
        appointmentHistory: latestAppointmentDetails ? [{
            date: latestAppointmentDetails.lastAppointmentDate,
            // Map over the populated service objects and extract just the 'name'
            services: latestAppointmentDetails.lastServicesDetails?.map((s: any) => s.name) || [],
            // Provide default values to match the frontend type, ensuring no errors
            _id: '', id: '', status: '', totalAmount: 0, stylistName: ''
        }] : [], // Send an empty array if no history exists
      };
      
      return finalCustomerObject;
    });

    const totalPages = Math.ceil(totalCustomers / limit);

    return NextResponse.json({
      success: true,
      customers: customersWithDetails,
      pagination: { totalCustomers, totalPages, currentPage: page, limit }
    });

  } catch (error: any) {
    console.error("API Error fetching customers:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch customers" }, { status: 500 });
  }
}



// ===================================================================================
//  POST: Handler for creating a customer
// ===================================================================================

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_CREATE)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    await connectToDatabase();
    const body = await req.json();
    
    if (!body.name || !body.phoneNumber) {
        return NextResponse.json({ success: false, message: 'Name and Phone Number are required.' }, { status: 400 });
    }

    const normalizedPhoneNumber = String(body.phoneNumber).replace(/\D/g, '');
    const phoneHash = createSearchHash(normalizedPhoneNumber);

    const existingCustomer = await Customer.findOne({ phoneHash });
    
    if (existingCustomer) {
        return NextResponse.json({ 
            success: false, 
            message: 'A customer with this phone number already exists.', 
            exists: true, 
            customer: existingCustomer
        }, { status: 409 });
    }

    const newCustomer = await Customer.create({
        ...body,
        phoneHash,
        email: body.email || undefined,
        dob: body.dob || undefined,
        survey: body.survey || undefined,
    });

    return NextResponse.json({ success: true, customer: newCustomer }, { status: 201 });
  } catch (error: any) {
    console.error("API Error creating customer:", error);
    return NextResponse.json({ success: false, message: "Failed to create customer" }, { status: 500 });
  }
}