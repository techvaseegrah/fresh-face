import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import SopSubmission from '@/models/SopSubmission';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

export async function PUT(req: NextRequest, { params }: { params: { submissionId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions, PERMISSIONS.SOP_MANAGE)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    const { notes } = await req.json(); // Manager's notes from the request body
    if (!notes) {
        return NextResponse.json({ message: 'Rejection notes are required.' }, { status: 400 });
    }

    await dbConnect();
    
    const updatedSubmission = await SopSubmission.findOneAndUpdate(
        { _id: params.submissionId, tenantId: tenantId },
        { 
            $set: { 
                status: 'rejected', 
                reviewNotes: notes,
                reviewedBy: session.user.id 
            } 
        },
        { new: true }
    );
    
    if (!updatedSubmission) {
        return NextResponse.json({ message: 'Submission not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Submission rejected', submission: updatedSubmission });
}