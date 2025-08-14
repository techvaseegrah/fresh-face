<<<<<<< HEAD
// /app/api/customer/[id]/toggle-membership/route.ts - FINAL TENANT-AWARE & SECURE VERSION

import { NextResponse, NextRequest } from 'next/server'; // IMPORT NextRequest
=======
// /app/api/customer/[id]/toggle-membership/route.ts - FINAL CORRECTED VERSION

import { NextResponse } from 'next/server';
>>>>>>> df642c83af3692f0da766243fb53ac637920f256
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
<<<<<<< HEAD
import { getTenantIdOrBail } from '@/lib/tenant'; // IMPORT the tenant helper

export async function POST(
  req: NextRequest, // USE NextRequest
=======

export async function POST(
  req: Request,
>>>>>>> df642c83af3692f0da766243fb53ac637920f256
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_UPDATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
<<<<<<< HEAD

    // --- 1. ADD TENANT CHECK AS A SECURITY GATE ---
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) {
      return tenantId; // Stop if tenant ID is missing
    }
=======
>>>>>>> df642c83af3692f0da766243fb53ac637920f256
    
    const { isMembership, membershipBarcode } = await req.json();
    const customerId = params.id;
    
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return NextResponse.json({ success: false, message: 'Invalid Customer ID' }, { status: 400 });
    }
    
    if (isMembership === true && (!membershipBarcode || membershipBarcode.trim() === '')) {
      return NextResponse.json({ success: false, message: 'Membership barcode is required to grant membership.' }, { status: 400 });
    }

    if (isMembership === true) {
<<<<<<< HEAD
      // --- 2. SCOPE DUPLICATE CHECK TO THE CURRENT TENANT ---
      const existingCustomer = await Customer.findOne({ 
        membershipBarcode: membershipBarcode.trim(),
        tenantId // Ensure the barcode check is only within this tenant
      });
      if (existingCustomer && existingCustomer._id.toString() !== customerId) {
        return NextResponse.json({ success: false, message: 'This barcode is already assigned to another customer in this tenant.' }, { status: 409 });
      }
    }
    
=======
      const existingCustomer = await Customer.findOne({ membershipBarcode: membershipBarcode.trim() });
      if (existingCustomer && existingCustomer._id.toString() !== customerId) {
        return NextResponse.json({ success: false, message: 'This barcode is already assigned to another customer.' }, { status: 409 });
      }
    }

    // --- THIS IS THE EXPLICIT FIX ---
    
    // 1. Prepare the data for the update operation.
>>>>>>> df642c83af3692f0da766243fb53ac637920f256
    const updateData: any = { isMembership: isMembership };
    if (isMembership) {
      updateData.membershipBarcode = membershipBarcode.trim();
      updateData.membershipPurchaseDate = new Date();
    } else {
<<<<<<< HEAD
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
=======
      // If removing membership, use $unset to completely remove the fields.
      updateData.$unset = { membershipBarcode: 1, membershipPurchaseDate: 1 };
    }
    
    // 2. Perform a direct update using findByIdAndUpdate.
    // The { new: true } option ensures it returns the document *after* the update.
    const updatedCustomer = await Customer.findByIdAndUpdate(customerId, updateData, { new: true }).lean();
    
    // --- END OF FIX ---

    if (!updatedCustomer) {
      return NextResponse.json({ success: false, message: 'Customer not found' }, { status: 404 });
    }
    
    // --- Re-fetch full details to send back a complete object for UI refresh ---
    const [allRecentAppointments, loyaltyData] = await Promise.all([
      Appointment.find({ customerId: updatedCustomer._id }).sort({ appointmentDateTime: -1, date: -1 }).limit(20).lean(),
      LoyaltyTransaction.aggregate([
        { $match: { customerId: updatedCustomer._id } },
>>>>>>> df642c83af3692f0da766243fb53ac637920f256
        { $group: { _id: null, totalPoints: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }] } } } }
      ])
    ]);

<<<<<<< HEAD
    // ... (Your business logic for activityStatus and loyalty points is fine) ...
    let activityStatus: 'Active' | 'Inactive' | 'New' = 'New';
    // ...
    const calculatedLoyaltyPoints = loyaltyData.length > 0 ? loyaltyData[0].totalPoints : 0;
    
    const paidAppointmentIds = allRecentAppointments.filter(apt => apt.status === 'Paid').slice(0, 10).map(apt => apt._id);
    const populatedHistory = await Appointment.find({ _id: { $in: paidAppointmentIds }, tenantId }) // Also scope this query
=======
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
    
    const paidAppointmentIds = allRecentAppointments.filter(apt => apt.status === 'Paid').slice(0, 10).map(apt => apt._id);
    const populatedHistory = await Appointment.find({ _id: { $in: paidAppointmentIds } })
>>>>>>> df642c83af3692f0da766243fb53ac637920f256
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
<<<<<<< HEAD
          // ... (Your mapping logic is fine)
=======
          let finalDateTime;
          if (apt.appointmentDateTime) { finalDateTime = apt.appointmentDateTime; } 
          else if (apt.date && apt.time) {
            const dateStr = apt.date instanceof Date ? apt.date.toISOString().split('T')[0] : apt.date.toString();
            finalDateTime = new Date(`${dateStr}T${apt.time}:00.000Z`);
          } else { finalDateTime = apt.createdAt || new Date(); }
          return {
            _id: (apt as any)._id.toString(), id: (apt as any)._id.toString(), date: finalDateTime.toISOString(), totalAmount: (apt as any).finalAmount || (apt as any).amount || 0,
            stylistName: (apt as any).stylistId?.name || 'N/A', services: Array.isArray((apt as any).serviceIds) ? (apt as any).serviceIds.map((s: any) => s.name) : [],
            status: (apt as any).status || 'N/A',
          };
>>>>>>> df642c83af3692f0da766243fb53ac637920f256
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