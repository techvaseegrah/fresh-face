// lib/data/ebReportData.ts

import dbConnect from "@/lib/dbConnect";
// --- CORRECTED IMPORT based on your schema file ---
import EBReading from "@/models/ebReadings"; 

// This interface defines the shape of the data we'll work with
export interface EbReportData {
  _id: string;
  date: string;
  startUnits?: number;
  endUnits?: number;
  unitsConsumed?: number;
  costPerUnit?: number;
  totalCost?: number;
}

/**
 * Fetches EB Reading records from the database within a specified date range.
 * @param {Date} startDate The start of the date range.
 * @param {Date} endDate The end of the date range.
 * @returns {Promise<EbReportData[]>} A promise that resolves to an array of EB reading objects.
 */
export async function getEbReportData(
  startDate: Date,
  endDate: Date
): Promise<EbReportData[]> {
  await dbConnect();

  // --- USE THE CORRECT MODEL NAME 'EBReading' ---
  const readings: Array<Record<string, any>> = await EBReading.find({
    date: {
      $gte: startDate,
      $lte: endDate,
    },
  })
  .sort({ date: 1 }) // Sort the results chronologically
  .lean(); // .lean() makes the query faster and returns plain JS objects

  // Map the raw documents to match our interface, ensuring data types are correct
  return readings.map(doc => {
    return {
      _id: doc._id.toString(),
      date: new Date(doc.date).toISOString(), // Standardize date format
      startUnits: doc.startUnits,
      endUnits: doc.endUnits,
      unitsConsumed: doc.unitsConsumed,
      costPerUnit: doc.costPerUnit,
      totalCost: doc.totalCost,
    };
  });
}