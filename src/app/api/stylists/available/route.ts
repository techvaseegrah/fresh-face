// app/api/stylists/available/route.ts

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Stylist from '@/models/stylist';
import Staff from '@/models/staff'; // IMPORTANT: Import the Staff model
import Appointment from '@/models/appointment';
import Service from '@/models/service';
import { addMinutes, areIntervalsOverlapping } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    // --- 1. Extract and Validate Query Parameters ---
    const { searchParams } = req.nextUrl;
    const date = searchParams.get('date');
    const time = searchParams.get('time');
    const serviceIds = searchParams.getAll('serviceIds');

    if (!date || !time || serviceIds.length === 0) {
      return NextResponse.json({ success: false, message: 'Date, time, and at least one service are required.' }, { status: 400 });
    }

    // --- 2. Calculate Total Duration ---
    const servicesForDuration = await Service.find({ _id: { $in: serviceIds } }).select('durationMinutes').lean();
    if (servicesForDuration.length !== serviceIds.length) {
      throw new Error("One or more selected services could not be found.");
    }
    const totalDuration = servicesForDuration.reduce((sum, service) => sum + service.durationMinutes, 0);
    const newAppointmentStart = new Date(`${date}T${time}`);
    const newAppointmentEnd = addMinutes(newAppointmentStart, totalDuration);

    // --- 3. Find Conflicting Appointments ---
    const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await Appointment.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['Scheduled', 'Checked-In', 'Billed'] }
    }).populate('serviceIds', 'durationMinutes').select('stylistId serviceIds date time').lean();

    // --- 4. Identify Busy Stylists ---
    const busyStylistIds = new Set<string>();
    for (const existingApt of existingAppointments) {
      if (!existingApt.stylistId) continue;
      const existingAptDuration = (existingApt.serviceIds as any[]).reduce((sum, service) => sum + service.durationMinutes, 0) || 60;
      const existingAptStart = new Date(new Date(existingApt.date).toISOString().split('T')[0] + `T${existingApt.time}`);
      const existingAptEnd = addMinutes(existingAptStart, existingAptDuration);
      if (areIntervalsOverlapping({ start: newAppointmentStart, end: newAppointmentEnd }, { start: existingAptStart, end: existingAptEnd })) {
        busyStylistIds.add(existingApt.stylistId.toString());
      }
    }
    
    // ======================================================================
    // --- 5. Find All Stylists Who Are NOT Busy and POPULATE their name ---
    // ======================================================================
    const availableStylistDocs = await Stylist.find({
      _id: { $nin: Array.from(busyStylistIds) } // Find stylists NOT in the busy list
    })
    .populate({
        path: 'staffInfo',           // The field in the Stylist model we want to populate
        model: Staff,                // Use the imported Staff model
        select: 'name',              // We only need the name
        match: { status: 'active' }  // Make sure their staff profile is active
    })
    .lean();

    // Filter out any whose staff profile was inactive
    const activeAndAvailableStylists = availableStylistDocs.filter(stylist => stylist.staffInfo);

    return NextResponse.json({ success: true, stylists: activeAndAvailableStylists });

  } catch (error: any) {
    console.error("API Error fetching available stylists:", error);
    return NextResponse.json({ success: false, message: error.message || "An unknown server error occurred." }, { status: 500 });
  }
}