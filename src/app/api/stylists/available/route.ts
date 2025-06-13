import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Stylist from '@/models/stylist';
import Appointment from '@/models/appointment';
import Service from '@/models/service'; // ===> THIS IS THE MISSING LINE <===
import { addMinutes, areIntervalsOverlapping } from 'date-fns';

// ===================================================================================
//  API ENDPOINT: GET /api/stylists/available
// ===================================================================================
export async function GET(req: Request) {
  try {
    await connectToDatabase();

    // --- 1. Extract and Validate Query Parameters ---
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const time = searchParams.get('time');
    const serviceIds = searchParams.getAll('serviceIds'); // Gets all 'serviceIds' params as an array

    if (!date || !time || serviceIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Date, time, and at least one service are required.' },
        { status: 400 }
      );
    }

    // --- 2. Calculate the Total Duration for the New Appointment ---
    const servicesForDuration = await Service.find({ _id: { $in: serviceIds } }).select('durationMinutes').lean();
    if (servicesForDuration.length !== serviceIds.length) {
        throw new Error("One or more selected services could not be found.");
    }
    const totalDuration = servicesForDuration.reduce((sum, service) => sum + service.durationMinutes, 0);

    const newAppointmentStart = new Date(`${date}T${time}`);
    const newAppointmentEnd = addMinutes(newAppointmentStart, totalDuration);

    // --- 3. Find All Potentially Conflicting Appointments for the Day ---
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await Appointment.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['Scheduled', 'Checked-In', 'Billed'] }
    }).populate('serviceIds', 'durationMinutes').select('stylistId serviceIds date time').lean();

    // --- 4. Identify All Busy Stylists by Checking for Time Overlaps ---
    const busyStylistIds = new Set<string>();

    for (const existingApt of existingAppointments) {
      const existingAptDuration = (existingApt.serviceIds as any[]).reduce((sum, service) => sum + service.durationMinutes, 0) || 60;
      const existingAptStart = new Date(new Date(existingApt.date).toISOString().split('T')[0] + `T${existingApt.time}`);
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
    
    // --- 5. Find All Stylists Who Are NOT in the Busy List ---
    const availableStylists = await Stylist.find({
      _id: { $nin: Array.from(busyStylistIds) }
    }).select('name').lean();

    return NextResponse.json({ success: true, stylists: availableStylists });

  } catch (error: any) {
    console.error("API Error fetching available stylists:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}