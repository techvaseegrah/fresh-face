// Add imports for all the models that are being populated.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import  dbConnect  from '@/lib/dbConnect';
import { safeDecrypt } from '@/lib/crypto'; 

// --- START: THE FIX ---
// Import the main model you are querying
import { GiftCard } from '@/models/GiftCard';

// Import EVERY model that you are using in a .populate() call
import '@/models/customermodel'; // For customerId
import '@/models/staff';         // For issuedByStaffId
import '@/models/GiftCardTemplate'; // For giftCardTemplateId
import '@/models/invoice';      // For purchaseInvoiceId
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
            query.issueDate = { $gte: fromDate, $lte: toDate };
        }

        // This query will now work because all referenced models are guaranteed to be registered.
        const soldCards = await GiftCard.find(query)
            .populate('customerId', 'name phoneNumber') 
            .populate('issuedByStaffId', 'name')
            .populate('giftCardTemplateId', 'name')
            .populate('purchaseInvoiceId', 'invoiceNumber')
            .sort({ issueDate: -1 })
            .lean();

        const decryptedSoldCards = soldCards.map(card => {
            let customerName = 'N/A';
            let customerPhone = 'N/A';

            if (card.customerId && typeof card.customerId === 'object') {
                customerName = safeDecrypt((card.customerId as any).name, 'customer name');
                customerPhone = safeDecrypt((card.customerId as any).phoneNumber, 'customer phone');
            }
            
            return {
                ...card,
                customerId: {
                    name: customerName,
                    phoneNumber: customerPhone,
                }
            };
        });

        return NextResponse.json(decryptedSoldCards, { status: 200 });
    } catch (error) {
        console.error("Error fetching sold gift cards report:", error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}