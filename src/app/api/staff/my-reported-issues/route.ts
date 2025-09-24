// /app/api/staff/my-reported-issues/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import Issue from '@/models/Issue';
import IssueSubmission from '@/models/IssueSubmission';
import { Types } from 'mongoose';

// Ensure User and Staff models are imported for population
import User from '@/models/user';
import Staff from '@/models/staff';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    // Assumes the staff's ID is available in the session object
    if (!session?.user?.id) {
        return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    await dbConnect();

    try {
        const staffId = new Types.ObjectId(session.user.id);

        // 1. Find all issues created by the logged-in staff member
        const reportedIssues = await Issue.find({
            tenantId,
            createdBy: staffId,
            createdByType: 'Staff', // Ensure we only get issues created by staff
        })
        .select('title description priority createdAt fileUrl')
        .sort({ createdAt: -1 }) // Show the most recent issues first
        .lean();

        if (reportedIssues.length === 0) {
            return NextResponse.json([]);
        }

        const issueIds = reportedIssues.map(issue => issue._id);

        // 2. Find all submissions related to these issues and populate solver/reviewer details
        const submissions = await IssueSubmission.find({
            issue: { $in: issueIds },
            tenantId,
        })
        .populate({
            // ✅ START OF FIX: Corrected the model from 'Staff' to 'User' to match the schema.
            path: 'staff',
            model: 'User', // The 'staff' field refers to the User who submitted the solution
            select: 'name roleId', // Select name and role reference
            populate: { path: 'roleId', select: 'displayName' } // Also get the role's display name
            // ✅ END OF FIX
        })
        .populate({
            path: 'reviewedBy',
            model: 'User', // The 'reviewedBy' field refers to the Admin/User who approved it
            select: 'name',
        })
        .select('issue status submissionDate reviewedAt')
        .lean();

        // 3. Map submissions back to their original issues
        const results = reportedIssues.map(issue => {
            const submission = submissions.find(sub => sub.issue.toString() === issue._id.toString());
            return {
                ...issue,
                submission: submission || null, // Attach submission details, or null if none exists
            };
        });

        return NextResponse.json(results);

    } catch (error: any) {
        console.error("Error fetching staff's reported issues:", error);
        return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
    }
}