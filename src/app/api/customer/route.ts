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
        query._id = new mongoose.Types.ObjectId();
      }
    }

    // Fetch full Mongoose documents to allow post-find hooks (decryption) to run.
    const [customersFromDb, totalCustomers] = await Promise.all([
      Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Customer.countDocuments(query)
    ]);
    
    // =================================================================
    // DEBUGGING STEP 1: See the raw data from the database
    console.log("--- RAW DATA FROM DB (customersFromDb) ---");
    customersFromDb.forEach(c => {
      console.log(`Customer: ${c.name}, isMembership: ${c.isMembership}`);
    });
    // =================================================================
    
    const customerIds = customersFromDb.map(c => c._id);

    const [latestAppointments, loyaltyPointsData] = await Promise.all([
      Appointment.aggregate([
        { $match: { customerId: { $in: customerIds } } },
        { $addFields: { unifiedDate: { $ifNull: ["$appointmentDateTime", "$date"] } } },
        { $sort: { unifiedDate: -1 } },
        { $group: { _id: '$customerId', lastAppointmentDate: { $first: '$unifiedDate' } } }
      ]),
      LoyaltyTransaction.aggregate([
        { $match: { customerId: { $in: customerIds } } },
        { $group: { 
            _id: '$customerId', 
            totalPoints: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }] } }
          }
        }
      ])
    ]);

    const appointmentMap = new Map(latestAppointments.map(a => [a._id.toString(), a.lastAppointmentDate]));
    const loyaltyMap = new Map(loyaltyPointsData.map(l => [l._id.toString(), l.totalPoints]));
    
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const customersWithDetails = customersFromDb.map((customer: any) => {
      const lastAppointmentDate = appointmentMap.get(customer._id.toString());
      const loyaltyPoints = loyaltyMap.get(customer._id.toString()) || 0;
      let status: 'Active' | 'Inactive' | 'New';

      if (lastAppointmentDate) {
        status = new Date(lastAppointmentDate) >= twoMonthsAgo ? 'Active' : 'Inactive';
      } else {
        status = (customer.createdAt && new Date(customer.createdAt) < twoMonthsAgo) ? 'Inactive' : 'New';
      }
      
      const finalCustomerObject = {
        ...customer.toObject(),
        id: customer._id.toString(),
        status: status,
        loyaltyPoints: loyaltyPoints,
        isMembership: customer.isMembership,
      };

      // =================================================================
      // DEBUGGING STEP 2: See the final object before it's sent
      console.log("--- FINAL OBJECT FOR FRONTEND ---");
      console.log(`Customer: ${finalCustomerObject.name}, isMembership: ${finalCustomerObject.isMembership}`);
      // =================================================================
      
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

    const newCustomer = await Customer.create({...body, phoneHash});

    return NextResponse.json({ success: true, customer: newCustomer }, { status: 201 });
  } catch (error: any) {
    console.error("API Error creating customer:", error);
    return NextResponse.json({ success: false, message: "Failed to create customer" }, { status: 500 });
  }
}