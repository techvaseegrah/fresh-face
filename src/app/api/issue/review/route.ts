import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import IssueSubmission from '@/models/IssueSubmission';
import { getTenantIdOrBail } from '@/lib/tenant';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import mongoose from 'mongoose';

/**
 * API endpoint to handle the review of an issue submission.
 * Allows an authorized user (with ISSUE_MANAGE permission) to approve or reject a submission.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  // 1. Authentication and Authorization Check
  // Ensures the user is logged in and has the necessary permissions to review issues.
  if (!session?.user || !hasPermission(session.user.role?.permissions || [], PERMISSIONS.ISSUE_MANAGE)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Forbidden: You do not have permission to review issue submissions.' 
      }, { status: 403 });
  }

  // 2. Tenant Isolation
  // Retrieves the tenant ID from the request headers to ensure data is not leaked between tenants.
  const tenantId = getTenantIdOrBail(request);
  if (tenantId instanceof NextResponse) {
    return tenantId; // Return error response if tenant ID is missing
  }

  await dbConnect();

  try {
    // 3. Input Parsing and Validation
    const { submissionId, newStatus } = await request.json();

    if (!submissionId || !['approved', 'rejected'].includes(newStatus)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid parameters provided. `submissionId` and `newStatus` (\'approved\' or \'rejected\') are required.' 
      }, { status: 400 });
    }

    // 4. Database Operation
    // Finds the specific submission by its ID and the current tenant, then updates its status.
    const updatedSubmission = await IssueSubmission.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(submissionId),
        tenantId, // Ensures the update only happens within the correct tenant
      },
      {
        $set: {
          status: newStatus,
          reviewedBy: new mongoose.Types.ObjectId(session.user.id), // Record who performed the review
          reviewedAt: new Date(), // Record when the review happened
        },
      },
      { new: true } // Returns the updated document
    );

    // 5. Handle Not Found Case
    if (!updatedSubmission) {
      return NextResponse.json({ 
        success: false, 
        message: 'Submission not found. It may have been deleted or does not belong to your organization.' 
      }, { status: 404 });
    }

    // 6. Success Response
    return NextResponse.json({ 
      success: true, 
      message: `Submission has been successfully ${newStatus}.`,
      data: updatedSubmission
    });

  } catch (error: any) {
    // 7. Error Handling
    console.error('Error updating issue review status:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'An unexpected server error occurred while updating the issue status.' 
    }, { status: 500 });
  }
}