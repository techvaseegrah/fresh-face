// app/api/dashboard/upcoming-appointments/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const appointments = await Appointment.find({
      date: { $gte: startOfDay, $lt: endOfDay }
    })
    .populate('customerId', 'name')
    .sort({ time: 1 })
    .limit(10)
    .lean();

    const formattedAppointments = appointments.map(apt => ({
      id: apt._id.toString(),
      customerName: apt.customerId?.name || 'Unknown Customer',
      service: apt.style,
      time: apt.time,
      stylist: apt.stylist || 'Not assigned',
      status: apt.status
    }));

    return NextResponse.json({ success: true, appointments: formattedAppointments });
  } catch (error) {
    console.error('Error fetching upcoming appointments:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}