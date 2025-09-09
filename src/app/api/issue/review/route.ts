// /app/api/issues/review/route.ts

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

  if (!session?.user || !hasPermission(session.user.role?.permissions || [], PERMISSIONS.ISSUE_MANAGE)) {
      return NextResponse.json({ 
         success: false, 
         message: 'Forbidden: You do not have permission to review issue submissions.' 
       }, { status: 403 });
  }

  const tenantId = getTenantIdOrBail(request);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  await dbConnect();

  try {
    const { submissionId, newStatus } = await request.json();

    if (!submissionId || !['approved', 'rejected'].includes(newStatus)) {
      return NextResponse.json({ 
         success: false, 
         message: 'Invalid parameters provided. submissionId and newStatus (\'approved\' or \'rejected\') are required.' 
       }, { status: 400 });
    }

    const updatedSubmission = await IssueSubmission.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(submissionId),
        tenantId, 
      },
      {
        $set: {
          status: newStatus,
          reviewedBy: new mongoose.Types.ObjectId(session.user.id),
          
          // ✅ FIX: We must specify the type of the reviewer so Mongoose's 'refPath' can work correctly.
          reviewedByType: 'User',

          reviewedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updatedSubmission) {
      return NextResponse.json({ 
         success: false, 
         message: 'Submission not found. It may have been deleted or does not belong to your organization.' 
       }, { status: 404 });
    }

    return NextResponse.json({ 
       success: true, 
       message: `Submission has been successfully ${newStatus}.`,
      data: updatedSubmission
    });

  } catch (error: any) {
    console.error('Error updating issue review status:', error);
    return NextResponse.json({ 
       success: false, 
       message: 'An unexpected server error occurred while updating the issue status.' 
     }, { status: 500 });
  }
}