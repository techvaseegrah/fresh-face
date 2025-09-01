import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import  dbConnect  from '@/lib/dbConnect';
import { GiftCard } from '@/models/GiftCard';

// POST endpoint to validate a gift card code
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) {
            return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
        }
        const tenantId = session.user.tenantId;
        
        await dbConnect();
        const { uniqueCode } = await req.json();

        if (!uniqueCode) {
            return NextResponse.json({ message: 'Gift card number is required.' }, { status: 400 });
        }

        const giftCard = await GiftCard.findOne({ uniqueCode: uniqueCode.toUpperCase(), tenantId });

        if (!giftCard) {
            return NextResponse.json({ message: 'Gift Card not found.' }, { status: 404 });
        }

        if (giftCard.status !== 'active') {
            return NextResponse.json({ message: `This gift card is already ${giftCard.status}.` }, { status: 400 });
        }

        if (new Date() > giftCard.expiryDate) {
            // Optional: Update status in DB if expired
            giftCard.status = 'expired';
            await giftCard.save();
            return NextResponse.json({ message: 'This gift card has expired.' }, { status: 400 });
        }

        if (giftCard.currentBalance <= 0) {
            return NextResponse.json({ message: 'This gift card has no balance.' }, { status: 400 });
        }

        // Return relevant details to the frontend
        return NextResponse.json({
            id: giftCard._id,
            uniqueCode: giftCard.uniqueCode,
            currentBalance: giftCard.currentBalance,
            expiryDate: giftCard.expiryDate,
            status: giftCard.status,
        }, { status: 200 });

    } catch (error) {
        console.error("Error validating gift card:", error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}