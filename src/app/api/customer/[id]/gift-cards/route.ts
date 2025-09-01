import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import { GiftCard } from '@/models/GiftCard';

// The type definition for params is updated to expect 'id'
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) {
            return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
        }
        
        await dbConnect();
        
        // --- THE ONLY CHANGE IS HERE ---
        // We read `params.id` and assign it to a variable called `customerId`
        const { id: customerId } = params; 
        const tenantId = session.user.tenantId;

        // The rest of the code works perfectly with the 'customerId' variable
        const giftCards = await GiftCard.find({ 
            customerId, 
            tenantId,
            status: 'active',
            currentBalance: { $gt: 0 } 
        })
        .populate('giftCardTemplateId', 'name')
        .sort({ createdAt: -1 });

        return NextResponse.json(giftCards, { status: 200 });

    } catch (error) {
        console.error("Error fetching customer's gift cards:", error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}