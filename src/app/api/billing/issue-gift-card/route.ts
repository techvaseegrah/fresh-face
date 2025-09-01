// Replace the entire content of this file with the new version below.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect  from '@/lib/dbConnect';
import { GiftCard } from '@/models/GiftCard';
import { GiftCardTemplate } from '@/models/GiftCardTemplate';
import  Customer  from '@/models/customermodel';
import { customAlphabet } from 'nanoid';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const nanoid = customAlphabet(alphabet, 10);

function generateUniqueCode() {
    return nanoid(); 
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId || !session?.user?.id) {
            return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
        }
        
        // Get the logged-in user's ID as a fallback
        const { tenantId, id: loggedInUserId } = session.user;

        await dbConnect();
        // --- THE FIX: Destructure the new staffId from the request body ---
        const { templateId, customerId, invoiceId, staffId } = await req.json();

        if (!templateId || !customerId || !invoiceId) {
            return NextResponse.json({ message: 'Template ID, Customer ID, and Invoice ID are required.' }, { status: 400 });
        }

        const template = await GiftCardTemplate.findById(templateId);
        if (!template || template.tenantId.toString() !== tenantId) {
            return NextResponse.json({ message: 'Gift Card Template not found.' }, { status: 404 });
        }

        const customer = await Customer.findById(customerId);
        if (!customer || customer.tenantId.toString() !== tenantId) {
            return NextResponse.json({ message: 'Customer not found.' }, { status: 404 });
        }

        const issueDate = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(issueDate.getDate() + template.validityInDays);
        
        // --- THE FIX: Use the provided staffId, or fallback to the logged-in user ---
        const issuerId = staffId || loggedInUserId;

        const newGiftCard = new GiftCard({
            uniqueCode: generateUniqueCode(),
            giftCardTemplateId: template._id,
            customerId: customer._id,
            initialBalance: template.amount,
            currentBalance: template.amount,
            issueDate,
            expiryDate,
            status: 'active',
            tenantId,
            issuedByStaffId: issuerId, // <-- Use the determined issuerId
            purchaseInvoiceId: invoiceId,
        });

        await newGiftCard.save();

        return NextResponse.json(newGiftCard, { status: 201 });

    } catch (error) {
        console.error("Error issuing gift card:", error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}