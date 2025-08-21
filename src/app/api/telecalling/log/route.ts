import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // Adjust path if necessary
import dbConnect from '@/lib/dbConnect';
import TelecallingLog from '@/models/TelecallingLog';
import Customer from '@/models/customermodel';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || !session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { customerId, outcome, notes, appointmentId, callbackDate } = body;

    // Validate required fields
    if (!customerId || !outcome) {
      return NextResponse.json(
        { message: 'customerId and outcome are required fields' },
        { status: 400 }
      );
    }
    
    // Validate outcome enum
    const validOutcomes = [
      'Appointment Booked', 'Will Come Later', 'Not Interested',
      'No Reminder Call', 'Switched Off', 'Number Busy',
      'Specific Date', 'Complaint'
    ];
    if (!validOutcomes.includes(outcome)) {
        return NextResponse.json({ message: `Invalid outcome: ${outcome}`}, { status: 400 });
    }

    await dbConnect();

    // Create the log entry for every call
    const newLog = await TelecallingLog.create({
      tenantId: new mongoose.Types.ObjectId(session.user.tenantId),
      customerId: new mongoose.Types.ObjectId(customerId),
      callerId: new mongoose.Types.ObjectId(session.user.id),
      outcome,
      notes: notes || '', // Ensure notes is at least an empty string
      appointmentId: appointmentId ? new mongoose.Types.ObjectId(appointmentId) : undefined,
      callbackDate: callbackDate ? new Date(callbackDate) : undefined,
    });

    // If the outcome is "No Reminder Call", update the customer record permanently
    if (outcome === 'No Reminder Call') {
      await Customer.findByIdAndUpdate(customerId, {
        $set: { doNotDisturb: true },
      });
    }

    return NextResponse.json(
      { message: 'Log created successfully', data: newLog },
      { status: 201 }
    );

  } catch (error) {
    console.error('Failed to log telecalling outcome:', error);
    // Provide more detailed error response in development if needed
    if (error instanceof mongoose.Error.CastError) {
        return NextResponse.json({ message: 'Invalid ID format provided.' }, { status: 400 });
    }
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}