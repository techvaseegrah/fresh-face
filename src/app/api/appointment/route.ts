// /app/api/appointment/route.ts - MULTI-TENANT REFACTORED VERSION

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import Customer from '@/models/customermodel';
import Staff from '@/models/staff';
import ServiceItem from '@/models/ServiceItem';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { InventoryManager } from '@/lib/inventoryManager'; 
import { getTenantIdOrBail } from '@/lib/tenant';

import { encrypt } from '@/lib/crypto';
import { createBlindIndex, generateNgrams } from '@/lib/search-indexing';

// ===================================================================================
//  GET: Handler with Multi-Tenant Scoping
// ===================================================================================
export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

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

    const matchStage: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };

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
        let customerFindConditions: any = { tenantId };

        const isNumeric = /^\d+$/.test(searchStr);
        if (isNumeric) {
            customerFindConditions.phoneSearchIndex = createBlindIndex(searchStr);
        } else {
            customerFindConditions.searchableName = { $regex: searchStr, $options: 'i' };
        }
        
        const matchingCustomers = await Customer.find(customerFindConditions).select('_id').lean();
        const customerIds = matchingCustomers.map(c => c._id);

        const stylistQuery = { name: { $regex: searchStr, $options: 'i' }, tenantId };
        const matchingStylists = await Staff.find(stylistQuery).select('_id').lean();
        const stylistIds = matchingStylists.map(s => s._id);

        const finalSearchOrConditions = [];
        if (customerIds.length > 0) finalSearchOrConditions.push({ customerId: { $in: customerIds } });
        if (stylistIds.length > 0) finalSearchOrConditions.push({ stylistId: { $in: stylistIds } });
        
        if (finalSearchOrConditions.length > 0) {
            matchStage.$or = finalSearchOrConditions;
        } else {
            // If search query is provided but no customers or stylists match, return no results.
            // Use a condition that is guaranteed to be false.
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
//  POST: Handler with Multi-Tenant Scoping and Transaction Safety
// ===================================================================================
export async function POST(req: NextRequest) {
  
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    await connectToDatabase();
    const body = await req.json();

    const { 
      customerName, phoneNumber, email, gender, date, time, notes, status, 
      appointmentType = 'Online', serviceAssignments
    } = body;

    if (!phoneNumber || !customerName || !date || !time || !serviceAssignments || !Array.isArray(serviceAssignments) || serviceAssignments.length === 0) {
      return NextResponse.json({ success: false, message: "Missing required fields or services." }, { status: 400 });
    }

    const normalizedPhone = String(phoneNumber).replace(/\D/g, '');
    const phoneHashToFind = createBlindIndex(normalizedPhone);
    let customerDoc = await Customer.findOne({ phoneHash: phoneHashToFind, tenantId }).session(session);

    if (!customerDoc) {
      const customerDataForCreation = {
        tenantId: tenantId,
        name: encrypt(customerName.trim()),
        phoneNumber: encrypt(normalizedPhone),
        email: email ? encrypt(email.trim()) : undefined,
        gender: gender || 'other',
        phoneHash: phoneHashToFind,
        searchableName: customerName.trim().toLowerCase(),
        last4PhoneNumber: normalizedPhone.slice(-4),
        phoneSearchIndex: generateNgrams(normalizedPhone).map(ngram => createBlindIndex(ngram)), 
      };
      
      const newCustomers = await Customer.create([customerDataForCreation], { session });
      customerDoc = newCustomers[0];
      if (!customerDoc) {
        throw new Error("Customer creation failed unexpectedly.");
      }
    }

    // Pass tenantId to your InventoryManager if it needs to query tenant-specific data
    const serviceIdsForInventoryCheck = serviceAssignments.map((a: any) => a.serviceId);
    if (InventoryManager.calculateMultipleServicesInventoryImpact && InventoryManager.applyInventoryUpdates) {
        const { totalUpdates } = await InventoryManager.calculateMultipleServicesInventoryImpact(
          serviceIdsForInventoryCheck,
          gender,
          tenantId
        );
        if (totalUpdates.length > 0) {
          await InventoryManager.applyInventoryUpdates(totalUpdates, session, tenantId);
        }
    }

    const assumedUtcDate = new Date(`${date}T${time}:00.000Z`);
    const istOffsetInMinutes = 330;
    const correctUtcTimestamp = assumedUtcDate.getTime() - (istOffsetInMinutes * 60 * 1000);
    const appointmentDateUTC = new Date(correctUtcTimestamp);

    const groupBookingId = new mongoose.Types.ObjectId();
    const newAppointmentsDataPromises = serviceAssignments.map(async (assignment: any) => {
      // Ensure the service being booked belongs to the tenant
      const service = await ServiceItem.findOne({ _id: assignment.serviceId, tenantId }).select('duration price membershipRate').lean();
      if (!service) {
        throw new Error(`Service with ID ${assignment.serviceId} not found for this salon.`);
      }

      // Ensure the stylist being booked belongs to the tenant
      const stylist = await Staff.findOne({ _id: assignment.stylistId, tenantId }).lean();
      if(!stylist) {
        throw new Error(`Stylist with ID ${assignment.stylistId} not found for this salon.`);
      }

      const tempAppointmentForCalc = new Appointment({
        customerId: customerDoc!._id,
        serviceIds: [assignment.serviceId],
        tenantId: tenantId, // Pass tenantId to virtuals/methods
      });
      const { grandTotal, membershipSavings } = await tempAppointmentForCalc.calculateTotal();

      return {
        tenantId: tenantId,
        customerId: customerDoc!._id,
        stylistId: assignment.stylistId,
        serviceIds: [assignment.serviceId],
        guestName: assignment.guestName,
        notes,
        status,
        appointmentType,
        estimatedDuration: service.duration,
        appointmentDateTime: appointmentDateUTC,
        groupBookingId: groupBookingId,
        finalAmount: grandTotal,
        amount: grandTotal + membershipSavings,
        membershipDiscount: membershipSavings,
        checkInTime: status === 'Checked-In' ? new Date() : undefined,
      };
    });
    
    const newAppointmentsData = await Promise.all(newAppointmentsDataPromises);
    const createdAppointments = await Appointment.insertMany(newAppointmentsData, { session });

    if (!createdAppointments || createdAppointments.length === 0) {
      throw new Error("Failed to create appointment records in the database.");
    }
    
    await session.commitTransaction();
    
    return NextResponse.json({ 
      success: true, 
      message: `${createdAppointments.length} service(s) booked successfully!`,
      appointments: createdAppointments 
    }, { status: 201 });

  } catch (err: any) {
    await session.abortTransaction();
    console.error("API Error creating appointment:", err);
    return NextResponse.json({ success: false, message: err.message || "Failed to create appointment." }, { status: 500 });
  
  } finally {
    session.endSession();
  }
}