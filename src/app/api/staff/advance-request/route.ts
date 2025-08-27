// /api/staff/advance-request/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import AdvancePayment from '@/models/advance';
import { getTenantIdOrBail } from '@/lib/tenant'; // ✅ 1. IMPORT the helper function

export async function POST(request: NextRequest) {
  // Session check still ensures the user is an authenticated staff member
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role.name !== 'staff') {
    return NextResponse.json({ success: false, error: 'Unauthorized: Access denied.' }, { status: 401 });
  }

  // ✅ 2. GET tenantId from request headers using the new function
  const tenantId = getTenantIdOrBail(request);
  if (tenantId instanceof NextResponse) {
    return tenantId; // Return the error response if the header is missing
  }

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

    const newAdvanceRequest = new AdvancePayment({
      tenantId, // ✅ 3. USE the tenantId obtained from the header
      staffId,
      amount,
      reason: reason.trim(),
      repaymentPlan: 'One-time deduction',
      requestDate: new Date(),
      status: 'pending',
    });

    await newAdvanceRequest.save();

    return NextResponse.json({ 
        success: true, 
        message: 'Advance request submitted successfully.' 
    }, { status: 201 });

  } catch (error: any) {
    if (error.name === 'ValidationError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}