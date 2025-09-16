import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Budget, { IBudget } from '@/models/Budget';
import Expense from '@/models/Expense';
import { getTenantIdOrBail } from '@/lib/tenant';

// --- MODIFIED: Updated interface to match desired output ---
interface BudVsActualData {
    category: string;
    type: 'Fixed' | 'Variable';
    budget: number;
    spent: number; // Renamed from 'actual'
    remaining: number; // Renamed from 'variance'
    usagePercentage: string;
    remainingPercentage: string;
}

interface AggregationResult {
  _id: string; // The expense 'category'
  spent: number; // Renamed from 'actual'
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
      return NextResponse.json({ success: false, error: 'Month and year are required parameters.' }, { status: 400 });
    }

    await dbConnect();
    
    const budget: IBudget | null = await Budget.findOne({ tenantId, month, year });

    if (!budget) {
      return NextResponse.json({ success: false, error: 'No budget found for the selected period. Please set up a budget first.' }, { status: 404 });
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
      {
        $group: {
          _id: '$category',
          spent: { $sum: '$amount' }
        }
      }
    ]);

    const actualsByCategory: Record<string, number> = expenses.reduce((acc, item) => {
        if (item._id) acc[item._id] = item.spent;
        return acc;
    }, {} as Record<string, number>);

    const allCategories = [...budget.fixedExpenses, ...budget.variableExpenses];
    
    // --- MODIFIED: Calculation logic updated for new fields ---
    const reportData: BudVsActualData[] = allCategories.map(budgetItem => {
        const spent = actualsByCategory[budgetItem.category] || 0;
        const remaining = budgetItem.amount - spent;
        
        const usagePercentageNum = budgetItem.amount > 0 ? (spent / budgetItem.amount) * 100 : 0;
        const remainingPercentageNum = budgetItem.amount > 0 ? (remaining / budgetItem.amount) * 100 : 100;

        return {
            category: budgetItem.category,
            type: budgetItem.type,
            budget: budgetItem.amount,
            spent: spent,
            remaining: remaining,
            usagePercentage: `${usagePercentageNum.toFixed(2)}%`,
            remainingPercentage: `${remainingPercentageNum.toFixed(2)}%`,
        };
    });

    return NextResponse.json({ success: true, data: reportData });

  } catch (error) {
    console.error("Budget vs. Actual Report GET Error:", error);
    return NextResponse.json({ success: false, error: 'An unknown server error occurred' }, { status: 500 });
  }
}