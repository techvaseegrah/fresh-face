// app/api/appointment/route.ts
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

    // Lookup customers, stylists, and billing staff
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
      {
        $lookup: {
          from: 'users', // Assuming billing staff are in 'users' collection
          localField: 'billingStaffId',
          foreignField: '_id',
          as: 'billingStaffInfo'
        }
      },
      { $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$stylistInfo", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$billingStaffInfo", preserveNullAndEmptyArrays: true } }
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
        .sort({ date: -1, time: -1 })
        .skip(skip)
        .limit(limit),
      Appointment.aggregate([...pipeline, { $count: 'total' }])
    ]);

    const totalAppointments = totalAppointmentsResult.length > 0 ? totalAppointmentsResult[0].total : 0;
    const totalPages = Math.ceil(totalAppointments / limit);

    const appointments = await Appointment.populate(results, {
      path: 'serviceIds',
      model: ServiceItem,
      select: 'name price duration membershipRate'
    });

    const formattedAppointments = appointments.map(apt => ({
      ...apt,
      id: apt._id.toString(),
      customerId: apt.customerInfo,
      stylistId: apt.stylistInfo,
      billingStaff: apt.billingStaffInfo, // Include billing staff details
      finalAmount: apt.finalAmount,
      membershipDiscount: apt.membershipDiscount,
      paymentDetails: apt.paymentDetails // Include payment splitting details
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

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.APPOINTMENTS_CREATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

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
      gender,
      appointmentType = 'Online'
    } = body;

    if (!phoneNumber || !customerName || !serviceIds || serviceIds.length === 0 || !stylistId || !date || !time || !status) {
      return NextResponse.json({
        success: false,
        message: "Missing required fields."
      }, { status: 400 });
    }


    // Find or create customer
    let customerDoc = await Customer.findOne({ phoneNumber: phoneNumber.trim() });
    if (!customerDoc) {
      customerDoc = await Customer.create({
        name: customerName,
        phoneNumber: phoneNumber.trim(),
        email,
        gender: gender || 'other'
      });

      
    }

    // Calculate duration and totals
    const services = await ServiceItem.find({
      _id: { $in: serviceIds }
    }).select('duration price membershipRate');

    const estimatedDuration = services.reduce((total, service) => total + service.duration, 0);

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

    // Calculate totals using model method
    const newAppointment = new Appointment(appointmentData);
    const { grandTotal, membershipSavings } = await newAppointment.calculateTotal();
    appointmentData.finalAmount = grandTotal;
    appointmentData.membershipDiscount = membershipSavings;

    if (status === 'Checked-In') {
      appointmentData.checkInTime = new Date();
    }

    const createdAppointment = await Appointment.create(appointmentData);

    const populatedAppointment = await Appointment.findById(createdAppointment._id)
      .populate({ path: 'customerId', select: 'name phoneNumber isMembership' })
      .populate({ path: 'stylistId', select: 'name' })
      .populate({ path: 'serviceIds', select: 'name price duration membershipRate' });

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