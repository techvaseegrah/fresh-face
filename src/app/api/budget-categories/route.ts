import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Budget from '@/models/Budget';
import { getTenantIdOrBail } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const tenantIdResult = getTenantIdOrBail(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = new mongoose.Types.ObjectId(tenantIdResult);

    await dbConnect();

    const categories = await Budget.aggregate([
      { $match: { tenantId: tenantId } },
      { $project: {
          allItems: { $concatArrays: [
            { $ifNull: ["$fixedExpenses", []] }, 
            { $ifNull: ["$variableExpenses", []] }
          ]}
      }},
      { $unwind: "$allItems" },
      { $match: { "allItems.category": { $nin: [null, ""] } } },
      { $group: {
          _id: "$allItems.category"
      }},
      { $project: {
          _id: 0,
          category: "$_id"
      }}
    ]);

    const categoryNames = categories.map(c => c.category);

    return NextResponse.json({ success: true, data: categoryNames });

  } catch (error: any) {
    console.error('--- [API] ERROR IN BUDGET-CATEGORIES GET ROUTE ---:', error);
    return NextResponse.json({ success: false, error: 'An error occurred while fetching budget categories.' }, { status: 500 });
  }
}