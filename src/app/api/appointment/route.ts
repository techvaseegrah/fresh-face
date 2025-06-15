// app/api/appointment/route.ts - FIX THE POPULATION
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/appointment';
import Customer from '@/models/customermodel';
import Stylist from '@/models/Stylist';
import ServiceItem from '@/models/ServiceItem'; // Changed from Service
import mongoose from 'mongoose';

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const statusFilter = searchParams.get('status');
    const searchQuery = searchParams.get('search');
    const appointmentType = searchParams.get('type');
    const skip = (page - 1) * limit;

    const pipeline: mongoose.PipelineStage[] = [];

    // Lookup customers and stylists
    pipeline.push(
      {
        $lookup: {
          from: 'customers',
          localField: 'customerId',
          foreignField: '_id',
          as: 'customerInfo'
        }
      },
      {
        $lookup: {
          from: 'stylists',
          localField: 'stylistId',
          foreignField: '_id',
          as: 'stylistInfo'
        }
      },
      { $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$stylistInfo", preserveNullAndEmptyArrays: true } }
    );

    // Build match conditions
    const matchStage: any = {};
    
    if (statusFilter && statusFilter !== 'All') {
      matchStage.status = statusFilter;
    }
    
    if (appointmentType && appointmentType !== 'All') {
      matchStage.appointmentType = appointmentType;
    }
    
    if (searchQuery) {
      const searchRegex = new RegExp(searchQuery, 'i');
      matchStage.$or = [
        { 'customerInfo.name': searchRegex },
        { 'stylistInfo.name': searchRegex },
        { 'customerInfo.phoneNumber': searchRegex }
      ];
    }
    
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    const [results, totalAppointmentsResult] = await Promise.all([
      Appointment.aggregate(pipeline)
        .sort({ date: 1, time: 1 })
        .skip(skip)
        .limit(limit),
      Appointment.aggregate([...pipeline, { $count: 'total' }])
    ]);
    
    const totalAppointments = totalAppointmentsResult.length > 0 ? totalAppointmentsResult[0].total : 0;
    const totalPages = Math.ceil(totalAppointments / limit);
    
    // === FIX: Populate ServiceItem instead of Service ===
    const appointments = await Appointment.populate(results, {
      path: 'serviceIds',
      model: ServiceItem,
      select: 'name price duration' // Use 'duration' instead of 'durationMinutes'
    });

    const formattedAppointments = appointments.map(apt => ({
      ...apt,
      id: apt._id.toString(),
      customerId: apt.customerInfo,
      stylistId: apt.stylistInfo,
    }));

    return NextResponse.json({
      success: true,
      appointments: formattedAppointments,
      pagination: { totalAppointments, totalPages, currentPage: page }
    });

  } catch (error: any) {
    console.error("API Error fetching appointments:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Failed to fetch appointments." 
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const { 
      phoneNumber, 
      customerName, 
      email, 
      serviceIds, 
      stylistId, 
      date, 
      time, 
      notes, 
      status,
      appointmentType = 'Online'
    } = body;

    if (!phoneNumber || !customerName || !serviceIds || serviceIds.length === 0 || !stylistId || !date || !time || !status) {
      return NextResponse.json({ 
        success: false, 
        message: "Missing required fields." 
      }, { status: 400 });
    }

    // === FIX: Calculate duration using ServiceItem ===
    const services = await ServiceItem.find({ 
      _id: { $in: serviceIds } 
    }).select('duration'); // Use 'duration' field

    const estimatedDuration = services.reduce((total, service) => total + service.duration, 0);

    // Find or create customer
    let customerDoc = await Customer.findOne({ phoneNumber: phoneNumber.trim() });
    if (!customerDoc) {
      customerDoc = await Customer.create({ 
        name: customerName, 
        phoneNumber: phoneNumber.trim(), 
        email 
      });
    }

    // Create appointment
    const appointmentData: any = {
      customerId: customerDoc._id,
      stylistId: stylistId,
      serviceIds: serviceIds,
      date: new Date(date),
      time: time,
      notes: notes,
      status: status,
      appointmentType: appointmentType,
      appointmentTime: new Date(`${date}T${time}`),
      estimatedDuration: estimatedDuration
    };

    // Set timestamps based on status
    if (status === 'Checked-In') {
      appointmentData.checkInTime = new Date();
    }

    const newAppointment = await Appointment.create(appointmentData);

    // Lock stylist if checked-in
    if (status === 'Checked-In') {
      const stylist = await Stylist.findById(stylistId);
      if (stylist && stylist.lockStylist) {
        await stylist.lockStylist(newAppointment._id);
      }
    }

    // === FIX: Populate with ServiceItem ===
    const populatedAppointment = await Appointment.findById(newAppointment._id)
      .populate({ path: 'customerId', select: 'name phoneNumber' })
      .populate({ path: 'stylistId', select: 'name' })
      .populate({ path: 'serviceIds', select: 'name price duration' });

    return NextResponse.json({ 
      success: true, 
      appointment: populatedAppointment 
    }, { status: 201 });

  } catch (err: any) {
    console.error("API Error creating appointment:", err);
    return NextResponse.json({ 
      success: false, 
      message: err.message || "Failed to create appointment." 
    }, { status: 500 });
  }
}