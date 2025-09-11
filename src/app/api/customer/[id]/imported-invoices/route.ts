import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import connectToDatabase from '@/lib/mongodb';
import Invoice from '@/models/invoice';
import mongoose from 'mongoose';
import Staff from '@/models/staff';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;

  try {
    const { id: customerId } = params;
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return NextResponse.json({ message: 'Invalid customer ID.' }, { status: 400 });
    }

    await connectToDatabase();

    const importedInvoices = await Invoice.find({
      tenantId,
      customerId,
      isImported: true, // The key filter!
    })
    .sort({ createdAt: -1 }) // Show the most recent first
    .populate({ path: 'stylistId', select: 'name', model: Staff })
    .limit(50) // Add a limit for performance
    .lean();

    return NextResponse.json(importedInvoices);

  } catch (error) {
    console.error('Error fetching imported invoices:', error);
    return NextResponse.json({ message: 'Server error.' }, { status: 500 });
  }
}