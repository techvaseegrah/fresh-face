import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Appointment from '@/models/Appointment';
import Customer from '@/models/customermodel';
import mongoose from 'mongoose';
import { decrypt } from '@/lib/crypto';
import Setting from '@/models/Setting'; // 1. IMPORT the Setting model

// --- HELPER FUNCTION ---
// A safe decryption utility that prevents one bad record from crashing the entire API.
const decryptCustomer = (customer: any) => {
  try {
    return {
      ...customer,
      phoneNumber: customer.phoneNumber ? decrypt(customer.phoneNumber) : 'MISSING_PHONE',
    };
  } catch (error) {
    console.error(`Failed to decrypt phone for customer ${customer._id}:`, error);
    return {
      ...customer,
      phoneNumber: 'DECRYPTION_ERROR',
    };
  }
};

/**
 * @description API endpoint to generate an intelligent, prioritized telecalling queue.
 * It prioritizes due callbacks over general lapsed clients and uses a configurable setting.
 */
export async function GET(request: Request) {
  // 1. --- AUTHENTICATION & SETUP ---
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();
    const tenantId = new mongoose.Types.ObjectId(session.user.tenantId);
    const now = new Date();

    // 2. --- GATHER IDs FOR PRIORITY 1: DUE CALLBACKS ---
    const dueCallbacks = await Customer.find({
      tenantId,
      telecallingStatus: 'Scheduled',
      callbackDate: { $lte: now },
    }).select('_id').lean();

    const dueCallbackIds = dueCallbacks.map(c => c._id);

    // 3. --- EXECUTE AGGREGATION FOR PRIORITY 1 ---
    let callbacks: any[] = [];
    if (dueCallbackIds.length > 0) {
      callbacks = await Appointment.aggregate([
        { $match: { customerId: { $in: dueCallbackIds } } },
        { $sort: { appointmentDateTime: -1 } },
        { $group: { _id: "$customerId", lastAppointment: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$lastAppointment" } },
        { $lookup: { from: 'serviceitems', localField: 'serviceIds', foreignField: '_id', as: 'lastServiceDetails' } },
        { $lookup: { from: 'staffs', localField: 'stylistId', foreignField: '_id', as: 'lastStylistInfo' } },
        { $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "customerInfo" } },
        { $unwind: "$customerInfo" },
        { $unwind: { path: '$lastStylistInfo', preserveNullAndEmptyArrays: true } },
        { $project: {
            _id: "$customerInfo._id",
            searchableName: "$customerInfo.searchableName",
            phoneNumber: "$customerInfo.phoneNumber",
            lastVisitDate: "$appointmentDateTime",
            isCallback: { $literal: true },
            lastServiceNames: { $map: { input: "$lastServiceDetails", as: "service", in: "$$service.name" } },
            lastStylistName: { $ifNull: ["$lastStylistInfo.name", "N/A"] },
            lastBillAmount: { $ifNull: ["$finalAmount", 0] },
        }}
      ]);
    }

    // 4. --- EXECUTE AGGREGATION FOR PRIORITY 2: LAPSED CLIENTS ---

    // 2. REPLACE the hardcoded value with a dynamic database lookup
    const setting = await Setting.findOne({ tenantId, key: 'telecallingDays' }).lean();
    // Use the value from the database, or fall back to a safe default if it's not set.
    const lapsedClientDays = setting?.value || 30; 
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - lapsedClientDays);
    
    const exclusionIds = dueCallbackIds;

    const lapsed = await Appointment.aggregate([
      { $match: { 
          tenantId, 
          status: "Paid", 
          appointmentDateTime: { $exists: true }, 
          customerId: { $nin: exclusionIds }
      }},
      { $sort: { appointmentDateTime: -1 } },
      { $group: {
          _id: "$customerId",
          lastVisitDate: { $first: "$appointmentDateTime" },
          lastServiceIds: { $first: "$serviceIds" },
          lastStylistId: { $first: "$stylistId" },
          lastFinalAmount: { $first: "$finalAmount" },
      }},
      { $lookup: { from: "customers", localField: "_id", foreignField: "_id", as: "customerInfo" } },
      { $unwind: "$customerInfo" },
      { $lookup: { from: 'serviceitems', localField: 'lastServiceIds', foreignField: '_id', as: 'lastServiceDetails' } },
      { $lookup: { from: 'staffs', localField: 'lastStylistId', foreignField: '_id', as: 'lastStylistInfo' } },
      { $unwind: { path: '$lastStylistInfo', preserveNullAndEmptyArrays: true } },
      { $match: { 
          lastVisitDate: { $lt: thirtyDaysAgo }, // This now uses the dynamic date
          "customerInfo.doNotDisturb": { $ne: true },
          "customerInfo.telecallingStatus": "Pending"
      }},
      { $project: {
          _id: "$customerInfo._id",
          searchableName: "$customerInfo.searchableName",
          phoneNumber: "$customerInfo.phoneNumber",
          lastVisitDate: "$lastVisitDate",
          isCallback: { $literal: false },
          lastServiceNames: { $map: { input: "$lastServiceDetails", as: "service", in: "$$service.name" } },
          lastStylistName: { $ifNull: ["$lastStylistInfo.name", "N/A"] },
          lastBillAmount: { $ifNull: ["$lastFinalAmount", 0] },
      }},
      { $limit: 100 },
    ]);

    // 5. --- COMBINE, DECRYPT, AND SEND RESPONSE ---
    const combinedList = [...callbacks, ...lapsed];
    const decryptedCustomers = combinedList.map(decryptCustomer);

    return NextResponse.json({ queue: decryptedCustomers });

  } catch (error) {
    console.error('Failed to fetch telecalling queue:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}