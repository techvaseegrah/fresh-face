import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Invoice from '@/models/invoice';
import Expense from '@/models/Expense';
import { getTenantIdOrBail } from '@/lib/tenant';

// API: GET /api/reports/monthly-comparison?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
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
    const endDate = new Date(endDateParam);

    // 1. Get Monthly Revenue
    const revenuePromise = Invoice.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), createdAt: { $gte: startDate, $lte: endDate }, paymentStatus: 'Paid' } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, // Group by year-month string e.g., "2025-08"
          totalRevenue: { $sum: '$grandTotal' },
        }
      }
    ]);

    // 2. Get Monthly Expenses
    const expensesPromise = Expense.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), date: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          totalExpenses: { $sum: '$amount' }
        }
      }
    ]);

    const [revenues, expenses] = await Promise.all([revenuePromise, expensesPromise]);

    // 3. Combine the data into a single structure
    const monthlyData: { [key: string]: any } = {};

    revenues.forEach(rev => {
      monthlyData[rev._id] = { ...monthlyData[rev._id], month: rev._id, totalRevenue: rev.totalRevenue };
    });

    expenses.forEach(exp => {
      monthlyData[exp._id] = { ...monthlyData[exp._id], month: exp._id, totalExpenses: exp.totalExpenses };
    });

    // 4. Format into a sorted array and calculate net profit
    const result = Object.values(monthlyData)
      .map(data => {
        const totalRevenue = data.totalRevenue || 0;
        const totalExpenses = data.totalExpenses || 0;
        return {
          month: data.month,
          totalRevenue,
          totalExpenses,
          netProfit: totalRevenue - totalExpenses
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month)); // Sort chronologically

    return NextResponse.json(result);

  } catch (error) {
    console.error('[ERROR] in /api/reports/monthly-comparison:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}