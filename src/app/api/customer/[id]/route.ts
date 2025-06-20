import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/Appointment';
import ServiceItem from '@/models/ServiceItem'; // Fixed: Use ServiceItem consistently
import Stylist from '@/models/Stylist';
import CustomerMembership from '@/models/customerMembership';
import MembershipPlan from '@/models/membershipPlan';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import mongoose from 'mongoose';

// --- TYPE DEFINITIONS ---
interface LeanCustomer { 
  _id: mongoose.Types.ObjectId; 
  createdAt?: Date; 
  name: string; 
  email?: string; 
  phoneNumber: string; 
  membershipStatus?: string;
  currentMembershipId?: mongoose.Types.ObjectId;
}

// ===================================================================================
//  GET: Handler for fetching full customer details for the side panel
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

    // Fetch all related customer data in parallel for performance
    const [activeMembership, allRecentAppointments, loyaltyData] = await Promise.all([
      // Query 1: Find the customer's active membership
      CustomerMembership.findOne({ 
        customerId: customer._id, 
        status: 'Active', 
        endDate: { $gte: new Date() } 
      }).populate({ 
        path: 'membershipPlanId', 
        model: MembershipPlan, 
        select: 'name discountPercentageServices' 
      }),

      // Query 2: Find recent appointments
      Appointment.find({ customerId: customer._id })
        .sort({ date: -1 })
        .limit(20)
        .lean(),

      // Query 3: Calculate loyalty points
      LoyaltyTransaction.aggregate([
        { $match: { customerId: customer._id } },
        {
          $group: {
            _id: null,
            totalPoints: {
              $sum: {
                $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }]
              }
            }
          }
        }
      ])
    ]);

    // Determine activity status
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

    // Get only paid appointments for history
    const paidAppointmentIds = allRecentAppointments
      .filter(apt => apt.status === 'Paid')
      .slice(0, 10)
      .map(apt => apt._id);

    // Populate the appointment history with ServiceItem references
    const populatedHistory = await Appointment.find({ 
      _id: { $in: paidAppointmentIds } 
    })
      .sort({ date: -1 })
      .populate({ 
        path: 'stylistId', 
        model: Stylist, 
        select: 'name' 
      })
      .populate({ 
        path: 'serviceIds', 
        model: ServiceItem, // Fixed: Use ServiceItem
        select: 'name price' 
      })
      .lean();

    // Construct the customer details object
    const customerDetails = {
      _id: customer._id.toString(),
      id: customer._id.toString(),
      name: customer.name,
      email: customer.email,
      phoneNumber: customer.phoneNumber,
      status: activityStatus,
      loyaltyPoints: calculatedLoyaltyPoints,
      
      // Membership information
      isMember: !!activeMembership,
      membershipStatus: customer.membershipStatus || 'None',
      membershipDetails: activeMembership ? {
        planName: (activeMembership.membershipPlanId as any)?.name || 'N/A',
        status: activeMembership.status,
        endDate: (activeMembership as any).endDate?.toISOString(),
        discountPercent: (activeMembership.membershipPlanId as any)?.discountPercentageServices || 0
      } : null,

      // Last visit information
      lastVisit: allRecentAppointments.length > 0 ? 
        (allRecentAppointments[0] as any).date.toISOString() : null,

      // Appointment history
      appointmentHistory: populatedHistory.map(apt => ({
        _id: (apt as any)._id.toString(),
        id: (apt as any)._id.toString(),
        date: (apt as any).date.toISOString(),
        totalAmount: (apt as any).amount || 0,
        stylistName: (apt as any).stylistId?.name || 'N/A',
        services: Array.isArray((apt as any).serviceIds) ? 
          (apt as any).serviceIds.map((s: any) => s.name) : [],
      }))
    };

    return NextResponse.json({ success: true, customer: customerDetails });

  } catch (error: any) {
    console.error(`API Error fetching details for customer ${params.id}:`, error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'An internal server error occurred.' 
    }, { status: 500 });
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