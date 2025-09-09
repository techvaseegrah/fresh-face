// /app/api/incentive-payout/[payoutId]/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IncentivePayout from '@/models/IncentivePayout';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: { payoutId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    await dbConnect();
    const { payoutId } = params;
    const { status } = await request.json();

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ message: 'Invalid status provided.' }, { status: 400 });
    }

    const updatedPayout = await IncentivePayout.findOneAndUpdate(
      { _id: payoutId, tenantId }, 
      { $set: { status, processedDate: new Date() } },
      { new: true }
    ).populate('staff', 'name staffIdNumber'); // MODIFIED: Added staffIdNumber to populate

    if (!updatedPayout) {
      return NextResponse.json({ message: 'Payout request not found.' }, { status: 404 });
    }

    return NextResponse.json({ message: `Request has been ${status}.`, payout: updatedPayout });
  } catch (error: any) {
    console.error("API PATCH Error:", error);
    return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { payoutId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    await dbConnect();
    const { payoutId } = params;

    const deletedPayout = await IncentivePayout.findOneAndDelete({ _id: payoutId, tenantId });

    if (!deletedPayout) {
      return NextResponse.json({ message: 'Payout request not found.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Payout request deleted.' }, { status: 200 });
  } catch (error: any) {
    console.error("API DELETE Error:", error);
    return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}