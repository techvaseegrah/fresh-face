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

    // MODIFIED: Destructure `serviceAssignments` instead of `serviceIds` and `stylistId`
    const { 
      // customerId, // We will get this from the found/created customer document
      customerName, 
      phoneNumber, 
      email, 
      gender, 
      date, 
      time, 
      notes, 
      status, 
      appointmentType = 'Online',
      serviceAssignments // <-- The new, important array
    } = body;

    // MODIFIED: Update validation to check for the new `serviceAssignments` array
    if (!phoneNumber || !customerName || !date || !time || !serviceAssignments || !Array.isArray(serviceAssignments) || serviceAssignments.length === 0) {
      return NextResponse.json({ success: false, message: "Missing required fields or services." }, { status: 400 });
    }

    // --- Find or Create Customer (This logic remains the same) ---
    const normalizedPhone = String(phoneNumber).replace(/\D/g, '');
    const phoneHashToFind = createSearchHash(normalizedPhone);
    let customerDoc = await Customer.findOne({ phoneHash: phoneHashToFind });

    if (!customerDoc) {
      const customerDataForCreation = {
        searchableName: customerName,
        phoneHash: createSearchHash(normalizedPhone),
        last4PhoneNumber: normalizedPhone.length >= 4 ? normalizedPhone.slice(-4) : undefined,
        name: encrypt(customerName),
        phoneNumber: encrypt(phoneNumber),
        email: email ? encrypt(email) : undefined,
        gender: gender || 'other'
      };
      customerDoc = await Customer.create(customerDataForCreation);
      if (!customerDoc) {
        throw new Error("Customer creation failed unexpectedly.");
      }
    }
    // Now `customerDoc` holds the definitive customer document, either found or newly created.

    // --- Date/Time Handling (This logic remains the same) ---
    // This correctly converts the incoming local time from the form into a UTC timestamp for DB storage.
    const assumedUtcDate = new Date(`${date}T${time}:00.000Z`);
    const istOffsetInMinutes = 330;
    const assumedUtcTimestamp = assumedUtcDate.getTime();
    const correctUtcTimestamp = assumedUtcTimestamp - (istOffsetInMinutes * 60 * 1000);
    const appointmentDateUTC = new Date(correctUtcTimestamp);

    // ===============================================================================
    //  CORE LOGIC CHANGE: Handle Multiple Service Assignments
    // ===============================================================================

    // NEW: Generate a single ID to group all these individual appointments together.
    // This is like a "receipt number" for the entire booking.
    const groupBookingId = new mongoose.Types.ObjectId();

    // NEW: Map over the `serviceAssignments` array to create an array of appointment documents.
    const newAppointmentsDataPromises = serviceAssignments.map(async (assignment: any) => {
      // For each assignment, fetch its full service details.
      const service = await ServiceItem.findById(assignment.serviceId).select('duration price membershipRate').lean();
      if (!service) {
        throw new Error(`Service with ID ${assignment.serviceId} not found.`);
      }

      // Create a temporary Appointment instance to use the `calculateTotal` method.
      // Note: We're passing only ONE serviceId here to calculate per-service costs.
      const tempAppointmentForCalc = new Appointment({
        customerId: customerDoc._id,
        serviceIds: [assignment.serviceId] // IMPORTANT: Calculate cost for this single service
      });
      const { grandTotal, membershipSavings } = await tempAppointmentForCalc.calculateTotal();

      return {
        customerId: customerDoc._id,
        stylistId: assignment.stylistId,
        serviceIds: [assignment.serviceId], // The appointment holds the single service it's for.
        guestName: assignment.guestName,   // Optional name for who is receiving the service.
        notes,
        status,
        appointmentType,
        estimatedDuration: service.duration,
        appointmentDateTime: appointmentDateUTC,
        groupBookingId: groupBookingId, // Assign the same group ID to all.

        // Per-service financial details
        finalAmount: grandTotal,
        amount: grandTotal + membershipSavings,
        membershipDiscount: membershipSavings,

        // Set check-in time if applicable
        checkInTime: status === 'Checked-In' ? new Date() : undefined,
      };
    });
    
    // NEW: Wait for all the individual appointment data objects to be prepared.
    const newAppointmentsData = await Promise.all(newAppointmentsDataPromises);
    
    // NEW: Use `insertMany` to create all appointment documents in a single, efficient database operation.
    const createdAppointments = await Appointment.insertMany(newAppointmentsData);

    if (!createdAppointments || createdAppointments.length === 0) {
      throw new Error("Failed to create appointment records in the database.");
    }
    
    // You can choose to return the first created appointment for a success message,
    // or return the whole array. Returning the array might be more informative.
    return NextResponse.json({ 
      success: true, 
      message: `${createdAppointments.length} service(s) booked successfully!`,
      appointments: createdAppointments 
    }, { status: 201 });

  } catch (err: any) {
    console.error("API Error creating appointment:", err);
    return NextResponse.json({ success: false, message: err.message || "Failed to create appointment." }, { status: 500 });
  }
}
