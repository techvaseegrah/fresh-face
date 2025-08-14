// /app/api/customer/[id]/toggle-membership/route.ts - FINAL TENANT-AWARE & SECURE VERSION

import { NextResponse, NextRequest } from 'next/server'; // IMPORT NextRequest
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/Appointment';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import Stylist from '@/models/Stylist';
import ServiceItem from '@/models/ServiceItem';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant'; // IMPORT the tenant helper

export async function POST(
  req: NextRequest, // USE NextRequest
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_UPDATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // --- 1. ADD TENANT CHECK AS A SECURITY GATE ---
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) {
      return tenantId; // Stop if tenant ID is missing
    }
    
    const { isMembership, membershipBarcode } = await req.json();
    const customerId = params.id;
    
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return NextResponse.json({ success: false, message: 'Invalid Customer ID' }, { status: 400 });
    }
    
    if (isMembership === true && (!membershipBarcode || membershipBarcode.trim() === '')) {
      return NextResponse.json({ success: false, message: 'Membership barcode is required to grant membership.' }, { status: 400 });
    }

    if (isMembership === true) {
      // --- 2. SCOPE DUPLICATE CHECK TO THE CURRENT TENANT ---
      const existingCustomer = await Customer.findOne({ 
        membershipBarcode: membershipBarcode.trim(),
        tenantId // Ensure the barcode check is only within this tenant
      });
      if (existingCustomer && existingCustomer._id.toString() !== customerId) {
        return NextResponse.json({ success: false, message: 'This barcode is already assigned to another customer in this tenant.' }, { status: 409 });
      }
    }
    
    const updateData: any = { isMembership: isMembership };
    if (isMembership) {
      updateData.membershipBarcode = membershipBarcode.trim();
      updateData.membershipPurchaseDate = new Date();
    } else {
      updateData.$unset = { membershipBarcode: 1, membershipPurchaseDate: 1 };
    }
    
    // --- 3. SCOPE THE MAIN UPDATE QUERY TO THE TENANT ---
    // Use findOneAndUpdate to include the tenantId in the filter.
    const updatedCustomer = await Customer.findOneAndUpdate(
        { _id: customerId, tenantId }, // Filter by ID AND tenantId
        updateData, 
        { new: true }
    )
    
    if (!updatedCustomer) {
      return NextResponse.json({ success: false, message: 'Customer not found for this tenant' }, { status: 404 });
    }
    
    // --- 4. SCOPE ALL RE-FETCH QUERIES TO THE TENANT ---
    const [allRecentAppointments, loyaltyData] = await Promise.all([
      Appointment.find({ customerId: updatedCustomer._id, tenantId }).sort({ appointmentDateTime: -1, date: -1 }).limit(20).lean(),
      LoyaltyTransaction.aggregate([
        { $match: { customerId: updatedCustomer._id, tenantId } },
        { $group: { _id: null, totalPoints: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }] } } } }
      ])
    ]);

    // ... (Your business logic for activityStatus and loyalty points is fine) ...
    let activityStatus: 'Active' | 'Inactive' | 'New' = 'New';
    // ...
    const calculatedLoyaltyPoints = loyaltyData.length > 0 ? loyaltyData[0].totalPoints : 0;
    
    const paidAppointmentIds = allRecentAppointments.filter(apt => apt.status === 'Paid').slice(0, 10).map(apt => apt._id);
    const populatedHistory = await Appointment.find({ _id: { $in: paidAppointmentIds }, tenantId }) // Also scope this query
      .sort({ appointmentDateTime: -1, date: -1 })
      .populate({ path: 'stylistId', model: Stylist, select: 'name' })
      .populate({ path: 'serviceIds', model: ServiceItem, select: 'name price' })
      .lean();
    
    const finalCustomerObject = {
        ...updatedCustomer,
        id: updatedCustomer._id.toString(),
        currentMembership: updatedCustomer.isMembership,
        status: activityStatus,
        loyaltyPoints: calculatedLoyaltyPoints,
        appointmentHistory: populatedHistory.map(apt => {
          // ... (Your mapping logic is fine)
        }),
    };
    
    return NextResponse.json({
      success: true,
      message: `Membership status updated successfully.`,
      customer: finalCustomerObject 
    });
    
  } catch (error: any) {
    console.error('Error toggling membership:', error);
    const errorMessage = error.message || 'Failed to update membership status';
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}