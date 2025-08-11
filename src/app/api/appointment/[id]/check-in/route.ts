// app/api/appointment/[id]/check-in/route.ts - MULTI-TENANT REFACTORED VERSION

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import Stylist from '@/models/Stylist';
import mongoose from 'mongoose';
import { getTenantIdOrBail } from '@/lib/tenant';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// ===================================================================================
//  POST: Handler to check-in an appointment
// ===================================================================================
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // --- MT: Get tenantId and check permissions first ---
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;

  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.APPOINTMENTS_UPDATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const appointmentId = params.id;
  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    return NextResponse.json({ success: false, message: 'Invalid Appointment ID.' }, { status: 400 });
  }

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    await connectToDatabase();

    // --- MT: Securely find the appointment by its ID and the tenantId ---
    const appointment = await Appointment.findOne({ _id: appointmentId, tenantId }).session(dbSession);
    
    if (!appointment) {
        throw new Error('Appointment not found.');
    }
    if (appointment.status !== 'Scheduled') {
        throw new Error(`Cannot check-in. Status is already "${appointment.status}".`);
    }
    if (!appointment.stylistId) {
        throw new Error('No stylist assigned to this appointment.');
    }

    // --- MT: Securely find the stylist, ensuring they also belong to the tenant ---
    const stylist = await Stylist.findOne({ _id: appointment.stylistId, tenantId }).session(dbSession);
    
    if (!stylist) {
        throw new Error('Assigned stylist not found for this salon.');
    }
    if (stylist.availabilityStatus !== 'Available') {
        throw new Error(`Stylist ${stylist.name} is currently ${stylist.availabilityStatus}.`);
    }

    // --- Perform Updates ---
    appointment.status = 'Checked-In';
    appointment.checkInTime = new Date(); // It's good practice to record the check-in time
    stylist.availabilityStatus = 'Busy';
    stylist.currentAppointmentId = appointment._id;

    await appointment.save({ session: dbSession });
    await stylist.save({ session: dbSession });
    
    await dbSession.commitTransaction();

    return NextResponse.json({ success: true, message: 'Customer Checked In. Stylist marked as Busy.' });

  } catch (err: any) {
    await dbSession.abortTransaction();
    console.error("API Error checking in appointment:", err);
    return NextResponse.json({ success: false, message: err.message || 'Check-in failed.' }, { status: 500 });
  } finally {
    dbSession.endSession();
  }
}