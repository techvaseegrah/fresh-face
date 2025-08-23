import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import TelecallingLog from '@/models/TelecallingLog';
import Customer from '@/models/customermodel';
import mongoose from 'mongoose';
import { decrypt } from '@/lib/crypto';

// --- SHARED DEFINITIONS & CONSTANTS ---

interface LogRequestBody {
  customerId: string;
  outcome: string;
  notes?: string;
  appointmentId?: string;
  callbackDate?: string;
}

const VALID_OUTCOMES = [
  'Appointment Booked', 'Will Come Later', 'Not Interested',
  'No Reminder Call', 'Switched Off', 'Number Busy',
  'Specific Date', 'Complaint'
];

// ===================================================================================
// ===                           GET Handler (for Reports)                         ===
// ===================================================================================

/**
 * @description API endpoint to RETRIEVE a list of telecalling logs for reporting.
 * Handles filtering by date range and outcome.
 */
export async function GET(request: Request) {
  // 1. --- AUTHENTICATION ---
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. --- PARSE QUERY PARAMETERS ---
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const outcome = searchParams.get('outcome');

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ message: 'startDate and endDate are required parameters' }, { status: 400 });
    }

    await dbConnect();
    const tenantId = new mongoose.Types.ObjectId(session.user.tenantId);

    // 3. --- BUILD AGGREGATION PIPELINE ---
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

    const aggregationPipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      { $lookup: { from: 'customers', localField: 'customerId', foreignField: '_id', as: 'customerDetails' } },
      { $lookup: { from: 'users', localField: 'callerId', foreignField: '_id', as: 'callerDetails' } },
      { $unwind: { path: '$customerDetails', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$callerDetails', preserveNullAndEmptyArrays: true } },
      { $project: {
          _id: 1,
          clientName: '$customerDetails.searchableName',
          phoneNumber: '$customerDetails.phoneNumber',
          outcome: 1,
          notes: 1,
          callerName: { $ifNull: ['$callerDetails.name', 'N/A'] },
          createdAt: 1,
          lastVisitDate: '$customerDetails.lastVisitDate',
        },
      },
    ];

    const logs = await TelecallingLog.aggregate(aggregationPipeline);
    
    // 4. --- DECRYPT SENSITIVE DATA ---
    const decryptedLogs = logs.map(log => {
        try {
            return { ...log, phoneNumber: log.phoneNumber ? decrypt(log.phoneNumber) : 'N/A' };
        } catch (e) {
            return { ...log, phoneNumber: 'Decryption Error' };
        }
    });

    return NextResponse.json(decryptedLogs);

  } catch (error) {
    console.error('Failed to fetch telecalling logs:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

// ===================================================================================
// ===                         POST Handler (for Logging)                          ===
// ===================================================================================

/**
 * @description API endpoint to CREATE a new telecalling log and update the customer's state.
 */
export async function POST(request: Request) {
  // 1. --- AUTHENTICATION ---
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || !session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. --- PARSE & VALIDATE BODY ---
    const body: LogRequestBody = await request.json();
    const { customerId, outcome, notes, appointmentId, callbackDate } = body;

    if (!customerId || !outcome || !VALID_OUTCOMES.includes(outcome)) {
      return NextResponse.json({ message: 'Valid customerId and outcome are required' }, { status: 400 });
    }
    if ((outcome === 'Specific Date' || outcome === 'Will Come Later') && !callbackDate) {
      return NextResponse.json({ message: 'A callbackDate is required for this outcome' }, { status: 400 });
    }
    if (outcome === 'Appointment Booked' && !appointmentId) {
      return NextResponse.json({ message: 'An appointmentId is required for this outcome' }, { status: 400 });
    }
    
    await dbConnect();

    // 3. --- DETERMINE CUSTOMER'S NEXT STATE ---
    let customerUpdatePayload: any = {
      telecallingStatus: 'Contacted',
      $unset: { callbackDate: 1 },
    };

    switch (outcome) {
      case 'Specific Date':
      case 'Will Come Later':
        customerUpdatePayload = { telecallingStatus: 'Scheduled', callbackDate: new Date(callbackDate!) };
        break;
      case 'Not Interested':
      case 'Complaint':
        customerUpdatePayload = { telecallingStatus: 'Uninterested', $unset: { callbackDate: 1 } };
        break;
      case 'No Reminder Call':
        customerUpdatePayload = { telecallingStatus: 'Uninterested', doNotDisturb: true, $unset: { callbackDate: 1 } };
        break;
    }

    // 4. --- DATABASE OPERATIONS ---
    await TelecallingLog.create({
      tenantId: new mongoose.Types.ObjectId(session.user.tenantId),
      customerId: new mongoose.Types.ObjectId(customerId),
      callerId: new mongoose.Types.ObjectId(session.user.id),
      outcome,
      notes: notes || '',
      appointmentId: appointmentId ? new mongoose.Types.ObjectId(appointmentId) : undefined,
      callbackDate: callbackDate ? new Date(callbackDate) : undefined,
    });

    await Customer.findByIdAndUpdate(customerId, customerUpdatePayload);

    // 5. --- SUCCESS RESPONSE ---
    return NextResponse.json({ message: 'Log created and state updated successfully.' }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/telecalling/log:', error);
    if (error instanceof mongoose.Error.CastError) {
      return NextResponse.json({ message: 'Invalid ID format provided.' }, { status: 400 });
    }
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}