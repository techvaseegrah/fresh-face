// /lib/dayClosingGuard.ts

import DayEndReport from '@/models/DayEndReport'; // Use your existing model
import mongoose from 'mongoose';

// A simple cache to improve performance by reducing database lookups.
const latestClosingCache = new Map<string, Date | null>();

/**
 * Checks if a given date is locked by a *completed* day-end report.
 * @param dateToCheck The date of the invoice (e.g., invoice.createdAt).
 * @param tenantId The tenant ID.
 * @returns {Promise<boolean>} - True if the date is locked, false otherwise.
 */
export async function isDateLocked(dateToCheck: Date, tenantId: string | mongoose.Types.ObjectId): Promise<boolean> {
  const tenantIdStr = tenantId.toString();
  let latestClosingDate: Date | null | undefined = latestClosingCache.get(tenantIdStr);

  if (latestClosingDate === undefined) {
    // Find the most recent DayEndReport that has been marked as completed.
    const latestReport = await DayEndReport.findOne({ 
      tenantId,
      isCompleted: true // ✅ This is the key part of your new logic
    }).sort({ closingDate: -1 }).lean();
    
    latestClosingDate = latestReport ? latestReport.closingDate : null;
    latestClosingCache.set(tenantIdStr, latestClosingDate);
  }
  
  if (!latestClosingDate) {
    // No completed reports exist, so nothing is locked.
    return false;
  }

  // Normalize dates to the start of the day for accurate comparison.
  const normalizedDateToCheck = new Date(dateToCheck);
  normalizedDateToCheck.setHours(0, 0, 0, 0);

  const normalizedLatestClosingDate = new Date(latestClosingDate);
  normalizedLatestClosingDate.setHours(0, 0, 0, 0);

  // If the invoice's date is on or before the latest completed closing date, it's locked.
  return normalizedDateToCheck <= normalizedLatestClosingDate;
}

/**
 * Call this function after finalizing a day-end report to ensure the cache is updated.
 * @param tenantId The tenant ID.
 */
export function clearDayClosingCache(tenantId: string | mongoose.Types.ObjectId) {
  latestClosingCache.delete(tenantId.toString());
}