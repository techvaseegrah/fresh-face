// FILE: /app/api/customer/[id]/toggle-membership/route.ts - (DEFINITIVE FINAL VERSION)

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer, { ICustomer } from '@/models/customermodel';
import Appointment from '@/models/Appointment';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import Stylist from '@/models/Stylist';
import ServiceItem from '@/models/ServiceItem';
import mongoose from 'mongoose';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    const { isMembership, membershipBarcode } = await req.json();
    const customerId = params.id;
    
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return NextResponse.json({ success: false, message: 'Invalid Customer ID' }, { status: 400 });
    }
    
    const customer: ICustomer | null = await Customer.findById(customerId);
    if (!customer) {
      return NextResponse.json({ success: false, message: 'Customer not found' }, { status: 404 });
    }
    
    // --- STEP 1: Perform the membership update ---
    const updatedCustomer = await customer.toggleMembership(isMembership, membershipBarcode);
    
    // --- STEP 2: REBUILD THE COMPLETE OBJECT, INCLUDING APPOINTMENT HISTORY ---
    const [allRecentAppointments, loyaltyData] = await Promise.all([
      Appointment.find({ customerId: updatedCustomer._id }).sort({ date: -1 }).limit(20).lean(),
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
      activityStatus = new Date(allRecentAppointments[0].date) >= twoMonthsAgo ? 'Active' : 'Inactive';
    } else if (updatedCustomer.createdAt) {
      activityStatus = new Date(updatedCustomer.createdAt) < twoMonthsAgo ? 'Inactive' : 'New';
    }
    const calculatedLoyaltyPoints = loyaltyData.length > 0 ? loyaltyData[0].totalPoints : 0;
    
    // Fetch and populate the paid appointment history
    const paidAppointmentIds = allRecentAppointments.filter(apt => apt.status === 'Paid').slice(0, 10).map(apt => apt._id);
    const populatedHistory = await Appointment.find({ _id: { $in: paidAppointmentIds } })
      .sort({ date: -1 })
      .populate({ path: 'stylistId', model: Stylist, select: 'name' })
      .populate({ path: 'serviceIds', model: ServiceItem, select: 'name price' })
      .lean();
    
    // --- STEP 3: Construct the final, complete object for the front-end ---
    const finalCustomerObject = {
        ...updatedCustomer.toObject(),
        id: updatedCustomer.id.toString(),
        currentMembership: updatedCustomer.isMembership,
        status: activityStatus,
        loyaltyPoints: calculatedLoyaltyPoints,
        createdAt: updatedCustomer.createdAt || updatedCustomer.id.getTimestamp(),
        appointmentHistory: populatedHistory.map(apt => ({
          _id: (apt as any)._id.toString(),
          id: (apt as any)._id.toString(),
          date: (apt as any).date.toISOString(),
          totalAmount: (apt as any).amount || 0,
          stylistName: (apt as any).stylistId?.name || 'N/A',
          services: Array.isArray((apt as any).serviceIds) ? (apt as any).serviceIds.map((s: any) => s.name) : [],
        })),
    };
    
    return NextResponse.json({
      success: true,
      message: `Membership granted successfully`,
      customer: finalCustomerObject 
    });
    
  } catch (error) {
    console.error('Error toggling membership:', error);
    return NextResponse.json({ success: false, message: 'Failed to update membership status' }, { status: 500 });
  }
}