// src/app/api/advance-payments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { formatISO } from 'date-fns';
import mongoose, { Types } from 'mongoose';
import dbConnect from '../../../lib/mongodb';
import AdvancePayment from '../../../models/advance';
import Staff from '../../../models/staff';
// NEW: Import tenant utility
import { getTenantIdOrBail } from '@/lib/tenant';

// --- Type Definitions ---
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

interface NewAdvancePaymentAPIPayload {
  staffId: string;
  amount: number;
  reason: string;
  repaymentPlan: string;
}

// --- Helper Function ---
const formatPaymentResponse = (payment: LeanAdvancePaymentDocument) => ({
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

// --- Route Handlers ---

export async function GET(request: NextRequest) {
  // NEW: Add tenant check
  const tenantId = getTenantIdOrBail(request);
  if (tenantId instanceof NextResponse) return tenantId;

  try {
    await dbConnect();
    // NEW: Filter query by tenantId
    const query: mongoose.FilterQuery<any> = { tenantId };

    const payments = await AdvancePayment.find(query)
      .populate<{ staffId: PopulatedStaffDetails }>({
        path: 'staffId',
        select: 'name image position',
        model: Staff,
      })
      .sort({ requestDate: -1 })
      .lean<LeanAdvancePaymentDocument[]>();

    const validPayments = payments.filter(payment => payment.staffId);

    const formattedPayments = validPayments.map(formatPaymentResponse);
    return NextResponse.json({ success: true, data: formattedPayments });
  } catch (error: any) {
    console.error('API GET /api/advance-payments Error:', error);
    return NextResponse.json({ success: false, error: 'Server error fetching advance payments.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // NEW: Add tenant check
  const tenantId = getTenantIdOrBail(request);
  if (tenantId instanceof NextResponse) return tenantId;

  try {
    await dbConnect();
    const body = (await request.json()) as NewAdvancePaymentAPIPayload;

    // Validation
    if (!body.staffId || !mongoose.Types.ObjectId.isValid(body.staffId)) {
      return NextResponse.json({ success: false, error: 'Valid Staff ID is required.' }, { status: 400 });
    }
    if (body.amount == null || typeof body.amount !== 'number' || body.amount <= 0) {
      return NextResponse.json({ success: false, error: 'Amount must be a positive number.' }, { status: 400 });
    }
    if (!body.reason || typeof body.reason !== 'string' || body.reason.trim() === '') {
      return NextResponse.json({ success: false, error: 'Reason is required.' }, { status: 400 });
    }
    if (!body.repaymentPlan || typeof body.repaymentPlan !== 'string' || body.repaymentPlan.trim() === '') {
      return NextResponse.json({ success: false, error: 'Repayment plan is required.' }, { status: 400 });
    }

    // NEW: Ensure the staff member exists within the correct tenant
    const staffExists = await Staff.findOne({ _id: body.staffId, tenantId });
    if (!staffExists) {
        return NextResponse.json({ success: false, error: 'Staff member not found.' }, { status: 404 });
    }

    const newPayment = await AdvancePayment.create({
      ...body, // Use spread operator for cleaner assignment
      tenantId, // NEW: Assign the tenantId to the new record
      status: 'pending',
      requestDate: new Date(),
    });

    // Re-fetch and populate
    const populatedPayment = await AdvancePayment.findById(newPayment._id)
        .populate<{ staffId: PopulatedStaffDetails }>({ path: 'staffId', select: 'name image position', model: Staff })
        .lean<LeanAdvancePaymentDocument>();

    if (!populatedPayment) {
      return NextResponse.json({ success: false, error: 'Could not retrieve created record.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: formatPaymentResponse(populatedPayment) }, { status: 201 });

  } catch (error: any) {
    console.error('API POST /api/advance-payments Error:', error);
    if (error.name === 'ValidationError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Server error creating advance payment.' }, { status: 500 });
  }
}