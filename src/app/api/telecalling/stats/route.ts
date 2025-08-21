// src/app/api/telecalling/stats/route.ts
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

  try {
    await dbConnect();
    const tenantId = new mongoose.Types.ObjectId(session.user.tenantId);

    // Define date range for "today"
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const dateFilter = {
      tenantId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    };

    // Perform queries
    const totalCalls = await TelecallingLog.countDocuments(dateFilter);
    const appointmentsBooked = await TelecallingLog.countDocuments({
      ...dateFilter,
      outcome: 'Appointment Booked',
    });

    // Calculate conversion rate (handle division by zero)
    const conversionRate = totalCalls > 0 ? (appointmentsBooked / totalCalls) * 100 : 0;

    return NextResponse.json({
      totalCalls,
      appointmentsBooked,
      conversionRate: parseFloat(conversionRate.toFixed(2)), // Format to 2 decimal places
    });

  } catch (error) {
    console.error('Failed to fetch telecalling stats:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}