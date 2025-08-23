// /app/api/stafflogin-dashboard/request/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import AdvancePayment from '@/models/advance'; // CRITICAL: Ensure this path is correct

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role.name !== 'staff') {
    return NextResponse.json({ success: false, error: 'Unauthorized: Access denied.' }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const staffId = session.user.id;

  try {
    await dbConnect();
    const body = await request.json();
    const { amount, reason } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ success: false, error: 'A valid, positive amount is required.' }, { status: 400 });
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'A reason for the advance is required.' }, { status: 400 });
    }

    // ✅ THE FIX IS HERE
    // We are now including a default value for `repaymentPlan` to match your database schema.
    const newAdvanceRequest = new AdvancePayment({
      tenantId,
      staffId,
      amount,
      reason: reason.trim(),
      repaymentPlan: 'One-time deduction', // Default value for staff requests
      requestDate: new Date(),
      status: 'pending',
    });

    await newAdvanceRequest.save();

    return NextResponse.json({ 
        success: true, 
        message: 'Advance request submitted successfully.' 
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating advance request:', error);
    // This will now catch the validation error if it still occurs for other reasons
    if (error.name === 'ValidationError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ success: false, error: 'Invalid request format.' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}