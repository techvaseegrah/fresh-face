// app/api/customer/[id]/points/route.ts - MULTI-TENANT VERSION

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import mongoose from 'mongoose';
import { getTenantIdOrBail } from '@/lib/tenant'; // Import tenant helper
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// NOTE: This assumes your LoyaltyTransaction model also has a `tenantId` field.

export async function POST(req: Request, { params }: { params: { id: string } }) {
  // 1. Check permissions and get tenantId first
  const sessionAuth = await getServerSession(authOptions);
  if (!sessionAuth || !hasPermission(sessionAuth.user.role.permissions, PERMISSIONS.CUSTOMERS_UPDATE)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = getTenantIdOrBail(req as any);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }
  
  // Start the mongoose session for the transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id: customerId } = params;
    const { points, reason } = await req.json();

    // Validation remains the same and is good practice
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return NextResponse.json({ success: false, message: 'Invalid Customer ID' }, { status: 400 });
    }
    if (typeof points !== 'number' || points === 0) {
      return NextResponse.json({ success: false, message: 'Points must be a non-zero number' }, { status: 400 });
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return NextResponse.json({ success: false, message: 'A valid reason is required' }, { status: 400 });
    }

    await connectToDatabase();
    
    // 2. Find the customer, scoped to the current tenant
    const customer = await Customer.findOne({ _id: customerId, tenantId }).session(session);
    if (!customer) {
      throw new Error('Customer not found for this tenant');
    }

    // This business logic is correct
    if (customer.loyaltyPoints + points < 0) {
      throw new Error(`Operation failed. Customer only has ${customer.loyaltyPoints} points.`);
    }

    // 3. Update the customer's point balance, scoped to the current tenant
    const updatedCustomer = await Customer.findOneAndUpdate(
      { _id: customerId, tenantId }, // Use a tenant-scoped filter
      { $inc: { loyaltyPoints: points } },
      { new: true, session }
    );

    if (!updatedCustomer) throw new Error('Failed to update customer points.');
    
    // 4. Create a tenant-scoped log of the transaction
    await LoyaltyTransaction.create([{
      customerId,
      tenantId, // Add the tenantId to the log
      points: Math.abs(points),
      type: points > 0 ? 'Credit' : 'Debit',
      reason: `Manual Adjustment: ${reason.trim()}`,
    }], { session });

    await session.commitTransaction(); // Commit all changes

    return NextResponse.json({
      success: true,
      message: 'Loyalty points updated successfully',
      customer: {
        loyaltyPoints: updatedCustomer.loyaltyPoints,
      }
    });

  } catch (err: any) {
    await session.abortTransaction(); // Rollback all changes on any error
    console.error('API Error in /api/customer/[id]/points:', err);
    return NextResponse.json({ success: false, message: err.message || 'Failed to update points' }, { status: 500 });
  } finally {
    session.endSession(); // Always end the session
  }
}