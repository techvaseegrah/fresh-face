// /app/api/customer/[id]/toggle-membership/route.ts - FINAL CORRECTED VERSION

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/Appointment';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import Stylist from '@/models/Stylist';
import ServiceItem from '@/models/ServiceItem';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth'; // Assuming you use this
import { authOptions } from '@/lib/auth'; // Assuming you use this
import { hasPermission, PERMISSIONS } from '@/lib/permissions'; // Assuming you use this

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    // Example permission check - adjust as needed
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_UPDATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const { isMembership, membershipBarcode } = await req.json();
    const customerId = params.id;
    
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return NextResponse.json({ success: false, message: 'Invalid Customer ID' }, { status: 400 });
    }
    
    // Validation for granting membership
    if (isMembership === true && (!membershipBarcode || membershipBarcode.trim() === '')) {
      return NextResponse.json({ success: false, message: 'Membership barcode is required to grant membership.' }, { status: 400 });
    }

    // Check if barcode is already in use by another customer
    if (isMembership === true) {
      const existingCustomer = await Customer.findOne({ membershipBarcode: membershipBarcode.trim() });
      if (existingCustomer && existingCustomer._id.toString() !== customerId) {
        return NextResponse.json({ success: false, message: 'This barcode is already assigned to another customer.' }, { status: 409 });
      }
    }

    // --- STEP 1: Perform the membership update ---
    const updateData: any = { isMembership: isMembership };
    if (isMembership) {
      updateData.membershipBarcode = membershipBarcode.trim();
      updateData.membershipPurchaseDate = new Date();
    } else {
      updateData.$unset = { membershipBarcode: 1, membershipPurchaseDate: 1 };
    }
    
    const updatedCustomer = await Customer.findByIdAndUpdate(customerId, updateData, { new: true }).lean();
    if (!updatedCustomer) {
      return NextResponse.json({ success: false, message: 'Customer not found' }, { status: 404 });
    }
    
    // --- STEP 2: REBUILD THE COMPLETE OBJECT, INCLUDING APPOINTMENT HISTORY ---
    const [allRecentAppointments, loyaltyData] = await Promise.all([
      Appointment.find({ customerId: updatedCustomer._id }).sort({ appointmentDateTime: -1, date: -1 }).limit(20).lean(),
      LoyaltyTransaction.aggregate([
        { $match: { customerId: updatedCustomer._id } },
        { $group: { _id: null, totalPoints: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }] } } } }
      ])
    ]);

    // Calculate status
    let activityStatus: 'Active' | 'Inactive' | 'New' = 'New';
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    if (allRecentAppointments.length > 0) {
      const lastAppointmentDate = allRecentAppointments[0].appointmentDateTime || allRecentAppointments[0].date;
      if (lastAppointmentDate) {
        activityStatus = new Date(lastAppointmentDate) >= twoMonthsAgo ? 'Active' : 'Inactive';
      }
    } else if (updatedCustomer.createdAt) {
      activityStatus = new Date(updatedCustomer.createdAt) < twoMonthsAgo ? 'Inactive' : 'New';
    }
    const calculatedLoyaltyPoints = loyaltyData.length > 0 ? loyaltyData[0].totalPoints : 0;
    
    // Fetch and populate the paid appointment history
    const paidAppointmentIds = allRecentAppointments.filter(apt => apt.status === 'Paid').slice(0, 10).map(apt => apt._id);
    const populatedHistory = await Appointment.find({ _id: { $in: paidAppointmentIds } })
      .sort({ appointmentDateTime: -1, date: -1 })
      .populate({ path: 'stylistId', model: Stylist, select: 'name' })
      .populate({ path: 'serviceIds', model: ServiceItem, select: 'name price' })
      .lean();
    
    // --- STEP 3: Construct the final, complete object for the front-end ---
    const finalCustomerObject = {
        ...updatedCustomer,
        id: updatedCustomer._id.toString(),
        currentMembership: updatedCustomer.isMembership,
        status: activityStatus,
        loyaltyPoints: calculatedLoyaltyPoints,
        createdAt: updatedCustomer.createdAt || updatedCustomer._id.getTimestamp(),
        
        // --- THIS IS THE FIX FOR THE APPOINTMENT HISTORY ---
        appointmentHistory: populatedHistory.map(apt => {
          let finalDateTime;
          // 1. Check for the new field
          if (apt.appointmentDateTime && apt.appointmentDateTime instanceof Date) {
            finalDateTime = apt.appointmentDateTime;
          } 
          // 2. Fallback to old fields
          else if (apt.date && apt.time) {
            const dateStr = apt.date instanceof Date ? apt.date.toISOString().split('T')[0] : apt.date.toString();
            finalDateTime = new Date(`${dateStr}T${apt.time}:00.000Z`);
          } else {
            // 3. Ultimate fallback
            finalDateTime = apt.createdAt || new Date();
          }

          return {
            _id: (apt as any)._id.toString(),
            id: (apt as any)._id.toString(),
            date: finalDateTime.toISOString(), // Always use the valid object
            totalAmount: (apt as any).finalAmount || (apt as any).amount || 0,
            stylistName: (apt as any).stylistId?.name || 'N/A',
            services: Array.isArray((apt as any).serviceIds) ? (apt as any).serviceIds.map((s: any) => s.name) : [],
            status: (apt as any).status || 'N/A',
          };
        }),
        // --- END OF FIX ---
    };
    
    return NextResponse.json({
      success: true,
      message: `Membership status updated successfully.`,
      customer: finalCustomerObject 
    });
    
  } catch (error: any) {
    console.error('Error toggling membership:', error);
    // Use the error message if available, otherwise a generic one
    const errorMessage = error.message || 'Failed to update membership status';
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}