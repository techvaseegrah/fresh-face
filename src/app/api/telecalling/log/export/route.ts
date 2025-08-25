import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import TelecallingLog from '@/models/TelecallingLog';
import mongoose from 'mongoose';
import { decrypt } from '@/lib/crypto';

/**
 * @description Dedicated API endpoint to retrieve ALL telecalling logs for exporting.
 * This route is intentionally NOT paginated. It fetches the entire dataset
 * that matches the given filters (date range, outcome).
 */
export async function GET(request: Request) {
  // 1. --- AUTHENTICATION ---
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. --- PARSE QUERY PARAMETERS (No Pagination) ---
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const outcome = searchParams.get('outcome');

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ message: 'startDate and endDate are required parameters' }, { status: 400 });
    }

    await dbConnect();
    const tenantId = new mongoose.Types.ObjectId(session.user.tenantId);

    // 3. --- BUILD AGGREGATION PIPELINE (No Pagination) ---
    const startDate = new Date(startDateParam);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(endDateParam);
    endDate.setHours(23, 59, 59, 999);

    const matchStage: any = {
      tenantId: tenantId,
      createdAt: { $gte: startDate, $lte: endDate },
    };

    if (outcome && outcome !== 'All') {
      matchStage.outcome = outcome;
    }

    const aggregationPipeline: mongoose.PipelineStage[] = [
      // Stage 1: Match the logs based on filters
      { $match: matchStage },
      { $sort: { createdAt: -1 } },

      // Stage 2: Get Customer Details
      { $lookup: { from: 'customers', localField: 'customerId', foreignField: '_id', as: 'customerDetails' } },
      { $unwind: { path: '$customerDetails', preserveNullAndEmptyArrays: true } },

      // Stage 3: Get Caller Details
      { $lookup: { from: 'users', localField: 'callerId', foreignField: '_id', as: 'callerDetails' } },
      { $unwind: { path: '$callerDetails', preserveNullAndEmptyArrays: true } },

      // Stage 4: Dynamically find the last completed appointment for the customer
      {
        $lookup: {
          from: 'appointments',
          let: { customerId: '$customerId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$customerId', '$$customerId'] }, status: { $in: ['Paid', 'Completed'] } } },
            { $sort: { appointmentDateTime: -1 } },
            { $limit: 1 }
          ],
          as: 'lastAppointment'
        }
      },
      { $unwind: { path: '$lastAppointment', preserveNullAndEmptyArrays: true } },

      // Stage 5: Project the final data structure. No $facet, $skip, or $limit.
      {
        $project: {
          _id: 1,
          clientName: '$customerDetails.searchableName',
          phoneNumber: '$customerDetails.phoneNumber',
          outcome: 1,
          notes: 1,
          callerName: { $ifNull: ['$callerDetails.name', 'N/A'] },
          createdAt: 1,
          lastVisitDate: '$lastAppointment.appointmentDateTime',
        },
      },
    ];

    // This query fetches ALL matching logs from the database.
    const allLogs = await TelecallingLog.aggregate(aggregationPipeline);
    
    // 4. --- DECRYPT SENSITIVE DATA ---
    const decryptedLogs = allLogs.map(log => {
        try {
            return { ...log, phoneNumber: log.phoneNumber ? decrypt(log.phoneNumber) : 'N/A' };
        } catch (e) {
            return { ...log, phoneNumber: 'Decryption Error' };
        }
    });

    // 5. --- SEND RESPONSE ---
    // Return a simple flat array of all the logs.
    return NextResponse.json(decryptedLogs);

  } catch (error) {
    console.error('Failed to fetch telecalling logs for export:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}