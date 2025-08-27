import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import Sop from '@/models/Sop';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

// GET: a single SOP by ID
export async function GET(req: NextRequest, { params }: { params: { sopId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions, PERMISSIONS.SOP_READ)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    await dbConnect();
    const sop = await Sop.findOne({ _id: params.sopId, tenantId }).populate('roles', 'displayName');
    if (!sop) return NextResponse.json({ message: 'SOP not found' }, { status: 404 });

    return NextResponse.json(sop);
}

// PUT: Update an SOP
export async function PUT(req: NextRequest, { params }: { params: { sopId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions, PERMISSIONS.SOP_MANAGE)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    await dbConnect();
    try {
        const body = await req.json();
        const updatedSop = await Sop.findOneAndUpdate(
            { _id: params.sopId, tenantId },
            body,
            { new: true, runValidators: true }
        );
        if (!updatedSop) return NextResponse.json({ message: 'SOP not found' }, { status: 404 });
        return NextResponse.json(updatedSop);
    } catch (error) {
        return NextResponse.json({ message: 'Server Error', error }, { status: 500 });
    }
}

// DELETE: an SOP
export async function DELETE(req: NextRequest, { params }: { params: { sopId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions, PERMISSIONS.SOP_MANAGE)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    await dbConnect();
    const result = await Sop.deleteOne({ _id: params.sopId, tenantId });
    if (result.deletedCount === 0) return NextResponse.json({ message: 'SOP not found' }, { status: 404 });

    return NextResponse.json({ message: 'SOP deleted successfully' });
}