import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import SopSubmission from '@/models/SopSubmission';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

export async function PUT(req: NextRequest, { params }: { params: { submissionId: string } }) {
    const session = await getServerSession(authOptions);
    // Ensure the user has the permission to manage/review SOPs
    if (!session?.user || !hasPermission(session.user.role?.permissions || [], PERMISSIONS.SOP_MANAGE)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    await dbConnect();

    try {
        // Find the submission by its ID and the manager's tenantId for security
        const updatedSubmission = await SopSubmission.findOneAndUpdate(
            { _id: params.submissionId, tenantId: tenantId },
            { 
                // --- THE FIX ---
                // Instead of setting 'isReviewed', we now set the 'status' to 'approved'.
                $set: { 
                    status: 'approved', 
                    reviewedBy: session.user.id 
                } 
                // --- END OF FIX ---
            },
            { new: true } // Return the updated document after the change
        );

        if (!updatedSubmission) {
            return NextResponse.json({ message: 'Submission not found or you do not have permission to access it.' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Submission approved successfully', submission: updatedSubmission });
    } catch (error: any) {
        console.error("Error approving submission:", error);
        return NextResponse.json({ message: 'Server Error', error: error.message }, { status: 500 });
    }
}