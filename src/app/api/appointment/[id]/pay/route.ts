// app/api/appointment/[id]/pay/route.ts - MULTI-TENANT REFACTORED VERSION

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import Stylist from '@/models/Stylist';
import Customer from '@/models/customermodel';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import mongoose from 'mongoose';
import { getTenantIdOrBail } from '@/lib/tenant';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// ===================================================================================
//  POST: Handler to process payment for a billed appointment
// ===================================================================================
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // --- MT: Get tenantId and check permissions first ---
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;

  const session = await getServerSession(authOptions);
  // Assuming payment requires update permissions
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.APPOINTMENTS_UPDATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const appointmentId = params.id;
  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    return NextResponse.json({ success: false, message: 'Invalid Appointment ID.' }, { status: 400 });
  }
  
  const { billDetails } = await req.json();
  if (!billDetails || !billDetails.items) {
    return NextResponse.json({ success: false, message: 'Bill details are required to process payment.' }, { status: 400 });
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
    if (appointment.status !== 'Billed') {
        throw new Error(`Cannot process payment. Status is "${appointment.status}".`);
    }

    // Your existing loyalty point calculation logic is good
    const pointsToAward = billDetails?.items?.filter((item: any) => item.itemType === 'service').length || 0;

    // --- Perform ALL Database Updates in a Transaction ---
    
    // 1. Update Appointment Status
    appointment.status = 'Paid';
    await appointment.save({ session: dbSession });

    // 2. Release the Stylist (if one is assigned)
    if (appointment.stylistId) {
        // --- MT: Securely update the stylist, ensuring they belong to the tenant ---
        await Stylist.updateOne(
          { _id: appointment.stylistId, tenantId: tenantId },
          { availabilityStatus: 'Available', currentAppointmentId: null },
          { session: dbSession }
        );
    }
    
    // 3. Award Loyalty Points to the Customer (if any)
    if (pointsToAward > 0) {
      // --- MT: Securely update the customer, ensuring they belong to the tenant ---
      await Customer.updateOne(
        { _id: appointment.customerId, tenantId: tenantId },
        { $inc: { loyaltyPoints: pointsToAward } },
        { session: dbSession }
      );
      
      // 4. Log the Loyalty Transaction
      // --- MT: Add tenantId to the new loyalty transaction document ---
      await LoyaltyTransaction.create([{
        tenantId: tenantId,
        customerId: appointment.customerId,
        points: pointsToAward,
        type: 'Credit',
        reason: `Earned from ${pointsToAward} service(s) in appointment`,
        relatedAppointmentId: appointment._id,
      }], { session: dbSession });
    }
    
    await dbSession.commitTransaction();

    return NextResponse.json({ success: true, message: `Payment complete. ${pointsToAward} points awarded. Stylist is now available.` });

  } catch (err: any) {
    await dbSession.abortTransaction();
    console.error('API Error during payment:', err);
    return NextResponse.json({ success: false, message: err.message || 'Payment processing failed.' }, { status: 500 });
  } finally {
    dbSession.endSession();
  }
}