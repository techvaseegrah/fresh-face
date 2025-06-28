// /app/api/appointment/route.ts - FINAL CORRECTED VERSION

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import Customer from '@/models/customermodel';
import Stylist from '@/models/Stylist';
import ServiceItem from '@/models/ServiceItem';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { createSearchHash } from '@/lib/crypto'; // Assuming you have this helper

// ===================================================================================
//  GET: Handler for fetching appointments (with backward compatibility)
// ===================================================================================
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.APPOINTMENTS_READ)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const statusFilter = searchParams.get('status');
    const searchQuery = searchParams.get('search');
    const skip = (page - 1) * limit;

    const matchStage: any = {};
    if (statusFilter && statusFilter !== 'All') {
      matchStage.status = statusFilter;
    }

    if (searchQuery) {
        const searchConditions = [];
        const normalizedPhone = String(searchQuery).replace(/\D/g, '');
        if (normalizedPhone) {
            const phoneHash = createSearchHash(normalizedPhone);
            const matchingCustomers = await Customer.find({ phoneHash }).select('_id').lean();
            if (matchingCustomers.length > 0) {
                searchConditions.push({ customerId: { $in: matchingCustomers.map(c => c._id) } });
            }
        }
        const stylistQuery = { name: { $regex: searchQuery, $options: 'i' } };
        const matchingStylists = await Stylist.find(stylistQuery).select('_id').lean();
        if (matchingStylists.length > 0) {
            searchConditions.push({ stylistId: { $in: matchingStylists.map(s => s._id) } });
        }
        if (searchConditions.length > 0) {
            matchStage.$or = searchConditions;
        } else {
            matchStage._id = new mongoose.Types.ObjectId();
        }
    }
    
    const [appointments, totalAppointmentsResult] = await Promise.all([
      Appointment.find(matchStage)
        .populate({ path: 'customerId' })
        .populate({ path: 'stylistId', select: 'name' })
        .populate({ path: 'serviceIds', select: 'name price duration membershipRate' })
        .populate({ path: 'billingStaffId', select: 'name' })
        .sort({ appointmentDateTime: -1, date: -1 }) // Sort by new field first for consistency
        .skip(skip)
        .limit(limit),
      Appointment.countDocuments(matchStage)
    ]);
    
    const totalPages = Math.ceil(totalAppointmentsResult / limit);

    // This mapping ensures backward compatibility for old data
    const formattedAppointments = appointments.map(apt => {
        let finalDateTime;
        if (apt.appointmentDateTime && apt.appointmentDateTime instanceof Date) {
            finalDateTime = apt.appointmentDateTime;
        } else if (apt.date && apt.time) {
            const dateStr = apt.date instanceof Date ? apt.date.toISOString().split('T')[0] : apt.date;
            finalDateTime = new Date(`${dateStr}T${apt.time}:00.000Z`);
        } else {
            finalDateTime = apt.createdAt || new Date();
        }

        return {
            ...apt.toObject(),
            id: apt._id.toString(),
            appointmentDateTime: finalDateTime.toISOString(),
            createdAt: (apt.createdAt || finalDateTime).toISOString(),
        };
    });

    return NextResponse.json({
      success: true,
      appointments: formattedAppointments,
      pagination: { totalAppointments: totalAppointmentsResult, totalPages, currentPage: page }
    });

  } catch (error: any) {
    console.error("API Error fetching appointments:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch appointments." }, { status: 500 });
  }
}

// ===================================================================================
//  POST: Handler for creating appointments (CORRECTED)
// ===================================================================================
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json();

    // Destructure all expected fields from the form
    const { phoneNumber, customerName, email, gender, serviceIds, stylistId, date, time, notes, status, appointmentType = 'Online' } = body;

    if (!phoneNumber || !customerName || !serviceIds || !stylistId || !date || !time) {
      return NextResponse.json({ success: false, message: "Missing required fields." }, { status: 400 });
    }

    const normalizedPhone = String(phoneNumber).replace(/\D/g, '');
    const phoneHash = createSearchHash(normalizedPhone);
    let customerDoc = await Customer.findOne({ phoneHash });

    if (!customerDoc) {
      customerDoc = await Customer.create({
        phoneHash,
        name: customerName,
        phoneNumber, // Encrypted by pre-save hook
        email,       // Encrypted by pre-save hook
        gender: gender || 'other'
      });
    }

    // --- THIS IS THE FIX ---
    // Create the correct UTC timestamp from the IST time provided by the form
    const assumedUtcDate = new Date(`${date}T${time}:00.000Z`);
    const istOffsetInMinutes = 330;
    const assumedUtcTimestamp = assumedUtcDate.getTime();
    const correctUtcTimestamp = assumedUtcTimestamp - (istOffsetInMinutes * 60 * 1000);
    const appointmentDateUTC = new Date(correctUtcTimestamp);
    // --- END OF FIX ---

    const services = await ServiceItem.find({ _id: { $in: serviceIds } }).select('duration price membershipRate');
    const estimatedDuration = services.reduce((total, service) => total + service.duration, 0);

    const appointmentData: any = {
        customerId: customerDoc._id,
        stylistId,
        serviceIds,
        notes,
        status,
        appointmentType,
        estimatedDuration,
        appointmentDateTime: appointmentDateUTC, // Use the new, correct field
    };

    const newAppointment = new Appointment(appointmentData);
    const { grandTotal, membershipSavings } = await newAppointment.calculateTotal();
    appointmentData.finalAmount = grandTotal;
    appointmentData.amount = grandTotal + membershipSavings;
    appointmentData.membershipDiscount = membershipSavings;

    if (status === 'Checked-In') {
        appointmentData.checkInTime = new Date();
    }

    const createdAppointment = await Appointment.create(appointmentData);
    
    const populatedAppointment = await Appointment.findById(createdAppointment._id)
      .populate({ path: 'customerId' })
      .populate({ path: 'stylistId', select: 'name' })
      .populate({ path: 'serviceIds', select: 'name price duration membershipRate' });

    return NextResponse.json({ success: true, appointment: populatedAppointment }, { status: 201 });

  } catch (err: any) {
    console.error("API Error creating appointment:", err);
    return NextResponse.json({ success: false, message: err.message || "Failed to create appointment." }, { status: 500 });
  }
}