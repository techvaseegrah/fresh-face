import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Invoice from '@/models/invoice'; // Use your actual Invoice model path
import Expense from '@/models/Expense'; // Use your actual Expense model path
import { getTenantIdOrBail } from '@/lib/tenant';

// API Endpoint: GET /api/reports/pnl-summary?year=YYYY&month=M
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const tenantIdOrResponse = getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) return tenantIdOrResponse;
    const tenantId = tenantIdOrResponse;
    
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || '', 10);
    const month = parseInt(searchParams.get('month') || '', 10); // month is 1-12

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ message: 'Valid year and month (1-12) are required.' }, { status: 400 });
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1)); // Go up to the start of the next month

    // --- 1. Revenue Calculation ---
    const revenuePromise = Invoice.aggregate([
      { $match: { 
          tenantId: new mongoose.Types.ObjectId(tenantId), 
          createdAt: { $gte: startDate, $lt: endDate },
          paymentStatus: 'Paid'
        } 
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$grandTotal' },
          // Using the top-level serviceTotal and productTotal fields from your invoice model
          revenueFromServices: { $sum: '$serviceTotal' },
          revenueFromProducts: { $sum: '$productTotal' }
        }
      }
    ]);

    // --- 2. Expense Calculation with Breakdown by Category ---
    const expensesPromise = Expense.aggregate([
      { $match: { 
          tenantId: new mongoose.Types.ObjectId(tenantId), 
          date: { $gte: startDate, $lt: endDate } 
        } 
      },
      {
        $group: {
          _id: '$category', // Group by the 'category' field
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $project: { // Reshape the output for easier use on the frontend
          _id: 0,
          category: '$_id',
          totalAmount: 1
        }
      }
    ]);
    
    // Run both database queries in parallel
    const [revenueResult, expensesBreakdown] = await Promise.all([revenuePromise, expensesPromise]);

    // --- 3. Process and Combine Results ---
    const revenueData = revenueResult[0] || { totalRevenue: 0, revenueFromServices: 0, revenueFromProducts: 0 };
    
    const totalExpenses = expensesBreakdown.reduce((sum, item) => sum + item.totalAmount, 0);
    
    const netProfit = revenueData.totalRevenue - totalExpenses;

    return NextResponse.json({
      totalRevenue: revenueData.totalRevenue,
      revenueBreakdown: {
        services: revenueData.revenueFromServices,
        products: revenueData.revenueFromProducts,
      },
      totalExpenses,
      expensesBreakdown, // This is an array like [{ category: 'Salary', totalAmount: 50000 }, ...]
      netProfit
    });

  } catch (error) {
    console.error('[ERROR] in /api/reports/pnl-summary:', error);
    return NextResponse.json({ message: 'Internal Server Error', error: (error as Error).message }, { status: 500 });
  }
}