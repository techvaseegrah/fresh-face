import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Appointment from '@/models/Appointment';
import Customer from '@/models/customermodel';
import mongoose from 'mongoose';
import { decrypt } from '@/lib/crypto';
import Setting from '@/models/Setting';

// --- HELPER FUNCTION (Unchanged) ---
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
 * It prioritizes due callbacks, fetches a paginated list of lapsed clients, and uses a configurable setting.
 */
export async function GET(request: Request) {
  // 1. --- AUTHENTICATION & SETUP (Unchanged) ---
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();
    const tenantId = new mongoose.Types.ObjectId(session.user.tenantId);
    const now = new Date();

    // --- NEW: PARSE PAGINATION PARAMETERS FROM THE URL ---
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10); // A smaller default is better for pagination
    const skip = (page - 1) * limit;

    // 2. --- PRIORITY 1: DUE CALLBACKS (Unchanged) ---
    // Note: Callbacks are high-priority and not paginated. They are always shown first.
    const dueCallbacks = await Customer.find({
      tenantId,
      telecallingStatus: 'Scheduled',
      callbackDate: { $lte: now },
    }).select('_id').lean();

    const dueCallbackIds = dueCallbacks.map(c => c._id);

    // 3. --- AGGREGATION FOR PRIORITY 1 (Unchanged) ---
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

    // 4. --- AGGREGATION FOR PRIORITY 2: LAPSED CLIENTS (UPDATED WITH PAGINATION) ---
    const setting = await Setting.findOne({ tenantId, key: 'telecallingDays' }).lean();
    const telecallingRange = setting?.value || { from: 30, to: 60 }; 
    const newerCutoffDate = new Date();
    newerCutoffDate.setDate(now.getDate() - telecallingRange.from);
    const olderCutoffDate = new Date();
    olderCutoffDate.setDate(now.getDate() - telecallingRange.to);
    const exclusionIds = dueCallbackIds;

    const aggregationPipeline: mongoose.PipelineStage[] = [
      // These first stages build the initial list of potential candidates
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
          lastVisitDate: { $lte: newerCutoffDate, $gte: olderCutoffDate },
          "customerInfo.doNotDisturb": { $ne: true },
          "customerInfo.telecallingStatus": { $nin: ["Scheduled", "Uninterested"] }
      }},
      
      // --- NEW: Use $facet for efficient pagination and counting ---
      {
        $facet: {
          // Branch 1: Get the metadata (total count of all matching documents)
          metadata: [
            { $count: "total" }
          ],
          // Branch 2: Get the actual data for the current page
          data: [
            { $skip: skip },
            { $limit: limit },
            // The final projection goes inside this data branch
            { $project: {
                _id: "$customerInfo._id",
                searchableName: "$customerInfo.searchableName",
                phoneNumber: "$customerInfo.phoneNumber",
                lastVisitDate: "$lastVisitDate",
                isCallback: { $literal: false },
                lastServiceNames: { $map: { input: "$lastServiceDetails", as: "service", in: "$$service.name" } },
                lastStylistName: { $ifNull: ["$lastStylistInfo.name", "N/A"] },
                lastBillAmount: { $ifNull: ["$lastFinalAmount", 0] },
            }}
          ]
        }
      }
    ];

    const lapsedResults = await Appointment.aggregate(aggregationPipeline);

    // The result from $facet is an array with one object inside, structured like: [{ metadata: [ { total: X } ], data: [ ... ] }]
    const lapsed = lapsedResults[0].data;
    const totalLapsed = lapsedResults[0].metadata[0]?.total || 0;
    const totalPages = Math.ceil(totalLapsed / limit);

    // 5. --- COMBINE, DECRYPT, AND SEND RESPONSE ---
    // We combine the non-paginated priority callbacks with the paginated lapsed clients.
    const combinedList = [...callbacks, ...lapsed];
    const decryptedCustomers = combinedList.map(decryptCustomer);

    // --- NEW: Return the queue AND the pagination metadata in the response ---
    return NextResponse.json({
      queue: decryptedCustomers,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalResults: totalLapsed,
        limit: limit,
        priorityCount: callbacks.length // Optional: Useful for the UI
      }
    });

  } catch (error) {
    console.error('Failed to fetch telecalling queue:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}