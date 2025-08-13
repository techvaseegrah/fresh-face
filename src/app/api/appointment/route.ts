// /app/api/appointment/route.ts - FINAL CORRECTED VERSION

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import Customer, { ICustomer } from '@/models/customermodel'; // Import ICustomer
import Staff from '@/models/staff';
import ServiceItem from '@/models/ServiceItem';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { InventoryManager } from '@/lib/inventoryManager'; 
import { getTenantIdOrBail } from '@/lib/tenant';
import { whatsAppService } from '@/lib/whatsapp';

// --- IMPORT THE DECRYPT FUNCTION ---
import { encrypt, decrypt} from '@/lib/crypto';
import { createBlindIndex, generateNgrams } from '@/lib/search-indexing';

// ===================================================================================
//  GET: Handler (No Changes Needed)
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
            matchStage._id = new mongoose.Types.ObjectId(); 
        }
    }
    
    const [appointments, totalAppointmentsResult] = await Promise.all([
      Appointment.find(matchStage)
        .populate({ path: 'customerId' })
        .populate({ path: 'stylistId', select: 'name' })
        .populate({ path: 'serviceIds', select: 'name price duration membershipRate' })
        .populate({ path: 'billingStaffId', select: 'name' })
        .populate({  path: 'invoiceId', select: 'invoiceNumber'})
        .sort({ appointmentDateTime: dateFilter === 'today' ? 1 : -1 }) 
        .skip(skip)
        .limit(limit)
        .lean(), 
      Appointment.countDocuments(matchStage)
    ]);
    
    const totalPages = Math.ceil(totalAppointmentsResult / limit);
    
    const formattedAppointments = appointments.map(apt => {
        let finalDateTime;
        if (apt.appointmentDateTime && apt.appointmentDateTime instanceof Date) {
            finalDateTime = apt.appointmentDateTime;
        } else if ((apt as any).date && (apt as any).time) {
            const dateStr = (apt as any).date instanceof Date ? (apt as any).date.toISOString().split('T')[0] : (apt as any).date;
            finalDateTime = new Date(`${dateStr}T${(apt as any).time}:00.000Z`);
        } else {
            finalDateTime = apt.createdAt || new Date();
        }

        const customerData = apt.customerId as any;
        let decryptedCustomerName = 'Decryption Error';
        let decryptedPhoneNumber = '';

        if (customerData) {
            try {
                decryptedCustomerName = customerData.name ? decrypt(customerData.name) : 'Unknown Client';
            } catch (e) {
                console.error(`Failed to decrypt name for customer ${customerData._id} on appointment ${apt._id}`);
            }
            try {
                decryptedPhoneNumber = customerData.phoneNumber ? decrypt(customerData.phoneNumber) : '';
            } catch (e) {
                console.error(`Failed to decrypt phone for customer ${customerData._id} on appointment ${apt._id}`);
            }
        }
        
       return {
              ...apt,
              id: apt._id.toString(),
              appointmentDateTime: finalDateTime.toISOString(),
              createdAt: (apt.createdAt || finalDateTime).toISOString(),
              customerId: {
                _id: customerData?._id,
                name: decryptedCustomerName,
                phoneNumber: decryptedPhoneNumber,
                isMembership: customerData?.isMembership || false 
              }
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
//  POST: Handler (MODIFIED TO SAVE DOB AND SURVEY)
// ===================================================================================
export async function POST(req: NextRequest) {
  
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    await connectToDatabase();
    const body = await req.json();

    // MODIFIED: Destructure dob and survey from the request body
    const { 
      customerName, phoneNumber, email, gender, dob, survey, // <-- ADDED dob, survey
      date, time, notes, status, 
      appointmentType = 'Online', serviceAssignments
    } = body;

    if (!phoneNumber || !customerName || !date || !time || !serviceAssignments || !Array.isArray(serviceAssignments) || serviceAssignments.length === 0) {
      return NextResponse.json({ success: false, message: "Missing required fields or services." }, { status: 400 });
    }

    const normalizedPhone = String(phoneNumber).replace(/\D/g, '');
    const phoneHashToFind = createBlindIndex(normalizedPhone);
    let customerDoc = await Customer.findOne({ phoneHash: phoneHashToFind, tenantId }).session(session);

    if (!customerDoc) {
      // MODIFIED: Add dob and survey to the creation object if they exist
      const customerDataForCreation: Partial<ICustomer> = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        name: encrypt(customerName.trim()),
        phoneNumber: encrypt(normalizedPhone),
        email: email ? encrypt(email.trim()) : undefined,
        gender: gender || 'other',
        phoneHash: phoneHashToFind,
        searchableName: customerName.trim().toLowerCase(),
        last4PhoneNumber: normalizedPhone.slice(-4),
        phoneSearchIndex: generateNgrams(normalizedPhone).map(ngram => createBlindIndex(ngram)),
        // --- NEW FIELDS ADDED HERE ---
        dob: dob ? new Date(dob) : undefined, // Add dob if it's provided
        survey: survey ? survey.trim() : undefined, // Add survey if it's provided
      };
      const newCustomers = await Customer.create([customerDataForCreation], { session });
      customerDoc = newCustomers[0];
    }

    // --- (No changes needed for the rest of the logic) ---
    const allServiceIds = serviceAssignments.map((a: any) => a.serviceId);
    const primaryStylistId = serviceAssignments[0].stylistId; 
    const serviceDetails = await ServiceItem.find({ _id: { $in: allServiceIds } }).lean();
    if (serviceDetails.length !== allServiceIds.length) {
      throw new Error("One or more selected services could not be found.");
    }

    if (InventoryManager.calculateMultipleServicesInventoryImpact && InventoryManager.applyInventoryUpdates) {
        const { totalUpdates } = await InventoryManager.calculateMultipleServicesInventoryImpact(
          allServiceIds,
          gender,
          tenantId
        );
        if (totalUpdates.length > 0) {
          await InventoryManager.applyInventoryUpdates(totalUpdates, session, tenantId);
        }
    }

    const totalEstimatedDuration = serviceDetails.reduce((sum, service) => sum + service.duration, 0);
    const tempAppointmentForCalc = new Appointment({
      customerId: customerDoc!._id,
      serviceIds: allServiceIds,
      tenantId: tenantId,
    });
    const { grandTotal, membershipSavings } = await tempAppointmentForCalc.calculateTotal();

    const assumedUtcDate = new Date(`${date}T${time}:00.000Z`);
    const istOffsetInMinutes = 330;
    const correctUtcTimestamp = assumedUtcDate.getTime() - (istOffsetInMinutes * 60 * 1000);
    const appointmentDateUTC = new Date(correctUtcTimestamp);

    const newAppointmentData = {
      tenantId: tenantId,
      customerId: customerDoc!._id,
      stylistId: primaryStylistId,
      serviceIds: allServiceIds,
      notes,
      status,
      appointmentType,
      estimatedDuration: totalEstimatedDuration,
      appointmentDateTime: appointmentDateUTC,
      finalAmount: grandTotal,
      amount: grandTotal + membershipSavings,
      membershipDiscount: membershipSavings,
      checkInTime: status === 'Checked-In' ? new Date() : undefined,
    };

    const [createdAppointment] = await Appointment.create([newAppointmentData], { session });
    
    if (!createdAppointment) {
      throw new Error("Failed to create the appointment record in the database.");
    }
    
    await Staff.updateOne({ _id: primaryStylistId }, { isAvailable: false }, { session });

    await session.commitTransaction();
    
    try {
      const stylist = await Staff.findById(primaryStylistId).select('name').lean();
      const servicesText = serviceDetails.map(s => s.name).join(', ');
      
      const appointmentDateFormatted = new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
      const appointmentTimeFormatted = new Date(`${date}T${time}:00`).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

      await whatsAppService.sendAppointmentBooking({
        phoneNumber: normalizedPhone,
        customerName: customerName.trim(),
        appointmentDate: appointmentDateFormatted,
        appointmentTime: appointmentTimeFormatted,
        services: servicesText,
        stylistName: stylist?.name || 'Our Team',
      });
    } catch (whatsappError: any) {
      console.error('Failed to send WhatsApp appointment notification:', whatsappError);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Appointment booked successfully!`,
      appointment: createdAppointment
    }, { status: 201 });

  } catch (err: any) {
    await session.abortTransaction();
    console.error("API Error creating appointment:", err);
    return NextResponse.json({ success: false, message: err.message || "Failed to create appointment." }, { status: 500 });
  
  } finally {
    session.endSession();
  }
}