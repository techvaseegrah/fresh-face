import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Appointment from '@/models/Appointment';
import TelecallingLog from '@/models/TelecallingLog';
import Customer from '@/models/customermodel';
import mongoose from 'mongoose';
import { decrypt } from '@/lib/crypto';

// Helper function to decrypt customer data safely
const decryptCustomer = (customer: any) => {
  try {
    return {
      ...customer,
      phoneNumber: customer.phoneNumber ? decrypt(customer.phoneNumber) : 'MISSING_PHONE',
    };
  } catch (error) {
    console.error(`Failed to decrypt phone for customer ${customer.customerId || customer._id}:`, error);
    return {
      ...customer,
      phoneNumber: 'DECRYPTION_ERROR',
    };
  }
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();
    const tenantId = new mongoose.Types.ObjectId(session.user.tenantId);

    // Define date range for "today"
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 1. Get IDs for today's scheduled callbacks
    const callbackCustomerIds = await TelecallingLog.distinct('customerId', {
      tenantId,
      callbackDate: { $gte: todayStart, $lte: todayEnd },
    });

    // 2. Get IDs for customers with a "final" outcome today (excluding scheduling outcomes)
    const contactedTodayIds = await TelecallingLog.distinct('customerId', {
        tenantId,
        createdAt: { $gte: todayStart, $lte: todayEnd },
        outcome: { $nin: ['Specific Date', 'Will Come Later'] } 
    });
    
    const contactedTodayObjectIds = contactedTodayIds.map(id => new mongoose.Types.ObjectId(id));

    // --- PRIORITY 1: FETCH FULL DETAILS FOR TODAY'S UNCONTACTED CALLBACKS ---
    let callbacks: any[] = [];
    if (callbackCustomerIds.length > 0) {
      const priorityCustomerObjectIds = callbackCustomerIds.map(id => new mongoose.Types.ObjectId(id));
      
      const uncontactedCallbackIds = priorityCustomerObjectIds.filter(
        id => !contactedTodayObjectIds.some(contactedId => contactedId.equals(id))
      );

      if (uncontactedCallbackIds.length > 0) {
        // Run a dedicated aggregation for these priority clients to get their last appointment details
        callbacks = await Appointment.aggregate([
          { $match: { customerId: { $in: uncontactedCallbackIds } } },
          { $sort: { appointmentDateTime: -1 } },
          { $group: { _id: "$customerId", lastAppointment: { $first: "$$ROOT" } } },
          { $replaceRoot: { newRoot: "$lastAppointment" } },
          { $lookup: { from: 'serviceitems', localField: 'serviceIds', foreignField: '_id', as: 'lastServiceDetails' } },
          { $lookup: { from: 'staffs', localField: 'stylistId', foreignField: '_id', as: 'lastStylistInfo' } },
          { $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "customerInfo" } },
          { $unwind: "$customerInfo" },
          { $unwind: { path: '$lastStylistInfo', preserveNullAndEmptyArrays: true } },
          { $project: {
              _id: 0, customerId: "$customerId", lastVisitDate: "$appointmentDateTime", searchableName: "$customerInfo.searchableName",
              phoneNumber: "$customerInfo.phoneNumber", isCallback: true,
              lastServiceNames: { $map: { input: "$lastServiceDetails", as: "service", in: "$$service.name" } },
              lastStylistName: { $ifNull: ["$lastStylistInfo.name", "N/A"] },
              lastBillAmount: { $ifNull: ["$finalAmount", 0] },
          }}
        ]);
      }
    }

    // --- PRIORITY 2: FETCH LAPSED CLIENTS ---
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // The exclusion list contains ALL today's callbacks and ALL already contacted clients
    const allExclusionIds = [...new Set([...callbackCustomerIds.map(id => id.toString()), ...contactedTodayIds.map(id => id.toString())])].map(id => new mongoose.Types.ObjectId(id));

    const lapsed = await Appointment.aggregate([
      { $match: { tenantId, status: "Paid", appointmentDateTime: { $exists: true }, customerId: { $nin: allExclusionIds } } },
      { $sort: { appointmentDateTime: -1 } },
      { $group: {
          _id: "$customerId", lastVisitDate: { $first: "$appointmentDateTime" },
          lastServiceIds: { $first: "$serviceIds" }, lastStylistId: { $first: "$stylistId" },
          lastFinalAmount: { $first: "$finalAmount" },
      }},
      { $match: { lastVisitDate: { $lt: thirtyDaysAgo } } },
      { $lookup: { from: 'serviceitems', localField: 'lastServiceIds', foreignField: '_id', as: 'lastServiceDetails' } },
      { $lookup: { from: 'staffs', localField: 'lastStylistId', foreignField: '_id', as: 'lastStylistInfo' } },
      { $lookup: { from: "customers", localField: "_id", foreignField: "_id", as: "customerInfo" } },
      { $unwind: "$customerInfo" },
      { $unwind: { path: '$lastStylistInfo', preserveNullAndEmptyArrays: true } },
      { $match: { "customerInfo.doNotDisturb": { $ne: true } } },
      { $project: {
          _id: 0, customerId: "$_id", lastVisitDate: 1, searchableName: "$customerInfo.searchableName",
          phoneNumber: "$customerInfo.phoneNumber", isCallback: { $literal: false },
          lastServiceNames: { $map: { input: "$lastServiceDetails", as: "service", in: "$$service.name" } },
          lastStylistName: { $ifNull: ["$lastStylistInfo.name", "N/A"] },
          lastBillAmount: { $ifNull: ["$lastFinalAmount", 0] },
      }},
      { $limit: 20 },
    ]);

    // --- COMBINE, DECRYPT, AND SEND RESPONSE ---
    const combinedList = [...callbacks, ...lapsed];
    const decryptedCustomers = combinedList.map(decryptCustomer);

    return NextResponse.json(decryptedCustomers);

  } catch (error) {
    console.error('Failed to fetch telecalling queue:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}