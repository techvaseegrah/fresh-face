import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IncentivePayout from '@/models/IncentivePayout';
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) {
        return tenantId;
    }

    const body = await request.json();
    const { staffId, amount, notes } = body;

    if (!staffId || !amount) {
      return NextResponse.json({ success: false, message: 'Staff ID and amount are required.' }, { status: 400 });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ success: false, message: 'Amount must be a positive number.' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
        return NextResponse.json({ success: false, message: 'Invalid Staff ID format.' }, { status: 400 });
    }

    await dbConnect();

    const newPayout = new IncentivePayout({
      staff: new mongoose.Types.ObjectId(staffId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      amount,
      notes,
      payoutDate: new Date(),
    });

    await newPayout.save();

    return NextResponse.json({ success: true, message: 'Payout recorded successfully.', data: newPayout });

  } catch (error: any) {
    console.error("API POST /payouts Error:", error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred', error: error.message }, { status: 500 });
  }
}