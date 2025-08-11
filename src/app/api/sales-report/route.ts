// src/app/api/sales-report/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Invoice from '@/models/invoice';
import mongoose from 'mongoose';

export async function GET(req: Request) {
  // 1. Get the session to identify the tenant securely
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return new NextResponse(JSON.stringify({ message: 'Authentication required.' }), { status: 401 });
  }
  const { tenantId } = session.user;

  try {
    await connectToDatabase();

    // 2. Use MongoDB Aggregation to calculate daily sales for the specific tenant
    const salesReport = await Invoice.aggregate([
      {
        // Find only invoices for the logged-in user's tenant
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          paymentStatus: 'Paid' // Ensure we only count paid invoices
        }
      },
      {
        // Group invoices by the date they were created
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          totalSales: { $sum: "$grandTotal" }, // Sum the grandTotal for each day
          invoiceCount: { $sum: 1 } // Count the number of invoices per day
        }
      },
      {
        // Sort the results by date, most recent first
        $sort: { _id: -1 }
      },
      {
        // Rename fields for easier use on the frontend
        $project: {
          _id: 0,
          date: "$_id",
          totalSales: "$totalSales",
          invoiceCount: "$invoiceCount"
        }
      }
    ]);

    // 3. Return the generated report
    return new NextResponse(JSON.stringify(salesReport), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Failed to generate sales report:', error);
    return new NextResponse(JSON.stringify({ message: 'An error occurred while generating the report.' }), { status: 500 });
  }
}