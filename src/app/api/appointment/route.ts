// ===================================================================================
//  UPDATED FILE: src/app/api/appointment/route.ts
// ===================================================================================

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import Customer, { ICustomer } from '@/models/customermodel';
import Staff from '@/models/staff';
import ServiceItem from '@/models/ServiceItem';
import Invoice from '@/models/invoice';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
// ❌ REMOVED: No longer need InventoryManager in this file.
// import { InventoryManager } from '@/lib/inventoryManager'; 
import { getTenantIdOrBail } from '@/lib/tenant';
import { whatsAppService } from '@/lib/whatsapp';
import { encrypt, decrypt} from '@/lib/crypto';
import { createBlindIndex, generateNgrams } from '@/lib/search-indexing';
import CustomerPackage from '@/models/CustomerPackage';
import DayEndReport from '@/models/DayEndReport';

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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const skip = (page - 1) * limit;

    const matchStage: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };

    if (statusFilter && statusFilter !== 'All') {
      matchStage.status = statusFilter;
    }
    
    if (startDate || endDate) {
        matchStage.appointmentDateTime = {};
        if (startDate) {
            const startOfDay = new Date(startDate);
            startOfDay.setUTCHours(0, 0, 0, 0);
            matchStage.appointmentDateTime.$gte = startOfDay;
        }
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setDate(endOfDay.getDate() + 1);
            endOfDay.setUTCHours(0, 0, 0, 0);
            matchStage.appointmentDateTime.$lt = endOfDay;
        }
    }

    if (searchQuery) {
        const searchStr = searchQuery.trim();
        const finalSearchOrConditions = [];

        let customerFindConditions: any = { tenantId };
        const isNumeric = /^\d+$/.test(searchStr);
        if (isNumeric) {
            customerFindConditions.phoneSearchIndex = createBlindIndex(searchStr);
        } else {
            customerFindConditions.searchableName = { $regex: searchStr, $options: 'i' };
        }
        const matchingCustomers = await Customer.find(customerFindConditions).select('_id').lean();
        const customerIds = matchingCustomers.map(c => c._id);
        if (customerIds.length > 0) {
            finalSearchOrConditions.push({ customerId: { $in: customerIds } });
        }
        
        const stylistQuery = { name: { $regex: searchStr, $options: 'i' }, tenantId };
        const matchingStylists = await Staff.find(stylistQuery).select('_id').lean();
        const stylistIds = matchingStylists.map(s => s._id);
        if (stylistIds.length > 0) {
            finalSearchOrConditions.push({ stylistId: { $in: stylistIds } });
        }

        const matchingInvoices = await Invoice.find({
            invoiceNumber: { $regex: `^${searchStr}`, $options: 'i' },
            tenantId
        }).select('_id').lean();
        const invoiceIds = matchingInvoices.map(inv => inv._id);
        if (invoiceIds.length > 0) {
            finalSearchOrConditions.push({ invoiceId: { $in: invoiceIds } });
        }

        if (finalSearchOrConditions.length > 0) {
            matchStage.$or = finalSearchOrConditions;
        } else {
            matchStage._id = new mongoose.Types.ObjectId(); 
        }
    }
    const latestCompletedReport = await DayEndReport.findOne({
        tenantId: tenantId,
        isCompleted: true
    }).sort({ closingDate: -1 }).select('closingDate').lean();
     const latestClosingDate = latestCompletedReport ? latestCompletedReport.closingDate : null;
    
    const [appointments, totalAppointmentsResult] = await Promise.all([
      Appointment.find(matchStage)
        .populate({ path: 'customerId' })
        .populate({ path: 'stylistId', select: 'name' })
        .populate({ path: 'serviceIds', select: 'name price duration membershipRate' })
        .populate({ path: 'productIds', select: 'name price' })
        .populate({ path: 'billingStaffId', select: 'name' })
        .populate({  path: 'invoiceId', select: 'invoiceNumber'})
        .sort({ appointmentDateTime: -1 })
        .skip(skip)
        .limit(limit)
        .lean(), 
      Appointment.countDocuments(matchStage)
    ]);
    
    const totalPages = Math.ceil(totalAppointmentsResult / limit);
    
    const formattedAppointments = appointments.map(apt => {
      let isLocked = false;
        if (latestClosingDate) {
            // Normalize dates to the start of the day for an accurate comparison
            const appointmentDate = new Date(apt.appointmentDateTime || apt.createdAt);
            appointmentDate.setHours(0, 0, 0, 0);

            const closingDate = new Date(latestClosingDate);
            closingDate.setHours(0, 0, 0, 0);

            // If the appointment date is on or before the closing date, it's locked.
            if (appointmentDate <= closingDate) {
                isLocked = true;
            }
        }
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
              isLocked: isLocked,
              redeemedItems: apt.redeemedItems, 
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
//  POST: Handler (✅ CORRECTED: Inventory logic removed)
// ===================================================================================
export async function POST(req: NextRequest) {
  
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    await connectToDatabase();
    const body = await req.json();

    // ✅ STEP 1: Destructure the new payload from the updated frontend.
    // We now expect 'appointmentDateTime' instead of separate 'date' and 'time'.
    const { 
      customerName, phoneNumber, email, dob, survey, gender,
      notes, 
      status, // This will be 'Appointment' or 'Waiting for Service'
      appointmentType,
      appointmentDateTime, // This is the new, single, required field (as an ISO string)
      serviceAssignments,
      productAssignments,
      redeemedItems,
    } = body;

    // ✅ STEP 2: Update validation to use the new 'appointmentDateTime' field.
    if (!phoneNumber || !customerName || !appointmentDateTime || !status || !serviceAssignments || !Array.isArray(serviceAssignments) || serviceAssignments.length === 0) {
      await session.abortTransaction();
      return NextResponse.json({ success: false, message: "Missing required fields (customer info, datetime, status, or services)." }, { status: 400 });
    }

    const normalizedPhone = String(phoneNumber).replace(/\D/g, '');
    const phoneHashToFind = createBlindIndex(normalizedPhone);
    let customerDoc = await Customer.findOne({ phoneHash: phoneHashToFind, tenantId }).session(session);

    if (!customerDoc) {
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
        dob: dob ? new Date(dob) : undefined,
        survey: survey ? survey.trim() : undefined,
      };
      const newCustomers = await Customer.create([customerDataForCreation], { session });
      customerDoc = newCustomers[0];
    }

    if (redeemedItems && Array.isArray(redeemedItems) && redeemedItems.length > 0) {
      for (const redemption of redeemedItems) {
        const { customerPackageId, redeemedItemId } = redemption;
        const pkg = await CustomerPackage.findOne({ _id: customerPackageId, customerId: customerDoc._id, tenantId }).session(session);
        if (!pkg || pkg.status !== 'active') throw new Error(`Invalid or inactive package specified for redemption.`);
        const itemInPkg = pkg.remainingItems.find(i => i.itemId.toString() === redeemedItemId);
        if (!itemInPkg || itemInPkg.remainingQuantity < 1) throw new Error(`Item ${redeemedItemId} is not available for redemption.`);
      }
    }

    const allServiceIdsWithDuplicates = serviceAssignments.map((a: any) => a.serviceId);
    const allProductIds = (productAssignments || []).map((p: any) => p.productId);
    
    const uniqueServiceIds = [...new Set(allServiceIdsWithDuplicates)];
    const primaryStylistId = serviceAssignments[0].stylistId;

    const foundServicesFromDB = await ServiceItem.find({ _id: { $in: uniqueServiceIds }, tenantId }).lean();

    if (foundServicesFromDB.length !== uniqueServiceIds.length) {
        throw new Error("One or more selected services could not be found. They may have been recently deleted.");
    }

    const serviceDetailsMap = new Map(foundServicesFromDB.map(service => [service._id.toString(), service]));
    const fullServiceDetailsList = allServiceIdsWithDuplicates.map(id => serviceDetailsMap.get(id)!);

    const totalEstimatedDuration = fullServiceDetailsList.reduce((sum, service) => sum + (service.duration || 0), 0);
    
    const tempAppointmentForCalc = new Appointment({
      customerId: customerDoc!._id,
      serviceIds: allServiceIdsWithDuplicates,
      productIds: allProductIds, 
      tenantId: tenantId,
    });
    const { grandTotal, membershipSavings } = await tempAppointmentForCalc.calculateTotal();

    const newAppointmentData = {
      tenantId: tenantId,
      customerId: customerDoc!._id,
      stylistId: primaryStylistId,
      serviceIds: allServiceIdsWithDuplicates,
      productIds: allProductIds,
      notes,
      status, // Correctly saves 'Appointment' or 'Waiting for Service'
      appointmentType, // Correctly saves 'Online' or 'Offline'
      estimatedDuration: totalEstimatedDuration,
      // ✅ STEP 3: Use the 'appointmentDateTime' field directly. Mongoose will convert the ISO string to a Date object.
      appointmentDateTime: new Date(appointmentDateTime),
      finalAmount: grandTotal,
      amount: grandTotal + membershipSavings,
      membershipDiscount: membershipSavings,
      checkInTime: status === 'Checked-In' ? new Date() : undefined, // Preserved for any legacy check-ins, but won't trigger for "Waiting for Service"
      redeemedItems: redeemedItems,
    };

    const [createdAppointment] = await Appointment.create([newAppointmentData], { session });
    
    if (!createdAppointment) {
      throw new Error("Failed to create the appointment record in the database.");
    }
    
    await Staff.updateOne({ _id: primaryStylistId }, { isAvailable: false }, { session });

    await session.commitTransaction();
    
    try {
      const stylist = await Staff.findById(primaryStylistId).select('name').lean();
      const servicesText = fullServiceDetailsList.map(s => s.name).join(', ');
      
      // ✅ STEP 4: Format date and time for notifications from the new single field.
      const notificationDate = new Date(appointmentDateTime);
      const appointmentDateFormatted = notificationDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
      const appointmentTimeFormatted = notificationDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

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
      // We don't abort the transaction if only the notification fails.
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