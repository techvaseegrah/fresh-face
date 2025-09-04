import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';

// --- Import all required models for this transaction ---
import CustomerPackage from '@/models/CustomerPackage';
import CustomerPackageLog from '@/models/CustomerPackageLog';
// --------------------------------------------------------

interface RedeemPackageRequestBody {
  customerPackageId: string;
  itemId: string; // The specific service/product ObjectId being redeemed
  itemType: 'service' | 'product';
  quantityRedeemed: number;
  invoiceId: string; // The invoice this redemption is part of
}

/**
 * @method POST
 * @description Redeems an item from a customer's package. This operation is transactional.
 * @permission manage:pos (or a similar permission for making sales)
 */
export async function POST(request: NextRequest) {
    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId || !session?.user?.id ) {
            await dbSession.abortTransaction();
            dbSession.endSession();
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        const tenantId = session.user.tenantId;
        const redeemedBy = session.user.id; // Staff member's ID from session

        const body: RedeemPackageRequestBody = await request.json();
        const { customerPackageId, itemId, itemType, quantityRedeemed, invoiceId } = body;

        // --- Server-side Validation ---
        if (!customerPackageId || !itemId || !invoiceId || !quantityRedeemed || quantityRedeemed <= 0) {
            await dbSession.abortTransaction();
            dbSession.endSession();
            return NextResponse.json({ message: 'Validation Error: Missing required fields.' }, { status: 400 });
        }

        await dbConnect();
        
        // --- Fetch the package within the transaction ---
        const customerPackage = await CustomerPackage.findOne({ _id: customerPackageId, tenantId }).session(dbSession);

        if (!customerPackage) {
            throw new Error('Customer package not found.');
        }

        // --- Business Logic & State Validation ---
        if (customerPackage.status !== 'active') {
            throw new Error(`Package is not active. Current status: ${customerPackage.status}.`);
        }
        if (new Date() > customerPackage.expiryDate) {
            // Optional: You could also update the status to 'expired' here
            customerPackage.status = 'expired';
            await customerPackage.save({ session: dbSession });
            throw new Error('This package has expired.');
        }

        const itemToRedeem = customerPackage.remainingItems.find(
            (item) => item.itemId.toString() === itemId && item.itemType === itemType
        );

        if (!itemToRedeem) {
            throw new Error('The specified item is not part of this package.');
        }
        if (itemToRedeem.remainingQuantity < quantityRedeemed) {
            throw new Error(`Insufficient quantity. Remaining: ${itemToRedeem.remainingQuantity}, Tried to redeem: ${quantityRedeemed}.`);
        }

        // --- Perform Updates ---
        itemToRedeem.remainingQuantity -= quantityRedeemed;

        const isCompleted = customerPackage.remainingItems.every(item => item.remainingQuantity === 0);
        if (isCompleted) {
            customerPackage.status = 'completed';
        }

        await customerPackage.save({ session: dbSession });

        // --- Create Audit Log Entry ---
        const logEntry = new CustomerPackageLog({
            tenantId,
            customerPackageId,
            customerId: customerPackage.customerId,
            redeemedItemId: itemId,
            redeemedItemType: itemType,
            quantityRedeemed,
            invoiceId,
            redeemedBy,
        });

        await logEntry.save({ session: dbSession });

        // If all operations succeed, commit the transaction
        await dbSession.commitTransaction();
        dbSession.endSession();

        return NextResponse.json(customerPackage, { status: 200 });
    } catch (error: any) {
        // If any error occurs, abort the entire transaction
        await dbSession.abortTransaction();
        dbSession.endSession();
        console.error("Error redeeming package item:", error);
        return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 400 }); // 400 for business logic errors
    }
}