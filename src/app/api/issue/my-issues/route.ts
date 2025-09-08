import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import Issue from '@/models/Issue';
import IssueSubmission from '@/models/IssueSubmission';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { startOfDay } from 'date-fns';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions || [], PERMISSIONS.ISSUE_SUBMIT_CHECKLIST)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;
    
    const userRoleId = session.user.role?.id || session.user.role;
    if (!userRoleId) {
        return NextResponse.json({ message: "User is not assigned to a role." }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const priorityFilter = searchParams.get('priority');
    
    await dbConnect();

    try {
        const today = startOfDay(new Date());
        
        const query: any = {
            tenantId,
            isActive: true,
            roles: { $in: [userRoleId] },
        };

        if (priorityFilter && ['high', 'medium', 'low'].includes(priorityFilter)) {
            query.priority = priorityFilter;
        }

        const issuesForRole = await Issue.find(query)
            .select('title description priority checklistItems')
            .lean();

        if (issuesForRole.length === 0) {
            return NextResponse.json([]);
        }

        const issueIds = issuesForRole.map(c => c._id);
        
        // ✅ THE CRITICAL CHANGE: Instead of searching for the user's own submissions,
        // we now search for ANY submission for the assigned issues for today.
        const sharedSubmissions = await IssueSubmission.find({
            tenantId, 
            submissionDate: { $gte: today },
            issue: { $in: issueIds }
        }).select('_id status reviewNotes issue responses').lean();

        // Now, we map the issues and attach the shared submission if one exists.
        const result = issuesForRole.map(issue => {
            const submission = sharedSubmissions.find(sub => sub.issue.toString() === issue._id.toString());
            return { ...issue, submission: submission || null };
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Error fetching my-issues:", error);
        return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
    }
}