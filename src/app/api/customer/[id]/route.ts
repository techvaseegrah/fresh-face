// /app/api/customer/[id]/route.ts - COMPLETE VERSION WITH DEBUGGING

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/Appointment';
import ServiceItem from '@/models/ServiceItem';
import Staff from '@/models/staff';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { encrypt, decrypt } from '@/lib/crypto';
import { getTenantIdOrBail } from '@/lib/tenant';
import {createBlindIndex, generateNgrams} from '@/lib/search-indexing';

interface LeanCustomer {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  name: string;
  email?: string;
  phoneNumber: string;
  gender?: string;
  isActive: boolean;
  isMembership: boolean;
  membershipBarcode?: string;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const customerId = params.id;

  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_READ)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = getTenantIdOrBail(req as any);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    return NextResponse.json({ success: false, message: 'Invalid Customer ID.' }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const customer = await Customer.findOne({ _id: customerId, tenantId }).lean<LeanCustomer>();
    if (!customer) {
      return NextResponse.json({ success: false, message: 'Customer not found for this tenant.' }, { status: 404 });
    }

    const [allRecentAppointments, loyaltyData] = await Promise.all([
      // =========================================================================
      // === THE CHANGE IS HERE ===
      // We now fetch only appointments with the status 'Paid'.
      // =========================================================================
      Appointment.find({
        customerId: customer._id,
        tenantId,
        status: 'Paid' // Filter for paid appointments only
      })
        .sort({ appointmentDateTime: -1, date: -1 }) // Get the most recent paid appointments
        .limit(20)
        .lean(),
      // =========================================================================
      LoyaltyTransaction.aggregate([
        { $match: { customerId: customer._id, tenantId: new mongoose.Types.ObjectId(tenantId) } },
        { $group: { _id: null, totalPoints: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }] } } } }
      ])
    ]);

    // The rest of the logic remains the same, but now operates on the filtered 'Paid' appointments.
    let activityStatus: 'Active' | 'Inactive' | 'New' = 'New';
    let lastVisit: string | null = null;
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    if (allRecentAppointments.length > 0) {
      const lastAppointmentDate = (allRecentAppointments[0] as any).appointmentDateTime || (allRecentAppointments[0] as any).date;
      if (lastAppointmentDate) {
        activityStatus = new Date(lastAppointmentDate) >= twoMonthsAgo ? 'Active' : 'Inactive';
        lastVisit = new Date(lastAppointmentDate).toISOString();
      }
    } else if (customer.createdAt) {
      activityStatus = new Date(customer.createdAt) < twoMonthsAgo ? 'Inactive' : 'New';
    }

    const calculatedLoyaltyPoints = loyaltyData.length > 0 ? loyaltyData[0].totalPoints : 0;
    const appointmentIds = allRecentAppointments.map(apt => (apt as any)._id);

    const populatedHistory = await Appointment.find({ _id: { $in: appointmentIds }, tenantId })
      .sort({ appointmentDateTime: -1, date: -1 })
      .populate({ path: 'stylistId', model: Staff, select: 'name' })
      .populate({ path: 'serviceIds', model: ServiceItem, select: 'name price' })
      .lean();

    // ... The rest of the function (decryption block and response object) is unchanged ...
    // ... It will now correctly use the filtered data ...
    let decryptedName = 'Error: Corrupted Data';
    let decryptedEmail: string | undefined = undefined;
    let decryptedPhoneNumber = 'Error: Corrupted Data';

    try {
        decryptedName = decrypt(customer.name);
    } catch (e) {
        console.error(`🔴 DECRYPTION FAILED for field 'name' on customer ID ${customer._id}. Raw value: "${customer.name}"`);
    }
    if (customer.email) {
        try {
            decryptedEmail = decrypt(customer.email);
        } catch (e) {
            console.error(`🔴 DECRYPTION FAILED for field 'email' on customer ID ${customer._id}. Raw value: "${customer.email}"`);
        }
    }
    try {
        decryptedPhoneNumber = decrypt(customer.phoneNumber);
    } catch (e) {
        console.error(`🔴 DECRYPTION FAILED for field 'phoneNumber' on customer ID ${customer._id}. Raw value: "${customer.phoneNumber}"`);
    }

    const customerDetails = {
      id: customer._id.toString(),
      _id: customer._id.toString(),
      name: decryptedName,
      email: decryptedEmail,
      phoneNumber: decryptedPhoneNumber,
      gender: customer.gender,
      isMember: customer.isMembership,
      membershipBarcode: customer.membershipBarcode,
      membershipDetails: customer.isMembership ? { planName: 'Member', status: 'Active' } : null,
      status: activityStatus,
      lastVisit: lastVisit,
      loyaltyPoints: calculatedLoyaltyPoints,
      currentMembership: customer.isMembership,
      createdAt: customer.createdAt || customer._id.getTimestamp(),
      appointmentHistory: populatedHistory.map(apt => {
        let finalDateTime;
        if ((apt as any).appointmentDateTime && (apt as any).appointmentDateTime instanceof Date) {
          finalDateTime = (apt as any).appointmentDateTime;
        } else if ((apt as any).date && (apt as any).time) {
          const dateStr = (apt as any).date instanceof Date ? (apt as any).date.toISOString().split('T')[0] : (apt as any).date.toString();
          finalDateTime = new Date(`${dateStr}T${(apt as any).time}:00.000Z`);
        } else {
          finalDateTime = (apt as any).createdAt || new Date();
        }
        return {
          _id: (apt as any)._id.toString(),
          id: (apt as any)._id.toString(),
          date: finalDateTime.toISOString(),
          totalAmount: (apt as any).finalAmount || (apt as any).amount || 0,
          stylistName: (apt as any).stylistId?.name || 'N/A',
          services: Array.isArray((apt as any).serviceIds) ? (apt as any).serviceIds.map((s: any) => s.name) : [],
          status: (apt as any).status || 'N/A',
        };
      })
    };

    return NextResponse.json({ success: true, customer: customerDetails });

  } catch (error: any) {
    console.error(`API Error fetching details for customer ${params.id}:`, error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}

// The PUT and DELETE functions are unchanged.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const customerId = params.id;
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return NextResponse.json({ success: false, message: 'Invalid Customer ID.' }, { status: 400 });
    }
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_UPDATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = getTenantIdOrBail(req as any);
    if (tenantId instanceof NextResponse) {
      return tenantId;
    }
    try {
      await connectToDatabase();
      const body = await req.json();
      const updateData: any = {};

      // === GUARDRAIL FOR PHONE NUMBER ===
      // Only encrypt if the input is a short, unencrypted number.
      // An encrypted hash is much longer (> 32 characters).
      if (body.phoneNumber && String(body.phoneNumber).length < 20) { 
        const normalizedPhoneNumber = String(body.phoneNumber).replace(/\D/g, '');
        updateData.phoneNumber = encrypt(normalizedPhoneNumber);
        updateData.phoneHash = createBlindIndex(normalizedPhoneNumber);
        updateData.last4PhoneNumber = normalizedPhoneNumber.slice(-4);
        updateData.phoneSearchIndex = generateNgrams(normalizedPhoneNumber).map(ngram => createBlindIndex(ngram));
      }

      // === GUARDRAIL FOR NAME ===
      // Only encrypt if the name is not already a long hash.
      if (body.name && String(body.name).length < 32) {
        updateData.name = encrypt(body.name);
        updateData.searchableName = body.name.toLowerCase().trim();
      }

      // === GUARDRAIL FOR EMAIL ===
      if (typeof body.email !== 'undefined') {
        // Only encrypt if email is provided and is not already a long hash.
        if (body.email && String(body.email).length < 64) {
             updateData.email = encrypt(body.email);
        } else if (!body.email) {
            updateData.email = undefined;
        }
      }

      if (body.dob) updateData.dob = body.dob;
      if (body.gender) updateData.gender = body.gender;
      
      if (Object.keys(updateData).length === 0) {
        // This is important: If the PUT request contained only already-encrypted data,
        // we do nothing and return a success message to prevent errors.
        console.log(`Skipping update for customer ${customerId}, no new data to process.`);
        return NextResponse.json({ success: true, message: 'No new data to update.' });
      }

      const updatedCustomer = await Customer.findOneAndUpdate(
        { _id: customerId, tenantId },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!updatedCustomer) {
        return NextResponse.json({ success: false, message: 'Customer not found for this tenant.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, customer: updatedCustomer });
    } catch (error: any) {
      console.error(`API Error updating customer ${customerId}:`, error);
      // ... your existing error handling ...
      return NextResponse.json({ success: false, message: 'Failed to update customer.' }, { status: 500 });
    }
}
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const customerId = params.id;
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return NextResponse.json({ success: false, message: 'Invalid Customer ID.' }, { status: 400 });
    }
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_DELETE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = getTenantIdOrBail(req as any);
    if (tenantId instanceof NextResponse) {
      return tenantId;
    }
    try {
      await connectToDatabase();
      const deactivatedCustomer = await Customer.findOneAndUpdate(
        { _id: customerId, tenantId },
        { isActive: false },
        { new: true }
      );
      if (!deactivatedCustomer) {
        return NextResponse.json({ success: false, message: 'Customer not found for this tenant.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'Customer has been deactivated successfully.' });
    } catch (error: any) {
      console.error(`API Error deactivating customer ${customerId}:`, error);
      return NextResponse.json({ success: false, message: error.message || 'Failed to deactivate customer.' }, { status: 500 });
    }
}