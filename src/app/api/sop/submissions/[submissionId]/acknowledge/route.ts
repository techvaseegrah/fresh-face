import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import SopSubmission from '@/models/SopSubmission';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

/**
 * PUT: Approves a specific SOP submission.
 * This endpoint is called by a manager to acknowledge and approve a pending task.
 * It updates the submission's status to 'approved'.
 * @param req - The incoming NextRequest.
 * @param params - The route parameters, containing the submissionId.
 */
export async function PUT(req: NextRequest, { params }: { params: { submissionId: string } }) {
    const session = await getServerSession(authOptions);
    
    // Security: Ensure the user is logged in and has the permission to manage/review SOPs.
    if (!session?.user || !hasPermission(session.user.role?.permissions || [], PERMISSIONS.SOP_MANAGE)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    await dbConnect();

    try {
        // Find the submission by its ID and the manager's tenantId for security.
        // This prevents a manager from one company from acknowledging a submission from another.
        const updatedSubmission = await SopSubmission.findOneAndUpdate(
            { _id: params.submissionId, tenantId: tenantId },
            { 
                // The update operation: Set status to 'approved' and record who reviewed it.
                $set: { 
                    status: 'approved', 
                    reviewedBy: session.user.id 
                } 
            },
            { new: true } // This option returns the updated document after the change.
        );

        // If no document was found, return a 404 error.
        if (!updatedSubmission) {
            return NextResponse.json({ message: 'Submission not found or you do not have permission to access it.' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Submission approved successfully', submission: updatedSubmission });
    } catch (error: any) {
        console.error("Error approving submission:", error);
        return NextResponse.json({ message: 'Server Error', error: error.message }, { status: 500 });
    }
}