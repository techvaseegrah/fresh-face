// app/api/appointment/[id]/status/route.ts - MULTI-TENANT REFACTORED VERSION

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
//  POST: Handler to update an appointment's status based on a specific action
// ===================================================================================
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // --- MT: Get tenantId and check permissions first ---
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;

  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.APPOINTMENTS_UPDATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    await connectToDatabase();
    
    const { id } = params;
    const { action, notes } = await req.json();

    if (!action) {
        return NextResponse.json({ success: false, message: "Action is required." }, { status: 400 });
    }

    // --- MT: Securely find the appointment by its ID and the tenantId ---
    const appointment = await Appointment.findOne({ _id: id, tenantId }).session(dbSession);
    
    if (!appointment) {
      return NextResponse.json({ success: false, message: "Appointment not found." }, { status: 404 });
    }

    const currentTime = new Date();
    let updatedData: any = {};
    let message = '';

    switch (action) {
      case 'check-in':
        if (appointment.status !== 'Scheduled') { // Assuming 'Scheduled' is the initial status
          throw new Error(`Can only check-in appointments with 'Scheduled' status.`);
        }
        if (!appointment.stylistId) {
            throw new Error('Cannot check-in an appointment without an assigned stylist.');
        }

        // --- MT: Securely find the stylist to lock them ---
        const stylistToLock = await Stylist.findOne({ _id: appointment.stylistId, tenantId }).session(dbSession);
        if (!stylistToLock) throw new Error('Assigned stylist not found for this salon.');
        if (stylistToLock.availabilityStatus !== 'Available') throw new Error(`Stylist ${stylistToLock.name} is currently ${stylistToLock.availabilityStatus}.`);

        updatedData = { status: 'Checked-In', checkInTime: currentTime };
        await Stylist.updateOne({ _id: stylistToLock._id, tenantId }, { availabilityStatus: 'Busy', currentAppointmentId: appointment._id }, { session: dbSession });
        message = 'Appointment checked-in successfully.';
        break;

      case 'check-out':
        if (appointment.status !== 'Checked-In') {
          throw new Error(`Can only check-out appointments with 'Checked-In' status.`);
        }
        
        const actualDuration = appointment.checkInTime 
          ? Math.round((currentTime.getTime() - appointment.checkInTime.getTime()) / (1000 * 60))
          : appointment.estimatedDuration;
        
        updatedData = { status: 'Checked-Out', checkOutTime: currentTime, actualDuration: actualDuration };
        message = 'Appointment checked-out successfully.';
        // Note: The stylist is unlocked upon payment, not checkout, as per your other routes.
        break;

      case 'cancel':
        if (['Paid', 'Cancelled', 'No-Show'].includes(appointment.status)) {
          throw new Error(`Cannot cancel appointment with status "${appointment.status}".`);
        }
        
        updatedData = { status: 'Cancelled', cancelledTime: currentTime, notes: notes || appointment.notes };

        // If cancelling a checked-in appointment, unlock the stylist.
        if (appointment.status === 'Checked-In' && appointment.stylistId) {
            await Stylist.updateOne({ _id: appointment.stylistId, tenantId }, { availabilityStatus: 'Available', currentAppointmentId: null }, { session: dbSession });
        }
        message = 'Appointment cancelled successfully.';
        break;

      case 'mark-paid': // Assuming this is distinct from the /pay route
        if (appointment.status !== 'Billed' && appointment.status !== 'Checked-Out') {
          throw new Error(`Can only mark as paid appointments with 'Billed' or 'Checked-Out' status.`);
        }
        
        updatedData = { status: 'Paid' };

        // If marking as paid, ensure the stylist is unlocked.
        if (appointment.stylistId) {
            await Stylist.updateOne({ _id: appointment.stylistId, tenantId }, { availabilityStatus: 'Available', currentAppointmentId: null }, { session: dbSession });
        }
        message = 'Appointment marked as paid.';
        break;

      default:
        throw new Error('Invalid action provided.');
    }

    // --- MT: The final update must also be scoped by tenantId ---
    const updatedAppointment = await Appointment.findOneAndUpdate(
      { _id: id, tenantId }, // Condition
      updatedData,          // Update
      { new: true, runValidators: true, session: dbSession } // Options
    ).populate(['customerId', 'stylistId', 'serviceIds']);

    await dbSession.commitTransaction();

    return NextResponse.json({ 
      success: true, 
      appointment: updatedAppointment,
      message: message
    });

  } catch (error: any) {
    await dbSession.abortTransaction();
    console.error("API Error updating appointment status:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    dbSession.endSession();
  }
}