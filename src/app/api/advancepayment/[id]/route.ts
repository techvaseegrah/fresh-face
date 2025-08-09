// src/app/api/advancepayment/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { formatISO } from 'date-fns';
import mongoose, { Types } from 'mongoose';
import dbConnect from '../../../../lib/mongodb';
import AdvancePayment from '../../../../models/advance';
import Staff from '../../../../models/staff';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
// NEW: Import tenant utility
import { getTenantIdOrBail } from '@/lib/tenant';

// --- Type Definitions (Consistent with the main route file) ---
interface PopulatedStaffDetails {
    _id: Types.ObjectId;
    name: string;
    image?: string;
    position?: string;
}
interface LeanAdvancePaymentDocument {
    _id: Types.ObjectId;
    staffId: PopulatedStaffDetails | null;
    requestDate: Date;
    amount: number;
    reason: string;
    repaymentPlan: string;
    status: 'pending' | 'approved' | 'rejected';
    approvedDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
interface UpdateAdvanceStatusPayload {
    status: 'approved' | 'rejected';
}

// A reusable function to check permissions
async function checkPermissions(permission: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role?.permissions) {
    return { error: 'Authentication required.', status: 401 };
  }
  const userPermissions = session.user.role.permissions;
  if (!hasPermission(userPermissions, permission)) {
    return { error: 'You do not have permission to perform this action.', status: 403 };
  }
  return null;
}

// Helper Function (To format the response consistently)
const formatPaymentResponse = (payment: any) => ({
  id: payment._id.toString(),
  staffId: payment.staffId ? {
    id: payment.staffId._id.toString(),
    name: payment.staffId.name,
    image: payment.staffId.image,
    position: payment.staffId.position,
  } : null,
  requestDate: formatISO(payment.requestDate),
  amount: payment.amount,
  reason: payment.reason,
  repaymentPlan: payment.repaymentPlan,
  status: payment.status,
  approvedDate: payment.approvedDate ? formatISO(payment.approvedDate) : null,
  createdAt: formatISO(payment.createdAt),
  updatedAt: formatISO(payment.updatedAt),
});


// --- Route Handlers for /api/advance-payments/[id] ---

/**
 * @method PATCH
 * @description Update the status of a specific advance payment (e.g., approve or reject it).
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  // NEW: Add tenant and permission checks
  const tenantId = getTenantIdOrBail(request);
  if (tenantId instanceof NextResponse) return tenantId;

  const permissionCheck = await checkPermissions(PERMISSIONS.STAFF_ADVANCE_MANAGE);
  if (permissionCheck) {
    return NextResponse.json({ success: false, error: permissionCheck.error }, { status: permissionCheck.status });
  }

  const { id: paymentId } = params;

  if (!mongoose.Types.ObjectId.isValid(paymentId)) {
    return NextResponse.json({ success: false, error: 'Invalid payment ID format.' }, { status: 400 });
  }

  try {
    await dbConnect();
    const body = (await request.json()) as UpdateAdvanceStatusPayload;

    if (!body.status || !['approved', 'rejected'].includes(body.status)) {
        return NextResponse.json({ success: false, error: 'Invalid status. Must be "approved" or "rejected".' }, { status: 400 });
    }

    const updateFields: { status: 'approved' | 'rejected', approvedDate?: Date | null } = {
        status: body.status,
    };

    if (body.status === 'approved') {
        updateFields.approvedDate = new Date();
    } else {
        updateFields.approvedDate = null;
    }

    // NEW: Query now includes tenantId to ensure data isolation
    const updatedPayment = await AdvancePayment.findOneAndUpdate(
        { _id: paymentId, tenantId }, // Ensure the record belongs to the tenant
        { $set: updateFields },
        { new: true, runValidators: true }
    )
    .populate<{ staffId: PopulatedStaffDetails }>({ path: 'staffId', select: 'name image position', model: Staff })
    .lean<LeanAdvancePaymentDocument>();

    if (!updatedPayment) {
      return NextResponse.json({ success: false, error: 'Advance payment not found or you do not have permission to access it.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: formatPaymentResponse(updatedPayment) });

  } catch (error: any) {
    console.error(`API PATCH /api/advance-payments/${paymentId} Error:`, error);
    return NextResponse.json({ success: false, error: 'Server error updating advance payment.' }, { status: 500 });
  }
}

/**
 * @method DELETE
 * @description Delete a specific advance payment record.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    // NEW: Add tenant and permission checks
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) return tenantId;

    const permissionCheck = await checkPermissions(PERMISSIONS.STAFF_ADVANCE_MANAGE);
    if (permissionCheck) {
      return NextResponse.json({ success: false, error: permissionCheck.error }, { status: permissionCheck.status });
    }

    const { id: paymentId } = params;

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return NextResponse.json({ success: false, error: 'Invalid payment ID format.' }, { status: 400 });
    }

    try {
      await dbConnect();
      // NEW: Query now includes tenantId to ensure data isolation
      const deletedPayment = await AdvancePayment.findOneAndDelete({ _id: paymentId, tenantId });

      if (!deletedPayment) {
        return NextResponse.json({ success: false, error: 'Advance payment not found or you do not have permission to access it.' }, { status: 404 });
      }

      return NextResponse.json({ success: true, message: 'Advance payment deleted successfully.', data: { id: paymentId } });

    } catch (error: any) {
      console.error(`API DELETE /api/advance-payments/${paymentId} Error:`, error);
      return NextResponse.json({ success: false, error: 'Server error deleting advance payment.' }, { status: 500 });
    }
}