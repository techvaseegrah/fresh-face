import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
// Make sure you are importing your updated Stylist model
import Stylist from '@/models/Stylist'; 
import mongoose from 'mongoose';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const appointmentId = params.id;

  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    return NextResponse.json({ success: false, message: 'Invalid Appointment ID.' }, { status: 400 });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await connectToDatabase();

    const appointment = await Appointment.findById(appointmentId).session(session);
    if (!appointment) throw new Error('Appointment not found.');
    if (appointment.status !== 'Scheduled') throw new Error(`Cannot check-in. Status is already "${appointment.status}".`);

    const stylist = await Stylist.findById(appointment.stylistId).session(session);
    if (!stylist) throw new Error('Assigned stylist not found.');

    // --- CORRECTION 1: Check `isAvailable` instead of `availabilityStatus` ---
    // The error message is also updated for clarity.
    if (!stylist.isAvailable) {
      throw new Error(`Stylist ${stylist.name} is currently not available.`);
    }

    // --- CORRECTION 2: Perform updates using the properties from your Stylist model ---
    appointment.status = 'Checked-In';
    stylist.isAvailable = false; // Set the boolean to false
    stylist.currentAppointmentId = appointment._id;
    stylist.lastAvailabilityChange = new Date(); // Update the change timestamp

    await appointment.save({ session });
    await stylist.save({ session });
    
    await session.commitTransaction();

    return NextResponse.json({ success: true, message: 'Customer Checked In. Stylist marked as Busy.' });

  } catch (err: any) {
    await session.abortTransaction();
    return NextResponse.json({ success: false, message: err.message || 'Check-in failed.' }, { status: 500 });
  } finally {
    session.endSession();
  }
}