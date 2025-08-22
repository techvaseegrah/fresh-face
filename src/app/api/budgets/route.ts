import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Budget from '@/models/Budget';
// This utility function is key to securing the route.
import { getTenantIdOrBail } from '@/lib/tenant';

// --- POST: Create or Update a Budget ---
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Securely get the Tenant ID or stop the request.
    const tenantIdResult = getTenantIdOrBail(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult; // Bails out if tenant ID is missing.
    }
    const tenantId = tenantIdResult;

    await dbConnect();
    const body = await request.json();
    const { month, year, fixedExpenses, variableExpenses } = body;

    if (!month || !year || !fixedExpenses || !variableExpenses) {
      return NextResponse.json({ success: false, error: 'Month, year, and expense arrays are required.' }, { status: 400 });
    }

    // 2. Add the tenantId to the database query filter.
    const filter = { tenantId, month, year };
    const update = { $set: { fixedExpenses, variableExpenses }, $setOnInsert: { tenantId, month, year } };
    const options = { new: true, upsert: true, runValidators: true };

    // This operation is now tenant-aware.
    const budget = await Budget.findOneAndUpdate(filter, update, options);

    if (!budget) {
      return NextResponse.json({ success: false, error: 'Database failed to create or update the budget.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: budget }, { status: 201 });

  } catch (error: any) {
    console.error('--- [API] UNCAUGHT ERROR IN BUDGET POST ROUTE ---:', error);
    if (error instanceof mongoose.Error.ValidationError) {
      const messages = Object.values(error.errors).map(val => val.message).join(', ');
      return NextResponse.json({ success: false, error: `Validation Error: ${messages}` }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'An unknown server error occurred.' }, { status: 500 });
  }
}

// --- GET: Fetch an Existing Budget ---
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Securely get the Tenant ID or stop the request.
    const tenantIdResult = getTenantIdOrBail(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || '', 10);
    const year = parseInt(searchParams.get('year') || '', 10);

    if (isNaN(month) || isNaN(year)) {
      return NextResponse.json({ success: false, error: 'Valid month and year query parameters are required.' }, { status: 400 });
    }

    await dbConnect();

    // 2. Use the tenantId to find the specific budget for that tenant.
    // This prevents data leakage between tenants.
    const budget = await Budget.findOne({ tenantId, month, year });

    if (!budget) {
      // It's important to return 404, not just an error, if not found.
      return NextResponse.json({ success: true, data: null, message: 'No budget found for this period.' }, { status: 200 });
    }
    
    return NextResponse.json({ success: true, data: budget });
  } catch (error: any) {
    console.error('--- [API] ERROR IN BUDGET GET ROUTE ---:', error);
    return NextResponse.json({ success: false, error: 'An error occurred while fetching the budget.' }, { status: 500 });
  }
}