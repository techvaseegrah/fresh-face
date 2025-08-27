// src/app/api/telecalling/reports/performance/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import TelecallingLog from '@/models/TelecallingLog';
import mongoose from 'mongoose';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDateString = searchParams.get('startDate');
  const endDateString = searchParams.get('endDate');

  if (!startDateString || !endDateString) {
    return NextResponse.json({ message: 'startDate and endDate are required' }, { status: 400 });
  }

  // Timezone-proof date creation
  const startDate = new Date(`${startDateString}T00:00:00.000Z`);
  const endDate = new Date(`${endDateString}T23:59:59.999Z`);

  try {
    await dbConnect();
    const tenantId = new mongoose.Types.ObjectId(session.user.tenantId);

    const performanceData = await TelecallingLog.aggregate([
      // 1. Filter logs by tenant and date range (Unchanged)
      {
        $match: {
          tenantId: tenantId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      // 2. Group by the caller (the staff member) (Unchanged)
      {
        $group: {
          _id: '$callerId',
          totalCalls: { $sum: 1 },
          appointmentsBooked: {
            $sum: {
              $cond: [{ $eq: ['$outcome', 'Appointment Booked'] }, 1, 0],
            },
          },
        },
      },

      // ▼▼▼ MODIFICATION: DUAL LOOKUP LOGIC STARTS HERE ▼▼▼

      // 3a. Look up the staff member's name in the 'users' collection
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo', // Store result in a temporary field
        },
      },
      // 3b. Look up the staff member's name in the 'staffs' collection
      {
        $lookup: {
          from: 'staffs', // Your other collection
          localField: '_id',
          foreignField: '_id', // Assuming the ID field is also _id in staffs
          as: 'staffInfo', // Store result in another temporary field
        },
      },
      // 3c. Merge the results. Since an ID can only be in one collection,
      // one of these arrays will be empty and the other will have one item.
      // $concatArrays will combine them into a single array with one item.
      {
        $project: {
          totalCalls: 1, // Keep the fields from the $group stage
          appointmentsBooked: 1,
          callerInfo: { $concatArrays: ["$userInfo", "$staffInfo"] }
        }
      },
      
      // ▲▲▲ MODIFICATION ENDS HERE ▲▲▲

      // 4. Deconstruct the MERGED callerInfo array (Unchanged logic, but now on the merged field)
      {
        $unwind: {
            path: '$callerInfo',
            preserveNullAndEmptyArrays: true // Keep logs even if the user/staff was deleted
        }
      },
      // 5. Project the final data, including the conversion rate calculation (Unchanged)
      {
        $project: {
          _id: 0,
          staffId: '$_id',
          staffName: { $ifNull: ['$callerInfo.name', 'Deleted User'] },
          totalCalls: '$totalCalls',
          appointmentsBooked: '$appointmentsBooked',
          conversionRate: {
            $cond: [
              { $eq: ['$totalCalls', 0] },
              0,
              {
                $multiply: [
                  { $divide: ['$appointmentsBooked', '$totalCalls'] },
                  100,
                ],
              },
            ],
          },
        },
      },
      // 6. Sort by the most appointments booked (Unchanged)
      {
        $sort: { appointmentsBooked: -1 },
      },
    ]);

    return NextResponse.json(performanceData);
  } catch (error) {
    console.error('Failed to fetch performance report:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}