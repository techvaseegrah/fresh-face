import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Expense from '@/models/Expense'; // Import your Expense model
import { getTenantIdOrBail } from '@/lib/tenant';

// API Endpoint: GET /api/expenses/cash-summary?date=YYYY-MM-DD
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const tenantIdOrResponse = getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) return tenantIdOrResponse;
    const tenantId = tenantIdOrResponse;
    
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    if (!date) return NextResponse.json({ message: 'Date URL parameter is required.' }, { status: 400 });

    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const aggregation = await Expense.aggregate([
      // Stage 1: Find all expenses that match our criteria
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          date: { $gte: startOfDay, $lte: endOfDay },
          // This is the key filter. It's case-insensitive to match "Cash" or "cash".
          paymentMethod: { $regex: /^Cash$/i }
        }
      },
      // Stage 2: Group all matching expenses and sum their amounts
      {
        $group: {
          _id: null, // Group all results into a single output
          totalCashExpenses: { $sum: '$amount' }
        }
      }
    ]);

    // If there were no cash expenses, the aggregation result will be an empty array.
    // In that case, we return a total of 0.
    const result = aggregation[0] || { totalCashExpenses: 0 };

    return NextResponse.json(result);

  } catch (error) {
    console.error('[ERROR] in /api/expenses/cash-summary:', error);
    return NextResponse.json({ message: 'Internal Server Error', error: (error as Error).message }, { status: 500 });
  }
}