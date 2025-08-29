import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import DailyReconciliation from '@/models/DailyReconciliation'; // Import the model
import { getTenantIdOrBail } from '@/lib/tenant';

// API Endpoint: GET /api/reconciliation/history?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const tenantIdOrResponse = getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) return tenantIdOrResponse;
    const tenantId = tenantIdOrResponse;
    
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ message: 'Both startDate and endDate are required.' }, { status: 400 });
    }

    const startDate = new Date(startDateParam);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(endDateParam);
    endDate.setUTCHours(23, 59, 59, 999);

    const history = await DailyReconciliation.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      date: { $gte: startDate, $lte: endDate }
    })
    .sort({ date: -1 }); // Sort by date, newest first

    return NextResponse.json(history);

  } catch (error) {
    console.error('[ERROR] in /api/reconciliation/history:', error);
    return NextResponse.json({ message: 'Internal Server Error', error: (error as Error).message }, { status: 500 });
  }
}