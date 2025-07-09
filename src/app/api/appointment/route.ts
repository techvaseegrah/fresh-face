// /app/api/appointment/route.ts - FINAL VERSION

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
import { createSearchHash, encrypt } from '@/lib/crypto';

// ===================================================================================
//  GET: Handler with Upgraded Search and Date Filter
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
    const dateFilter = searchParams.get('date');
    const skip = (page - 1) * limit;

    const matchStage: any = {};
    if (statusFilter && statusFilter !== 'All') {
      matchStage.status = statusFilter;
    }

    if (dateFilter === 'today') {
        const istOffset = 5.5 * 60 * 60 * 1000;
        const now = new Date();
        const istNow = new Date(now.getTime() + istOffset);
        const startOfTodayIST = new Date(istNow);
        startOfTodayIST.setUTCHours(0, 0, 0, 0);
        const endOfTodayIST = new Date(istNow);
        endOfTodayIST.setUTCHours(23, 59, 59, 999);
        const startOfTodayUTC = new Date(startOfTodayIST.getTime() - istOffset);
        const endOfTodayUTC = new Date(endOfTodayIST.getTime() - istOffset);
        matchStage.appointmentDateTime = { $gte: startOfTodayUTC, $lte: endOfTodayUTC };
    }

    if (searchQuery) {
        const searchStr = searchQuery.trim();
        const customerSearchOrConditions = [];
        customerSearchOrConditions.push({ searchableName: { $regex: searchStr, $options: 'i' } });
        
        const normalizedPhone = searchStr.replace(/\D/g, '');
        if (normalizedPhone) {
            customerSearchOrConditions.push({ phoneHash: createSearchHash(normalizedPhone) });
            customerSearchOrConditions.push({ last4PhoneNumber: { $regex: normalizedPhone } });
        }
        
        const matchingCustomers = await Customer.find({ $or: customerSearchOrConditions }).select('_id').lean();
        const customerIds = matchingCustomers.map(c => c._id);

        const stylistQuery = { name: { $regex: searchStr, $options: 'i' } };
        const matchingStylists = await Stylist.find(stylistQuery).select('_id').lean();
        const stylistIds = matchingStylists.map(s => s._id);

        const finalSearchOrConditions = [];
        if (customerIds.length > 0) finalSearchOrConditions.push({ customerId: { $in: customerIds } });
        if (stylistIds.length > 0) finalSearchOrConditions.push({ stylistId: { $in: stylistIds } });
        
        if (finalSearchOrConditions.length > 0) {
            matchStage.$or = finalSearchOrConditions;
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
        .sort({ appointmentDateTime: dateFilter === 'today' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Appointment.countDocuments(matchStage)
    ]);
    
    const totalPages = Math.ceil(totalAppointmentsResult / limit);
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
        return { ...apt.toObject(), id: apt._id.toString(), appointmentDateTime: finalDateTime.toISOString(), createdAt: (apt.createdAt || finalDateTime).toISOString() };
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
//  POST: Handler with the "Bulletproof" fix for creating customers
// ===================================================================================
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const { phoneNumber, customerName, email, gender, serviceIds, stylistId, date, time, notes, status, appointmentType = 'Online' } = body;

    if (!phoneNumber || !customerName || !serviceIds || !stylistId || !date || !time) {
      return NextResponse.json({ success: false, message: "Missing required fields." }, { status: 400 });
    }

    const normalizedPhone = String(phoneNumber).replace(/\D/g, '');
    const phoneHashToFind = createSearchHash(normalizedPhone);
    let customerDoc = await Customer.findOne({ phoneHash: phoneHashToFind });

    if (!customerDoc) {
      // Manually prepare all fields here, bypassing any faulty model hooks.
      const customerDataForCreation = {
        // --- Searchable Fields (Plain Text) ---
        searchableName: customerName,
        phoneHash: createSearchHash(normalizedPhone),
        last4PhoneNumber: normalizedPhone.length >= 4 ? normalizedPhone.slice(-4) : undefined,
        
        // --- Encrypted Fields ---
        name: encrypt(customerName),
        phoneNumber: encrypt(phoneNumber),
        email: email ? encrypt(email) : undefined,
        
        // --- Other Fields ---
        gender: gender || 'other'
      };

      customerDoc = await Customer.create(customerDataForCreation);
      if (!customerDoc) {
        throw new Error("Customer creation returned null unexpectedly.");
      }
    }

    const assumedUtcDate = new Date(`${date}T${time}:00.000Z`);
    const istOffsetInMinutes = 330;
    const assumedUtcTimestamp = assumedUtcDate.getTime();
    const correctUtcTimestamp = assumedUtcTimestamp - (istOffsetInMinutes * 60 * 1000);
    const appointmentDateUTC = new Date(correctUtcTimestamp);

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
        appointmentDateTime: appointmentDateUTC,
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