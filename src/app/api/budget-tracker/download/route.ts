import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Budget, { IBudget } from '@/models/Budget';
import Expense from '@/models/Expense';
import { getTenantIdOrBail } from '@/lib/tenant';

// This is the same logic as your main tracker API route.
async function getTrackerData(tenantId: string, month: number, year: number) {
    await dbConnect();
    
    const budget: IBudget | null = await Budget.findOne({ tenantId, month, year });
    if (!budget) return null; // Return null if no budget is found

    const expenses = await Expense.aggregate([
      { $addFields: { expenseMonth: { $month: "$date" }, expenseYear: { $year: "$date" } } },
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), expenseMonth: month, expenseYear: year } },
      { $group: { _id: '$type', spent: { $sum: '$amount' } } }
    ]);

    const spentByCategory: Record<string, number> = expenses.reduce((acc, item) => {
        if (item._id) acc[item._id] = item.spent;
        return acc;
    }, {} as Record<string, number>);

    const allCategories = [...budget.fixedExpenses, ...budget.variableExpenses];
    return allCategories.map(item => {
        const spent = spentByCategory[item.category] || 0;
        return {
            Category: item.category,
            Type: item.type,
            Budget: item.amount,
            Spent: spent,
            Remaining: item.amount - spent,
            Usage: `${item.amount > 0 ? Math.round((spent / item.amount) * 100) : 0}%`,
        };
    });
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const tenantIdResult = getTenantIdOrBail(request);
    if (tenantIdResult instanceof NextResponse) return tenantIdResult;
    const tenantId = tenantIdResult;

    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || '', 10);
    const year = parseInt(searchParams.get('year') || '', 10);

    if (isNaN(month) || isNaN(year)) {
      return new Response(JSON.stringify({ error: 'Month and year are required.' }), { status: 400 });
    }

    const trackerData = await getTrackerData(tenantId, month, year);

    if (!trackerData) {
        return new Response(JSON.stringify({ error: 'No budget data found to generate a report.' }), { status: 404 });
    }

    // --- Generate CSV content ---
    const headers = Object.keys(trackerData[0]).join(',');
    const csvRows = trackerData.map(row => Object.values(row).join(','));
    const csv = `${headers}\n${csvRows.join('\n')}`;

    // Return the CSV file as a response
    return new Response(csv, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="budget_report_${month}-${year}.csv"`,
        },
    });

  } catch (error) {
    console.error("Download Report Error:", error);
    return new Response(JSON.stringify({ error: 'Failed to generate the report.' }), { status: 500 });
  }
}