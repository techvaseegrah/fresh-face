// app/api/stylists/available/route.ts
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Stylist from '@/models/Stylist';
import Appointment from '@/models/appointment';
import ServiceItem from '@/models/ServiceItem'; // Changed from Service to ServiceItem
import { addMinutes, areIntervalsOverlapping } from 'date-fns';

export async function GET(req: Request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const time = searchParams.get('time');
    const serviceIds = searchParams.getAll('serviceIds');

    if (!date || !time || serviceIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Date, time, and at least one service are required.' },
        { status: 400 }
      );
    }

    // === FIX: Use ServiceItem instead of Service ===
    const servicesForDuration = await ServiceItem.find({ 
      _id: { $in: serviceIds } 
    }).select('duration').lean(); // Use 'duration' field from ServiceItem

    if (servicesForDuration.length !== serviceIds.length) {
      throw new Error("One or more selected services could not be found.");
    }

    // Calculate total duration using 'duration' field (not 'durationMinutes')
    const totalDuration = servicesForDuration.reduce((sum, service) => sum + service.duration, 0);

    const newAppointmentStart = new Date(`${date}T${time}`);
    const newAppointmentEnd = addMinutes(newAppointmentStart, totalDuration);

    // Find conflicting appointments
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await Appointment.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['Appointment', 'Checked-In', 'Billed'] }
    }).populate('serviceIds', 'duration').select('stylistId serviceIds date time').lean();

    // Check for busy stylists
    const busyStylistIds = new Set<string>();

    for (const existingApt of existingAppointments) {
      const existingAptDuration = (existingApt.serviceIds as any[]).reduce(
        (sum, service) => sum + (service.duration || 60), 0
      );
      
      const existingAptStart = new Date(
        new Date(existingApt.date).toISOString().split('T')[0] + `T${existingApt.time}`
      );
      const existingAptEnd = addMinutes(existingAptStart, existingAptDuration);
      
      const isOverlapping = areIntervalsOverlapping(
        { start: newAppointmentStart, end: newAppointmentEnd },
        { start: existingAptStart, end: existingAptEnd },
        { inclusive: false }
      );

      if (isOverlapping && existingApt.stylistId) {
        busyStylistIds.add(existingApt.stylistId.toString());
      }
    }
    
    // === ALSO CHECK STYLIST AVAILABILITY STATUS ===
    const availableStylists = await Stylist.find({
      _id: { $nin: Array.from(busyStylistIds) },
      isAvailable: true // Only get available stylists
    }).select('name experience specialization').lean();

    // Format for frontend
    const formattedStylists = availableStylists.map(stylist => ({
      _id: stylist._id,
      id: stylist._id.toString(),
      name: stylist.name,
      experience: stylist.experience,
      specialization: stylist.specialization
    }));

    return NextResponse.json({ 
      success: true, 
      stylists: formattedStylists 
    });

  } catch (error: any) {
    console.error("API Error fetching available stylists:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}