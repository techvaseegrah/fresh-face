// src/app/api/sales-report/[tenantId]/route.ts

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Invoice from '@/models/invoice';
import mongoose from 'mongoose';
// Note: You must add session/permission checks here to ensure
// only a platform admin can access this endpoint.

export async function GET(
  req: Request,
  { params }: { params: { tenantId: string } }
) {
  const { tenantId } = params;

  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    return new NextResponse(JSON.stringify({ message: 'Invalid Store ID.' }), { status: 400 });
  }

  try {
    await connectToDatabase();

    // The aggregation pipeline is the same, but it uses the tenantId from the URL
    const salesReport = await Invoice.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId), // Use the ID from the URL
          paymentStatus: 'Paid'
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalSales: { $sum: "$grandTotal" },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } },
      { $project: { _id: 0, date: "$_id", totalSales: "$totalSales", invoiceCount: "$invoiceCount" } }
    ]);

    return NextResponse.json(salesReport);

  } catch (error) {
    console.error('Failed to generate sales report:', error);
    return new NextResponse(JSON.stringify({ message: 'An error occurred.' }), { status: 500 });
  }
}