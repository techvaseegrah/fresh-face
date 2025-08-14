// app/api/appointment/[id]/bill/route.ts - MULTI-TENANT REFACTORED VERSION

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import mongoose from 'mongoose';
import { getTenantIdOrBail } from '@/lib/tenant';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// ===================================================================================
//  POST: Handler to mark an appointment as 'Billed'
// ===================================================================================
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // --- MT: Get tenantId and check permissions first ---
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;

  const session = await getServerSession(authOptions);
  // Assuming billing requires update permissions
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.APPOINTMENTS_UPDATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const appointmentId = params.id;
  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    return NextResponse.json({ success: false, message: 'Invalid Appointment ID.' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const { finalTotal } = await req.json();

    if (typeof finalTotal !== 'number') {
        return NextResponse.json({ success: false, message: 'Final total must be a number.' }, { status: 400 });
    }

    // --- MT: Securely find the appointment by its ID and the tenantId ---
    const appointment = await Appointment.findOne({ _id: appointmentId, tenantId });

    if (!appointment) {
      // This error means the appointment doesn't exist OR it belongs to another tenant.
      return NextResponse.json({ success: false, message: 'Appointment not found.' }, { status: 404 });
    }
    
    // Your existing business logic remains the same
    if (appointment.status !== 'Checked-In') {
        return NextResponse.json({ success: false, message: `Cannot bill. Appointment status is already "${appointment.status}".` }, { status: 409 }); // Use 409 Conflict for state errors
    }

    // --- Perform Update ---
    appointment.status = 'Billed';
    appointment.amount = finalTotal; // Save the final amount to the appointment
    await appointment.save();

    return NextResponse.json({ success: true, message: 'Appointment has been billed.', appointment });

  } catch (err: any) {
    console.error("API Error billing appointment:", err);
    return NextResponse.json({ success: false, message: err.message || 'Billing failed.' }, { status: 500 });
  }
}