import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IncentivePayout from '@/models/IncentivePayout';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // ✅ THE FIX: Get tenantId from the server session
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    await dbConnect();
    const payouts = await IncentivePayout.find({ tenantId })
      .populate('staff', 'name')
      .sort({ createdAt: -1 });
      
    return NextResponse.json(payouts);
  } catch (error: any) {
    console.error("API GET /incentive-payout Error:", error);
    return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // ✅ THE FIX: Get tenantId from the server session
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;
    
    await dbConnect();
    const body = await request.json();
    const { staffId, amount, reason } = body;

    if (!staffId || !amount || !reason) {
      return NextResponse.json({ message: 'Staff, amount, and reason are required.' }, { status: 400 });
    }
    
    const newPayout = new IncentivePayout({ staff: staffId, amount, reason, tenantId });
    await newPayout.save();
    
    const result = await IncentivePayout.findById(newPayout._id).populate('staff', 'name');
    return NextResponse.json({ message: 'Payout request submitted successfully.', payout: result }, { status: 201 });
  } catch (error: any) {
    console.error("API POST /incentive-payout Error:", error);
    return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}