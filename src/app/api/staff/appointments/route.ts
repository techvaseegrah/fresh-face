import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import Customer, { ICustomer } from '@/models/customermodel';
import ServiceItem from '@/models/ServiceItem';
import Staff from '@/models/staff';
import { getTenantIdOrBail } from '@/lib/tenant';
import { encrypt } from '@/lib/crypto';
import { createBlindIndex, generateNgrams } from '@/lib/search-indexing';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// ===================================================================================
//  POST: Handler for Staff to Create an Appointment
// ===================================================================================
export async function POST(req: NextRequest) {
  
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;

  // Security Check: Allows any user with the 'staff' role to book appointments.
  const session = await getServerSession(authOptions);
  if (!session || session.user.role.name !== 'staff') {
      return NextResponse.json({ success: false, message: 'Unauthorized: Only staff members can perform this action.' }, { status: 403 });
  }
  
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();
  
  try {
    await connectToDatabase();
    const body = await req.json();

    const { 
      customerId, customerName, phoneNumber, email, gender, dob,
      date, time, notes, serviceAssignments
    } = body;

    // --- Validation ---
    if (!phoneNumber || !customerName || !date || !time || !gender || !serviceAssignments || !Array.isArray(serviceAssignments) || serviceAssignments.length === 0) {
      return NextResponse.json({ success: false, message: "Missing required fields." }, { status: 400 });
    }
    if (serviceAssignments.some((a: any) => !a.stylistId || !a.serviceId)) {
      return NextResponse.json({ success: false, message: 'Every service must have an assigned staff member.' }, { status: 400 });
    }

    let customerDoc;
    const normalizedPhone = String(phoneNumber).replace(/\D/g, '');

    // --- Find or Create Customer ---
    if (customerId) {
      customerDoc = await Customer.findOne({ _id: customerId, tenantId }).session(dbSession);
      if (!customerDoc) throw new Error("The selected customer does not exist.");
    } else {
      const phoneHash = createBlindIndex(normalizedPhone);
      const existingCustomer = await Customer.findOne({ phoneHash: phoneHash, tenantId }).session(dbSession);
      if (existingCustomer) throw new Error("A customer with this phone number already exists.");

      const customerData: Partial<ICustomer> = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        name: encrypt(customerName.trim()),
        phoneNumber: encrypt(normalizedPhone),
        email: email ? encrypt(email.trim()) : undefined,
        gender,
        dob: dob ? new Date(dob) : undefined,
        phoneHash,
        searchableName: customerName.trim().toLowerCase(),
        last4PhoneNumber: normalizedPhone.slice(-4),
        phoneSearchIndex: generateNgrams(normalizedPhone).map((ngram: string) => createBlindIndex(ngram)),
      };
      const [newCustomer] = await Customer.create([customerData], { session: dbSession });
      customerDoc = newCustomer;
    }

    // --- Prepare Appointment Data ---
    const allServiceIds = serviceAssignments.map((a: any) => a.serviceId);
    const primaryStylistId = serviceAssignments[0].stylistId;

    const serviceDetails = await ServiceItem.find({ _id: { $in: allServiceIds }, tenantId }).lean();
    if (serviceDetails.length !== allServiceIds.length) throw new Error("One or more selected services are invalid.");
    
    const totalEstimatedDuration = serviceDetails.reduce((sum, service) => sum + service.duration, 0);
    const tempAppointmentForCalc = new Appointment({ customerId: customerDoc!._id, serviceIds: allServiceIds, tenantId: tenantId });
    const { grandTotal, membershipSavings } = await tempAppointmentForCalc.calculateTotal();

    const assumedUtcDate = new Date(`${date}T${time}:00.000Z`);
    const istOffsetInMinutes = 330;
    const correctUtcTimestamp = assumedUtcDate.getTime() - (istOffsetInMinutes * 60 * 1000);
    const appointmentDateUTC = new Date(correctUtcTimestamp);

    const newAppointmentData = {
      tenantId,
      customerId: customerDoc!._id,
      stylistId: primaryStylistId,
      serviceIds: allServiceIds,
      notes,
      status: 'Appointment',
      // --- THIS IS THE CORRECTED LINE ---
      appointmentType: 'Online', // Changed from 'Offline' to 'Online' as requested
      estimatedDuration: totalEstimatedDuration,
      appointmentDateTime: appointmentDateUTC,
      finalAmount: grandTotal,
      amount: grandTotal + membershipSavings,
      membershipDiscount: membershipSavings,
    };

    const [createdAppointment] = await Appointment.create([newAppointmentData], { session: dbSession });
    if (!createdAppointment) throw new Error("Failed to save the appointment.");
    
    await dbSession.commitTransaction();
    
    return NextResponse.json({ 
      success: true, 
      message: `Appointment for ${customerName} booked successfully!`,
      appointment: createdAppointment
    }, { status: 201 });

  } catch (err: any) {
    await dbSession.abortTransaction();
    console.error("API Error (Staff Appointment Booking):", err);
    return NextResponse.json({ success: false, message: err.message || "Failed to create appointment." }, { status: 500 });
  } finally {
    dbSession.endSession();
  }
}