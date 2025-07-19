// src/app/api/advance-payments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { formatISO } from 'date-fns';
import mongoose, { Types } from 'mongoose';
import dbConnect from '../../../../lib/mongodb';
import AdvancePayment from '../../../../models/advance';
import Staff from '../../../../models/staff'; // The Staff model is needed for population

// --- Type Definitions (Consistent with the main route file) ---
interface PopulatedStaffDetails {
  _id: Types.ObjectId;
  name: string;
  image?: string;
  position?: string;
}

interface LeanAdvancePaymentDocument {
  _id: Types.ObjectId;
  // FIX: staffId can now be null after a failed populate
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

// --- Helper Function (To format the response consistently) ---
// FIX: This function now safely handles cases where payment.staffId is null.
const formatPaymentResponse = (payment: LeanAdvancePaymentDocument) => ({
  id: payment._id.toString(),
  staffId: payment.staffId ? { // Check if staffId exists
    id: payment.staffId._id.toString(),
    name: payment.staffId.name,
    image: payment.staffId.image,
    position: payment.staffId.position,
  } : null, // If not, return null
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
  const { id: paymentId } = params;

  if (!mongoose.Types.ObjectId.isValid(paymentId)) {
    return NextResponse.json({ success: false, error: 'Invalid payment ID format.' }, { status: 400 });
  }

  try {
    await dbConnect();
    const body = (await request.json()) as UpdateAdvanceStatusPayload;
    
    // Validate the incoming status
    if (!body.status || !['approved', 'rejected'].includes(body.status)) {
        return NextResponse.json({ success: false, error: 'Invalid status. Must be "approved" or "rejected".' }, { status: 400 });
    }

    // Prepare the fields to be updated
    const updateFields: { status: 'approved' | 'rejected', approvedDate?: Date | null } = {
        status: body.status,
    };
    
    if (body.status === 'approved') {
        updateFields.approvedDate = new Date();
    } else {
        updateFields.approvedDate = null;
    }

    // Find the document, update it, and return the new version
    const updatedPayment = await AdvancePayment.findByIdAndUpdate(
        paymentId,
        { $set: updateFields },
        { new: true, runValidators: true } // `new: true` returns the modified document
    )
    .populate<{ staffId: PopulatedStaffDetails }>({ path: 'staffId', select: 'name image position', model: Staff })
    .lean<LeanAdvancePaymentDocument>();

    if (!updatedPayment) {
      return NextResponse.json({ success: false, error: 'Advance payment not found.' }, { status: 404 });
    }

    // Return the fully populated and formatted updated payment
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
    const { id: paymentId } = params;

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return NextResponse.json({ success: false, error: 'Invalid payment ID format.' }, { status: 400 });
    }
  
    try {
      await dbConnect();
      const deletedPayment = await AdvancePayment.findByIdAndDelete(paymentId);
  
      if (!deletedPayment) {
        return NextResponse.json({ success: false, error: 'Advance payment not found.' }, { status: 404 });
      }
  
      // Return a success message and the ID of the deleted item for the client to use
      return NextResponse.json({ success: true, message: 'Advance payment deleted successfully.', data: { id: paymentId } });
  
    } catch (error: any) {
      console.error(`API DELETE /api/advance-payments/${paymentId} Error:`, error);
      return NextResponse.json({ success: false, error: 'Server error deleting advance payment.' }, { status: 500 });
    }
}