// src/app/api/profit-loss/income/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import MonthlyIncome from '@/models/MonthlyIncome';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.tenantId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();
    const { year, month, amount } = await request.json();

    if (!year || !month || amount === undefined) {
      return NextResponse.json({ message: 'Year, month, and amount are required' }, { status: 400 });
    }

    const tenantId = session.user.tenantId;

    // Use findOneAndUpdate with upsert to create or update the income record
    const updatedIncome = await MonthlyIncome.findOneAndUpdate(
      { tenantId, year, month },
      { $set: { amount } },
      { new: true, upsert: true, runValidators: true }
    );

    return NextResponse.json({ success: true, data: updatedIncome });
  } catch (error) {
    console.error('Error saving monthly income:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}