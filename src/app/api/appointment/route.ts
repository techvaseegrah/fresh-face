import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/appointment';
import Customer from '@/models/customermodel';
import Stylist from '@/models/stylist';
import Service from '@/models/service';
import mongoose from 'mongoose';

// ===================================================================================
//  GET: Handler with Full Search, Filtering, and Pagination
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

    // Stage 1: Lookup (Join) with the Customers collection
    pipeline.push({
      $lookup: {
        from: 'customers', // The actual name of the collection in MongoDB
        localField: 'customerId',
        foreignField: '_id',
        as: 'customerInfo'
      }
    });

    // Stage 2: Lookup (Join) with the Stylists collection
    pipeline.push({
      $lookup: {
        from: 'stylists', // The actual name of the collection
        localField: 'stylistId',
        foreignField: '_id',
        as: 'stylistInfo'
      }
    });
    
    // Deconstruct the joined arrays to make them top-level fields for easier searching
    pipeline.push({ $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: true } });
    pipeline.push({ $unwind: { path: "$stylistInfo", preserveNullAndEmptyArrays: true } });

    // --- Build the $match stage for filtering and searching ---
    const matchStage: any = {};
    if (statusFilter && statusFilter !== 'All') {
      matchStage.status = statusFilter;
    }
    if (searchQuery) {
      const searchRegex = new RegExp(searchQuery, 'i');
      matchStage.$or = [
        { 'customerInfo.name': searchRegex },
        { 'stylistInfo.name': searchRegex },
        { 'customerInfo.phoneNumber': searchRegex }
      ];
    }
    
    // Only add the $match stage if there are any conditions to apply
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // --- Perform two queries: one for paginated data, one for total count ---
    const [results, totalAppointmentsResult] = await Promise.all([
      // Query 1: Get the appointments for the current page
      Appointment.aggregate(pipeline)
        .sort({ date: 1, time: 1 })
        .skip(skip)
        .limit(limit),
      
      // Query 2: Get the total count of documents matching the entire pipeline
      Appointment.aggregate([...pipeline, { $count: 'total' }])
    ]);
    
    const totalAppointments = totalAppointmentsResult.length > 0 ? totalAppointmentsResult[0].total : 0;
    const totalPages = Math.ceil(totalAppointments / limit);
    
    // The main data is already joined by the aggregation.
    // We just need to populate the serviceIds array separately.
    const appointments = await Appointment.populate(results, {
        path: 'serviceIds',
        model: Service,
        select: 'name price'
    });

    // Remap fields to match the frontend's expected interface
    const formattedAppointments = appointments.map(apt => ({
      ...apt,
      id: apt._id.toString(),
      customerId: apt.customerInfo, // Use the data from the lookup
      stylistId: apt.stylistInfo,   // Use the data from the lookup
    }));

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
//  POST: Handler for creating a new appointment
// ===================================================================================
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const { phoneNumber, customerName, email, serviceIds, stylistId, date, time, notes } = body;

    if (!phoneNumber || !customerName || !serviceIds || serviceIds.length === 0 || !stylistId || !date || !time) {
      return NextResponse.json({ success: false, message: "Missing required fields." }, { status: 400 });
    }

    // Find or create the customer
    let customerDoc = await Customer.findOne({ phoneNumber: phoneNumber.trim() });
    if (!customerDoc) {
      customerDoc = await Customer.create({ name: customerName, phoneNumber: phoneNumber.trim(), email });
    }

    const newAppointment = await Appointment.create({
      customerId: customerDoc._id,
      stylistId: stylistId,
      serviceIds: serviceIds,
      date: new Date(date),
      time: time,
      notes: notes,
      status: 'Scheduled',
    });

    // Populate the response to send back full details immediately
    const populatedAppointment = await Appointment.findById(newAppointment._id)
        .populate({ path: 'customerId', select: 'name phoneNumber' })
        .populate({ path: 'stylistId', select: 'name' })
        .populate({ path: 'serviceIds', select: 'name price' });

    return NextResponse.json({ success: true, appointment: populatedAppointment }, { status: 201 });

  } catch (err: any) {
    console.error("API Error creating appointment:", err);
    return NextResponse.json({ success: false, message: err.message || "Failed to create appointment." }, { status: 500 });
  }
}
