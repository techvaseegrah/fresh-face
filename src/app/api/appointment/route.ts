// /src/app/api/appointment/route.ts

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/appointment';
import Customer from '@/models/customermodel';
import Stylist from '@/models/stylist';
import Service from '@/models/service';
import Staff from '@/models/staff';
import mongoose from 'mongoose';
// ======================= NEW CODE: IMPORT TARGET MODEL =======================
import TargetData from '@/models/TargetSheet';
// ===========================================================================


// ===================================================================================
//  GET: Handler with Full Search, Filtering, and Pagination (Original code)
// ===================================================================================
export async function GET(req: Request) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const statusFilter = searchParams.get('status');
    const searchQuery = searchParams.get('search');
    const skip = (page - 1) * limit;

    // --- Build the Aggregation Pipeline ---
    const pipeline: mongoose.PipelineStage[] = [];

    // Stage 1 & 2: Lookup Customers and Stylists
    pipeline.push({ $lookup: { from: 'customers', localField: 'customerId', foreignField: '_id', as: 'customerInfo' } });
    pipeline.push({ $lookup: { from: 'stylists', localField: 'stylistId', foreignField: '_id', as: 'stylistInfo' } });
    pipeline.push({ $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: true } });
    pipeline.push({ $unwind: { path: "$stylistInfo", preserveNullAndEmptyArrays: true } });

    // Stage 3: Nested Lookup to get Staff details from the Stylist info
    pipeline.push({
      $lookup: {
        from: 'staffs', 
        localField: 'stylistInfo.staffInfo',
        foreignField: '_id',
        as: 'stylistStaffInfo'
      }
    });
    pipeline.push({ $unwind: { path: "$stylistStaffInfo", preserveNullAndEmptyArrays: true } });

    // Build the $match stage for filtering and searching
    const matchStage: any = {};
    if (statusFilter && statusFilter !== 'All') {
      matchStage.status = statusFilter;
    }
    if (searchQuery) {
      const searchRegex = new RegExp(searchQuery, 'i');
      matchStage.$or = [
        { 'customerInfo.name': searchRegex },
        { 'stylistStaffInfo.name': searchRegex }, 
        { 'customerInfo.phoneNumber': searchRegex }
      ];
    }
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Perform queries for paginated data and total count
    const [results, totalCountResult] = await Promise.all([
      Appointment.aggregate(pipeline).sort({ date: -1, time: -1 }).skip(skip).limit(limit),
      Appointment.aggregate([...pipeline, { $count: 'total' }])
    ]);
    
    const totalAppointments = totalCountResult.length > 0 ? totalCountResult[0].total : 0;
    const totalPages = Math.ceil(totalAppointments / limit);
    
    const appointmentsWithServices = await Service.populate(results, { path: 'serviceIds', select: 'name price' });

    // Final Formatting to match the frontend's expected interface
    const formattedAppointments = appointmentsWithServices.map(apt => {
      return {
        ...apt,
        id: apt._id.toString(),
        customerId: apt.customerInfo || null,
        // Manually build the exact nested object the frontend expects
        stylistId: {
          _id: apt.stylistInfo?._id,
          staffInfo: apt.stylistStaffInfo || null 
        },
      };
    });

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
//  POST: Handler for creating a new appointment (WITH TRANSACTION & TRACKER UPDATE)
// ===================================================================================
export async function POST(req: Request) {
  // === NEW: Start transaction session ===
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    await connectToDatabase();
    const body = await req.json();
    const { phoneNumber, customerName, email, serviceIds, stylistId, date, time, notes } = body;

    if (!phoneNumber || !customerName || !serviceIds || serviceIds.length === 0 || !stylistId || !date || !time) {
      return NextResponse.json({ success: false, message: "Missing required fields." }, { status: 400 });
    }

    // Find or create the customer (within transaction)
    let customerDoc = await Customer.findOne({ phoneNumber: phoneNumber.trim() }).session(session);
    if (!customerDoc) {
      [customerDoc] = await Customer.create([{ name: customerName, phoneNumber: phoneNumber.trim(), email }], { session });
    }

    // Fetch stylist's name before creating appointment (within transaction)
    const stylistWithInfo = await Stylist.findById(stylistId).populate({
      path: 'staffInfo',
      model: 'Staff',
      select: 'name'
    }).session(session);

    if (!stylistWithInfo || !stylistWithInfo.staffInfo?.name) {
      throw new Error(`Could not find a valid name for stylist with ID: ${stylistId}`);
    }
    const stylistNameForDb = stylistWithInfo.staffInfo.name;

    // Create the new appointment with the required stylistName field (within transaction)
    const [newAppointment] = await Appointment.create([{
      customerId: customerDoc._id,
      stylistId: stylistId,
      stylistName: stylistNameForDb,
      serviceIds: serviceIds,
      date: new Date(date),
      time: time,
      notes: notes,
      status: 'Scheduled',
    }], { session });

    // === NEW LOGIC: UPDATE PERFORMANCE TRACKER (within transaction) ===
    // Use $inc for an atomic increment operation on the latest document.
    await TargetData.updateOne(
      {}, // An empty filter matches the first document found by sorting
      { $inc: { "summary.achieved.appointmentsFromCallbacks": 1 } },
      { session, sort: { createdAt: -1 } } 
    );
    console.log("Performance tracker 'appointments' metric incremented.");
    // ================================================================

    // === NEW: Commit the transaction if all operations succeed ===
    await session.commitTransaction();

    // Populate the response to send back full details to the frontend
    // This can be done AFTER the transaction is committed successfully.
    const populatedAppointment = await Appointment.findById(newAppointment._id)
        .populate({ path: 'customerId', select: 'name phoneNumber' })
        .populate({
            path: 'stylistId',
            populate: {
                path: 'staffInfo',
                model: 'Staff',
                select: 'name'
            }
        })
        .populate({ path: 'serviceIds', select: 'name price' });

    return NextResponse.json({ success: true, appointment: populatedAppointment, message: "Appointment created and tracker updated." }, { status: 201 });

  } catch (err: any) {
    // === NEW: Abort the transaction on any error ===
    await session.abortTransaction();
    
    if (err.name === 'ValidationError') {
      return NextResponse.json({ success: false, message: err.message, errors: err.errors }, { status: 400 });
    }
    console.error("API Error creating appointment:", err);
    return NextResponse.json({ success: false, message: err.message || "Failed to create appointment." }, { status: 500 });
  
  } finally {
    // === NEW: Always end the session ===
    await session.endSession();
  }
}