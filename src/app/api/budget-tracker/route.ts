import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Budget, { IBudget } from '@/models/Budget';
import Expense from '@/models/Expense'; // Assuming this is your Expense model
import { getTenantIdOrBail } from '@/lib/tenant'; // Utility to get tenant ID or fail

// This is the data structure your frontend page expects
interface TrackerData {
    category: string;
    type: 'Fixed' | 'Variable';
    budget: number;
    spentTillDate: number;
    remainingBudget: number;
    budgetUsedIn: string;
}

// This is the data structure the database aggregation query will return
interface AggregationResult {
  _id: string; // The expense 'category' (e.g., "Rent")
  spent: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Securely get the tenant ID or bail out of the request
    const tenantIdResult = getTenantIdOrBail(request);
    if (tenantIdResult instanceof NextResponse) {
      // This will return a 400 response if the 'x-tenant-id' header is missing
      return tenantIdResult;
    }
    const tenantId = tenantIdResult; // Now guaranteed to be a string

    // 2. Get month and year from the URL query parameters
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || '', 10);
    const year = parseInt(searchParams.get('year') || '', 10);

    // Validate that month and year are valid numbers
    if (isNaN(month) || isNaN(year)) {
      return NextResponse.json({ success: false, error: 'Month and year are required.' }, { status: 400 });
    }

    // Connect to the database
    await dbConnect();
    
    // 3. Find the budget that the user has set for this period, scoped by tenantId.
    // This ensures you only retrieve the budget for the correct tenant.
    const budget: IBudget | null = await Budget.findOne({ tenantId, month, year });

    // If no budget is set for this period, it's not an error.
    // We can just return empty data for the tracker.
    if (!budget) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 4. This powerful aggregation query finds all expenses that:
    //    a. Belong to the correct tenant.
    //    b. Were created in the correct month and year.
    const expenses: AggregationResult[] = await Expense.aggregate([
      // Stage 1: Add temporary fields for the month and year of each expense's date.
      {
        $addFields: {
          expenseMonth: { $month: "$date" },
          expenseYear: { $year: "$date" }
        }
      },
      // Stage 2: Match documents based on tenant, month, and year.
      {
        $match: {
          // CRITICAL SECURITY STEP: We filter by the tenantId.
          // The tenantId string is converted into a MongoDB ObjectId so it
          // can correctly match the reference in your Expense model.
          tenantId: new mongoose.Types.ObjectId(tenantId),
          expenseMonth: month,
          expenseYear: year
        }
      },
      // Stage 3: Group the matching expenses by their category ('type') and sum the 'amount'.
      {
        $group: {
          _id: '$type', // The expense category, e.g., "Rent"
          spent: { $sum: '$amount' } // The total spent for that category
        }
      }
    ]);

    // 5. Convert the database result into a simple map for easy lookup: { "Rent": 5200, "Tea": 350 }
    const spentByCategory: Record<string, number> = expenses.reduce((acc, item) => {
        if (item._id) acc[item._id] = item.spent;
        return acc;
    }, {} as Record<string, number>);

    // 6. Combine the budget data with the calculated spending data to create the final response.
    const allCategories = [...budget.fixedExpenses, ...budget.variableExpenses];
    const trackerData = allCategories.map(budgetItem => {
        // Find the spent amount from our map; default to 0 if no expenses in that category.
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
    // Generic error handler for any unexpected issues
    console.error("Budget Tracker GET Error:", error);
    return NextResponse.json({ success: false, error: 'An unknown server error occurred' }, { status: 500 });
  }
}