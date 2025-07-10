// /lib/data/ebReportData.ts

import dbConnect from "@/lib/dbConnect";
import EBReading from "@/models/ebReadings";
import Appointment from "@/models/Appointment";

export interface EbReportData {
  _id: string;
  date: string;
  startUnits?: number;
  endUnits?: number;
  unitsConsumed?: number;
  costPerUnit?: number;
  totalCost?: number;
  appointmentCount: number;
}

export async function getEbReportData(
  startDate: Date,
  endDate: Date
): Promise<EbReportData[]> {
  await dbConnect();

  const [ebReadings, appointments] = await Promise.all([
    EBReading.find({
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 'asc' }).lean(),

    Appointment.find({
      appointmentDateTime: { $gte: startDate, $lte: endDate },
    }).select('appointmentDateTime').lean()
  ]);
  
  const appointmentCountsByDate = new Map<string, number>();
  appointments.forEach(apt => {
    const dateKey = apt.appointmentDateTime.toISOString().split('T')[0];
    appointmentCountsByDate.set(dateKey, (appointmentCountsByDate.get(dateKey) || 0) + 1);
  });
  
  // --- THIS IS THE CORRECTED LOGIC ---

  // 1. Define the start of the day immediately following our range
  const startOfNextDay = new Date(endDate);
  startOfNextDay.setDate(endDate.getDate() + 1);
  startOfNextDay.setHours(0, 0, 0, 0); // Set to midnight

  // 2. Define the end of that same day
  const endOfNextDay = new Date(startOfNextDay);
  endOfNextDay.setHours(23, 59, 59, 999);

  // 3. Query for any reading that falls within that 24-hour window
  const nextDayReading = await EBReading.findOne({ 
      date: { 
          $gte: startOfNextDay, 
          $lte: endOfNextDay
      }
  }).select('morningUnits').lean();
  
  // ======================================

  return ebReadings.map((doc, index) => {
    let endUnits: number | undefined;
    if (index < ebReadings.length - 1) {
      endUnits = ebReadings[index + 1].morningUnits;
    } else {
      endUnits = nextDayReading?.morningUnits;
    }
    
    const dateKey = new Date(doc.date).toISOString().split('T')[0];
    const appointmentCount = appointmentCountsByDate.get(dateKey) || 0;

    return {
      _id: doc._id.toString(),
      date: new Date(doc.date).toISOString(),
      startUnits: doc.morningUnits,
      endUnits: endUnits,
      unitsConsumed: doc.unitsConsumed,
      costPerUnit: doc.costPerUnit,
      totalCost: doc.totalCost,
      appointmentCount: appointmentCount,
    };
  });
}