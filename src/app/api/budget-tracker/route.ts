import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Budget, { IBudget } from '@/models/Budget';
import Expense from '@/models/Expense';
import { getTenantIdOrBail } from '@/lib/tenant';

interface TrackerData {
    category: string;
    type: 'Fixed' | 'Variable';
    budget: number;
    spentTillDate: number;
    remainingBudget: number;
    budgetUsedIn: string;
}

interface AggregationResult {
  _id: string; // The expense 'category'
  spent: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const tenantIdResult = getTenantIdOrBail(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || '', 10);
    const year = parseInt(searchParams.get('year') || '', 10);

    if (isNaN(month) || isNaN(year)) {
      return NextResponse.json({ success: false, error: 'Month and year are required.' }, { status: 400 });
    }

    await dbConnect();
    
    const budget: IBudget | null = await Budget.findOne({ tenantId, month, year });

    if (!budget) {
      return NextResponse.json({ success: true, data: [] });
    }

    const expenses: AggregationResult[] = await Expense.aggregate([
      {
        $addFields: {
          expenseMonth: { $month: "$date" },
          expenseYear: { $year: "$date" }
        }
      },
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          expenseMonth: month,
          expenseYear: year
        }
      },
      // MODIFIED: Group by 'category' to sum up all sub-category expenses
      // against the main budget category.
      {
        $group: {
          _id: '$category', // Changed from '$type' to '$category'
          spent: { $sum: '$amount' }
        }
      }
    ]);

    const spentByCategory: Record<string, number> = expenses.reduce((acc, item) => {
        if (item._id) acc[item._id] = item.spent;
        return acc;
    }, {} as Record<string, number>);

    const allCategories = [...budget.fixedExpenses, ...budget.variableExpenses];
    const trackerData = allCategories.map(budgetItem => {
        const spent = spentByCategory[budgetItem.category] || 0;
        return {
            category: budgetItem.category,
            type: budgetItem.type,
            budget: budgetItem.amount,
            spentTillDate: spent,
            remainingBudget: budgetItem.amount - spent,
            budgetUsedIn: `${budgetItem.amount > 0 ? Math.round((spent / budgetItem.amount) * 100) : 0}%`,
        };
    });

    return NextResponse.json({ success: true, data: trackerData });

  } catch (error) {
    console.error("Budget Tracker GET Error:", error);
    return NextResponse.json({ success: false, error: 'An unknown server error occurred' }, { status: 500 });
  }
}