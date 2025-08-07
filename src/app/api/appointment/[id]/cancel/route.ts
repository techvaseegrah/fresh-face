// app/api/appointment/[id]/cancel/route.ts - MULTI-TENANT REFACTORED VERSION

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
//  POST: Handler to cancel an appointment
// ===================================================================================
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // --- MT: Get tenantId and check permissions first ---
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;

  const session = await getServerSession(authOptions);
  // Assuming cancelling requires update permissions
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
    
    // Your existing business logic remains the same
    if (['Paid', 'Cancelled'].includes(appointment.status)) {
      throw new Error(`Cannot cancel an appointment with status "${appointment.status}".`);
    }

    const originalStatus = appointment.status;
    appointment.status = 'Cancelled';
    await appointment.save({ session: dbSession });

    // If the appointment was in-progress, release the stylist
    if (originalStatus === 'Checked-In' && appointment.stylistId) {
      // --- MT: Securely update the stylist, ensuring they also belong to the tenant ---
      await Stylist.updateOne(
        { _id: appointment.stylistId, tenantId: tenantId },
        { availabilityStatus: 'Available', currentAppointmentId: null },
        { session: dbSession }
      );
    }
    
    await dbSession.commitTransaction();
    return NextResponse.json({ success: true, message: 'Appointment has been cancelled.' });

  } catch (err: any) {
    await dbSession.abortTransaction();
    console.error("API Error cancelling appointment:", err);
    return NextResponse.json({ success: false, message: err.message || 'Cancellation failed.' }, { status: 500 });
  } finally {
    dbSession.endSession();
  }
}