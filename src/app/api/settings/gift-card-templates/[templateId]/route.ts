import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import  dbConnect  from '@/lib/dbConnect';
import { GiftCardTemplate } from '@/models/GiftCardTemplate';

async function getTenantId() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
        throw new Error("Tenant ID not found in session.");
    }
    return session.user.tenantId;
}

// GET a single Gift Card Template
export async function GET(req: NextRequest, { params }: { params: { templateId: string } }) {
    try {
        await dbConnect();
        const tenantId = await getTenantId();
        const { templateId } = params;

        const template = await GiftCardTemplate.findOne({ _id: templateId, tenantId });
        if (!template) {
            return NextResponse.json({ message: 'Gift Card Template not found' }, { status: 404 });
        }
        return NextResponse.json(template, { status: 200 });
    } catch (error) {
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

// PUT (update) a Gift Card Template
export async function PUT(req: NextRequest, { params }: { params: { templateId: string } }) {
    try {
        await dbConnect();
        const tenantId = await getTenantId();
        const { templateId } = params;
        const body = await req.json();

        const updatedTemplate = await GiftCardTemplate.findOneAndUpdate(
            { _id: templateId, tenantId },
            body,
            { new: true, runValidators: true }
        );

        if (!updatedTemplate) {
            return NextResponse.json({ message: 'Gift Card Template not found' }, { status: 404 });
        }
        return NextResponse.json(updatedTemplate, { status: 200 });
    } catch (error) {
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE a Gift Card Template
export async function DELETE(req: NextRequest, { params }: { params: { templateId: string } }) {
    try {
        await dbConnect();
        const tenantId = await getTenantId();
        const { templateId } = params;

        const deletedTemplate = await GiftCardTemplate.findOneAndDelete({ _id: templateId, tenantId });

        if (!deletedTemplate) {
            return NextResponse.json({ message: 'Gift Card Template not found' }, { status: 404 });
        }
        return NextResponse.json({ message: 'Gift Card Template deleted successfully' }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}