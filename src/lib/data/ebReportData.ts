// src/lib/data/ebReportData.ts (or wherever this file is located)

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

// --- MODIFICATION: Added 'tenantId' as the third argument ---
export async function getEbReportData(
  startDate: Date,
  endDate: Date,
  tenantId: string // The new argument
): Promise<EbReportData[]> {
  await dbConnect();

  const extendedEndDate = new Date(endDate);
  extendedEndDate.setDate(endDate.getDate() + 1);

  const [ebReadings, appointments] = await Promise.all([
    // --- MODIFICATION: Added tenantId to the EBReading query ---
    EBReading.find({
      tenantId: tenantId, // Ensures we only get readings for this tenant
      date: { $gte: startDate, $lte: extendedEndDate },
    }).sort({ date: 'asc' }).lean(),

    // --- MODIFICATION: Added tenantId to the Appointment query ---
    // This assumes your Appointment model also has a 'tenantId' field.
    Appointment.find({
      tenantId: tenantId, // Ensures we only get appointments for this tenant
      appointmentDateTime: { $gte: startDate, $lte: endDate },
    }).select('appointmentDateTime').lean()
  ]);
  
  // The rest of your logic remains the same, as it will now operate
  // on the correctly-scoped data fetched from the database.
  
  const appointmentCountsByDate = new Map<string, number>();
  appointments.forEach(apt => {
    const dateKey = apt.appointmentDateTime.toISOString().split('T')[0];
    appointmentCountsByDate.set(dateKey, (appointmentCountsByDate.get(dateKey) || 0) + 1);
  });
  
  const reportData = ebReadings
    .filter(reading => new Date(reading.date) <= endDate)
    .map((doc, index) => {
      const nextReading = ebReadings[index + 1]; 
      
      const dateKey = new Date(doc.date).toISOString().split('T')[0];
      const appointmentCount = appointmentCountsByDate.get(dateKey) || 0;

      const costUsedForCalculation = nextReading ? nextReading.costPerUnit : undefined;

      return {
        _id: doc._id.toString(),
        date: new Date(doc.date).toISOString(),
        startUnits: doc.morningUnits,
        endUnits: nextReading ? nextReading.morningUnits : undefined,
        unitsConsumed: doc.unitsConsumed,
        costPerUnit: costUsedForCalculation,
        totalCost: doc.totalCost,
        appointmentCount: appointmentCount,
      };
    });

  return reportData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}