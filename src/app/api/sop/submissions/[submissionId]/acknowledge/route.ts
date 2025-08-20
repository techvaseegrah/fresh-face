import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import SopSubmission from '@/models/SopSubmission';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

export async function PUT(req: NextRequest, { params }: { params: { submissionId: string } }) {
    const session = await getServerSession(authOptions);
    // Use a permission like SOP_MANAGE or SOP_REPORTS_READ to protect this
    if (!session?.user || !hasPermission(session.user.role?.permissions || [], PERMISSIONS.SOP_MANAGE)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    await dbConnect();

    try {
        const updatedSubmission = await SopSubmission.findOneAndUpdate(
            { _id: params.submissionId, tenantId: tenantId },
            { 
                $set: { 
                    isReviewed: true, 
                    reviewedBy: session.user.id 
                } 
            },
            { new: true } // Return the updated document
        );

        if (!updatedSubmission) {
            return NextResponse.json({ message: 'Submission not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Submission acknowledged', submission: updatedSubmission });
    } catch (error) {
        console.error("Error acknowledging submission:", error);
        return NextResponse.json({ message: 'Server Error' }, { status: 500 });
    }
}