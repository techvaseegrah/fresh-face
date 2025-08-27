import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import SopSubmission from '@/models/SopSubmission';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

/**
 * PUT: Rejects a specific SOP submission.
 * This endpoint is called by a manager to reject a pending task.
 * It updates the submission's status to 'rejected' and saves the manager's feedback.
 * @param req - The incoming NextRequest, containing the rejection notes in the body.
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

    // --- ROBUSTNESS: Wrap core logic in a try...catch block ---
    try {
        const { notes } = await req.json(); // Manager's notes from the request body
        
        // Validation: Ensure rejection notes are provided.
        if (!notes || typeof notes !== 'string' || notes.trim() === '') {
            return NextResponse.json({ message: 'Rejection notes are required.' }, { status: 400 });
        }
    
        // Find the submission by its ID and the manager's tenantId for security.
        const updatedSubmission = await SopSubmission.findOneAndUpdate(
            { _id: params.submissionId, tenantId: tenantId },
            { 
                // The update operation: Set status to 'rejected' and save the feedback.
                $set: { 
                    status: 'rejected', 
                    reviewNotes: notes.trim(), // Trim whitespace from notes
                    reviewedBy: session.user.id 
                } 
            },
            { new: true } // Return the updated document.
        );
        
        // If no document was found, return a 404 error.
        if (!updatedSubmission) {
            return NextResponse.json({ message: 'Submission not found or you do not have permission to access it.' }, { status: 404 });
        }
    
        return NextResponse.json({ message: 'Submission rejected successfully', submission: updatedSubmission });

    } catch (error: any) {
        console.error("Error rejecting submission:", error);
        return NextResponse.json({ message: 'Server Error', error: error.message }, { status: 500 });
    }
}