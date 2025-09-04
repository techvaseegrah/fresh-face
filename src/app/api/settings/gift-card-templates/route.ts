import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import  dbConnect  from '@/lib/dbConnect';
import { GiftCardTemplate } from '@/models/GiftCardTemplate';

// Helper function to get tenantId from session
async function getTenantId() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
        throw new Error("Tenant ID not found in session.");
    }
    return session.user.tenantId;
}

// GET all Gift Card Templates for the tenant
export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const tenantId = await getTenantId();

        const templates = await GiftCardTemplate.find({ tenantId });
        return NextResponse.json(templates, { status: 200 });
    } catch (error) {
        console.error("Error fetching gift card templates:", error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

// POST a new Gift Card Template
export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const tenantId = await getTenantId();
        const body = await req.json();

        const { name, description, amount, validityInDays, isActive } = body;

        if (!name || !amount || !validityInDays) {
            return NextResponse.json({ message: 'Name, amount, and validity are required.' }, { status: 400 });
        }
        
        const newTemplate = new GiftCardTemplate({
            ...body,
            tenantId,
        });

        await newTemplate.save();
        return NextResponse.json(newTemplate, { status: 201 });
    } catch (error) {
        console.error("Error creating gift card template:", error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}