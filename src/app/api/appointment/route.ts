// /app/api/appointment/route.ts - FINAL COMPLETE AND BACKWARD-COMPATIBLE CODE

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

// NOTE: This native JS solution does not require external libraries like date-fns-tz

// ===================================================================================
//  GET Function (Fetches Appointments)
// ===================================================================================
export async function GET(req: Request) {
  try {
    await connectToDatabase();

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.APPOINTMENTS_READ)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const statusFilter = searchParams.get('status');
    const searchQuery = searchParams.get('search');
    const appointmentType = searchParams.get('type');
    const skip = (page - 1) * limit;

    const pipeline: mongoose.PipelineStage[] = [];

    // Lookups remain the same
    pipeline.push(
      { $lookup: { from: 'customers', localField: 'customerId', foreignField: '_id', as: 'customerInfo' } },
      { $lookup: { from: 'stylists', localField: 'stylistId', foreignField: '_id', as: 'stylistInfo' } },
      { $lookup: { from: 'users', localField: 'billingStaffId', foreignField: '_id', as: 'billingStaffInfo' } },
      { $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$stylistInfo", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$billingStaffInfo", preserveNullAndEmptyArrays: true } }
    );

    // Match conditions remain the same
    const matchStage: any = {};
    if (statusFilter && statusFilter !== 'All') matchStage.status = statusFilter;
    if (appointmentType && appointmentType !== 'All') matchStage.appointmentType = appointmentType;
    if (searchQuery) {
      const searchRegex = new RegExp(searchQuery, 'i');
      matchStage.$or = [
        { 'customerInfo.name': searchRegex },
        { 'stylistInfo.name': searchRegex },
        { 'customerInfo.phoneNumber': searchRegex }
      ];
    }
    if (Object.keys(matchStage).length > 0) pipeline.push({ $match: matchStage });

    const [results, totalAppointmentsResult] = await Promise.all([
      Appointment.aggregate(pipeline)
        .sort({ appointmentDateTime: -1, date: -1 }) // Sort by new field first, then old
        .skip(skip)
        .limit(limit),
      Appointment.aggregate([...pipeline, { $count: 'total' }])
    ]);

    const totalAppointments = totalAppointmentsResult.length > 0 ? totalAppointmentsResult[0].total : 0;
    const totalPages = Math.ceil(totalAppointments / limit);

    const appointments = await Appointment.populate(results, {
      path: 'serviceIds', model: ServiceItem, select: 'name price duration membershipRate'
    });

    // --- THIS IS THE FIX FOR BACKWARD COMPATIBILITY ---
    const formattedAppointments = appointments.map(apt => {
      let finalDateTime;

      // 1. Check if the new field exists and is valid (for new appointments)
      if (apt.appointmentDateTime && apt.appointmentDateTime instanceof Date) {
        finalDateTime = apt.appointmentDateTime;
      } 
      // 2. If not, construct it from the old fields (for old appointments)
      else if (apt.date && apt.time) {
        const dateStr = apt.date instanceof Date ? apt.date.toISOString().split('T')[0] : apt.date;
        // This assumes the server is running in UTC, which is standard.
        // It combines the old separate fields into a single Date object.
        finalDateTime = new Date(`${dateStr}T${apt.time}:00.000Z`);
      } else {
        // 3. As a last resort, use the creation date if everything else is missing
        finalDateTime = apt.createdAt || new Date(); 
      }

      return {
        ...apt,
        id: apt._id.toString(),
        customerId: apt.customerInfo,
        stylistId: apt.stylistInfo,
        billingStaff: apt.billingStaffInfo,
        // 4. ALWAYS send a valid `appointmentDateTime` and `createdAt` to the frontend
        appointmentDateTime: finalDateTime.toISOString(),
        createdAt: (apt.createdAt || finalDateTime).toISOString(),
      };
    });
    // --- END OF FIX ---

    return NextResponse.json({
      success: true,
      appointments: formattedAppointments,
      pagination: { totalAppointments, totalPages, currentPage: page }
    });

  } catch (error: any) {
    console.error("API Error fetching appointments:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch appointments." }, { status: 500 });
  }
}

// ===================================================================================
//  POST Function (Creates Appointments)
// ===================================================================================
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.APPOINTMENTS_CREATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { phoneNumber, customerName, email, serviceIds, stylistId, date, time, notes, status, gender, appointmentType = 'Online' } = body;

    if (!phoneNumber || !customerName || !serviceIds || serviceIds.length === 0 || !stylistId || !date || !time || !status) {
      return NextResponse.json({ success: false, message: "Missing required fields." }, { status: 400 });
    }
    
    // --- NATIVE JAVASCRIPT FIX FOR TIMEZONE CONVERSION ---
    // 1. Create a date object from the provided strings. The server will *incorrectly* assume this is UTC.
    const assumedUtcDate = new Date(`${date}T${time}:00.000Z`);
    // 2. Define the IST offset in minutes (5 hours * 60 mins + 30 mins).
    const istOffsetInMinutes = 330;
    // 3. Get the timestamp of the incorrectly assumed UTC date.
    const assumedUtcTimestamp = assumedUtcDate.getTime();
    // 4. Manually subtract the IST offset to get the *actual* correct UTC timestamp.
    const correctUtcTimestamp = assumedUtcTimestamp - (istOffsetInMinutes * 60 * 1000);
    // 5. Create the final, correct Date object from the adjusted timestamp.
    const appointmentDateUTC = new Date(correctUtcTimestamp);
    // --- END OF FIX ---

    let customerDoc = await Customer.findOne({ phoneNumber: phoneNumber.trim() });
    if (!customerDoc) {
      customerDoc = await Customer.create({ name: customerName, phoneNumber: phoneNumber.trim(), email, gender: gender || 'other' });
    }

    const services = await ServiceItem.find({ _id: { $in: serviceIds } }).select('duration price membershipRate');
    const estimatedDuration = services.reduce((total, service) => total + service.duration, 0);

    const appointmentData: any = {
      customerId: customerDoc._id,
      stylistId: stylistId,
      serviceIds: serviceIds,
      notes: notes,
      status: status,
      appointmentType: appointmentType,
      estimatedDuration: estimatedDuration,
      appointmentDateTime: appointmentDateUTC,
    };

    const tempAppointment = new Appointment(appointmentData);
    const { grandTotal, membershipSavings } = await tempAppointment.calculateTotal();
    appointmentData.amount = grandTotal + membershipSavings;
    appointmentData.finalAmount = grandTotal;
    appointmentData.membershipDiscount = membershipSavings;

    if (status === 'Checked-In') {
      appointmentData.checkInTime = new Date();
    }

    const createdAppointment = await Appointment.create(appointmentData);

    const populatedAppointment = await Appointment.findById(createdAppointment._id)
      .populate('customerId', 'name phoneNumber isMembership')
      .populate('stylistId', 'name')
      .populate('serviceIds', 'name price duration membershipRate');

    return NextResponse.json({ success: true, appointment: populatedAppointment }, { status: 201 });

  } catch (err: any) {
    console.error("API Error creating appointment:", err);
    return NextResponse.json({ success: false, message: err.message || "Failed to create appointment." }, { status: 500 });
  }
}