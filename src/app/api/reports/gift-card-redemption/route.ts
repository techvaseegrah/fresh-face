// Replace the entire content of this file with the new version below.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import  dbConnect  from '@/lib/dbConnect';
import { safeDecrypt } from '@/lib/crypto';

// --- START: THE FIX (Step 1) ---
// Import the main model you are querying
import { GiftCardLog } from '@/models/GiftCardLog';

// Import EVERY model that you are using in a .populate() call
import '@/models/customermodel';     // For customerId
import '@/models/GiftCard';         // For giftCardId
import '@/models/GiftCardTemplate'; // For the nested populate
// --- END: THE FIX ---

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) {
            return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
        }
        const tenantId = session.user.tenantId;

        const { searchParams } = new URL(req.url);
        const fromDateStr = searchParams.get('from');
        const toDateStr = searchParams.get('to');

        await dbConnect();

        let query: any = { tenantId };
        if (fromDateStr && toDateStr) {
            const fromDate = new Date(fromDateStr);
            const toDate = new Date(toDateStr);
            toDate.setHours(23, 59, 59, 999);
            // Filter by the log's creation date
            query.createdAt = { $gte: fromDate, $lte: toDate };
        }

        const redemptionLogs = await GiftCardLog.find(query)
            .populate('customerId', 'name phoneNumber') // Request name and phoneNumber
            .populate({
                path: 'giftCardId',
                select: 'uniqueCode giftCardTemplateId',
                populate: {
                    path: 'giftCardTemplateId',
                    select: 'name'
                }
            })
            .sort({ createdAt: -1 })
            .lean(); // Use .lean() for performance

        // --- START: THE FIX (Step 2) ---
        // Manually decrypt sensitive fields and format the data for the report
        const formattedLogs = redemptionLogs.map(log => {
            let guestName = 'N/A';
            let guestNumber = 'N/A';

            if (log.customerId && typeof log.customerId === 'object') {
                guestName = safeDecrypt((log.customerId as any).name, 'customer name');
                guestNumber = safeDecrypt((log.customerId as any).phoneNumber, 'customer phone');
            }

            // This structure matches your original API response shape
            return {
                _id: log._id,
                redemptionDate: log.createdAt,
                // Use optional chaining for safety in case of deleted data
                giftCardName: (log.giftCardId as any)?.giftCardTemplateId?.name || 'N/A',
                giftCardNumber: (log.giftCardId as any)?.uniqueCode || 'N/A',
                guestName: guestName,
                guestNumber: guestNumber,
                amountRedeemed: log.amountRedeemed,
                balanceAfter: log.balanceAfter,
                invoiceId: log.invoiceId,
            };
        });
        // --- END: THE FIX ---

        return NextResponse.json(formattedLogs, { status: 200 });
    } catch (error) {
        console.error("Error fetching gift card redemption report:", error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}