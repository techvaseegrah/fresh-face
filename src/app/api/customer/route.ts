// /api/customer/route.ts
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/Appointment';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
// --- FIXED: Make sure to import encrypt ---
import { createSearchHash, encrypt } from '@/lib/crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import mongoose from 'mongoose';

// [The GET handler from your file remains unchanged here]
export async function GET(req: Request) {
    // ... your existing GET logic ...
    // This part of the code is for fetching customers and is not related to the creation error.
    // I've omitted it for brevity but you should keep it as it was.
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
  
      const [customersFromDb, totalCustomers] = await Promise.all([
        Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Customer.countDocuments(query)
      ]);
      
      const customerIds = customersFromDb.map(c => c._id);
  
      const [latestAppointments, loyaltyPointsData] = await Promise.all([
        Appointment.aggregate([
          { $match: { customerId: { $in: customerIds } } },
          { $addFields: { unifiedDate: { $ifNull: ["$appointmentDateTime", "$date"] } } },
          { $sort: { unifiedDate: -1 } },
          {
            $lookup: {
              from: 'serviceitems',
              localField: 'serviceIds',
              foreignField: '_id',
              as: 'populatedServices'
            }
          },
          { 
            $group: { 
              _id: '$customerId', 
              lastAppointmentDate: { $first: '$unifiedDate' },
              lastServicesDetails: { $first: '$populatedServices' }
            } 
          }
        ]),
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
  
      const appointmentMap = new Map(latestAppointments.map((a: any) => [a._id.toString(), a]));
      const loyaltyMap = new Map(loyaltyPointsData.map((l: any) => [l._id.toString(), l.totalPoints]));
      
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  
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
          appointmentHistory: latestAppointmentDetails ? [{
              date: latestAppointmentDetails.lastAppointmentDate,
              services: latestAppointmentDetails.lastServicesDetails?.map((s: any) => s.name) || [],
              _id: '', id: '', status: '', totalAmount: 0, stylistName: ''
          }] : [],
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
//  POST: Handler for creating a customer (CORRECTED VERSION)
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

    // --- 1. PREPARE ALL DATA (Encryption & Hash Generation) ---
    const normalizedPhoneNumber = String(body.phoneNumber).replace(/\D/g, '');
    const phoneHash = createSearchHash(normalizedPhoneNumber);
    const searchableName = body.name.toLowerCase(); // <-- REQUIRED
    const last4PhoneNumber = normalizedPhoneNumber.slice(-4); // <-- REQUIRED

    // --- 2. CHECK FOR DUPLICATES (Correct) ---
    const existingCustomer = await Customer.findOne({ phoneHash });
    if (existingCustomer) {
        return NextResponse.json({ 
            success: false, 
            message: 'A customer with this phone number already exists.', 
            exists: true, 
            customer: existingCustomer // The post('findOne') hook will decrypt this
        }, { status: 409 });
    }

    // --- 3. CREATE CUSTOMER WITH PREPARED DATA ---
    const newCustomerData = {
      // Encrypt sensitive fields
      name: encrypt(body.name),
      phoneNumber: encrypt(normalizedPhoneNumber),
      email: body.email ? encrypt(body.email) : undefined,

      // Add the generated required fields
      phoneHash,
      searchableName,
      last4PhoneNumber,
      
      // Add other optional fields from the form
      dob: body.dob || undefined,
      gender: body.gender || undefined,
      survey: body.survey || undefined,
    };

    const newCustomer = await Customer.create(newCustomerData);

    // The post('save') hook will decrypt the `newCustomer` object before it's sent
    return NextResponse.json({ success: true, data: newCustomer }, { status: 201 });

  } catch (error: any) {
    console.error("API Error creating customer:", error);
    // Provide more specific error messages if possible
    if (error.name === 'ValidationError') {
      return NextResponse.json({ success: false, message: `Validation Error: ${error.message}` }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: "Failed to create customer" }, { status: 500 });
  }
}