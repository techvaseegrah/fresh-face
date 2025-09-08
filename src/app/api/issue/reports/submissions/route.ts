import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import User from '@/models/user';
import Issue from '@/models/Issue';
import IssueSubmission from '@/models/IssueSubmission';
import { startOfDay, endOfDay } from 'date-fns';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions || [], PERMISSIONS.ISSUE_REPORTS_READ)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!startDateParam || !endDateParam) {
        return NextResponse.json({ message: 'Start date and end date are required' }, { status: 400 });
    }
    await dbConnect();

    try {
        const startDate = startOfDay(new Date(startDateParam));
        const endDate = endOfDay(new Date(endDateParam));

        const staffMembers = await User.find({ tenantId, isActive: true })
            .populate('roleId', 'displayName _id').select('name roleId').lean();

        const activeIssues = await Issue.find({ tenantId, isActive: true })
            .select('_id title roles').lean();
        
        // ✅ THE FIX: The query now includes the 'responses' field.
        const submissions = await IssueSubmission.find({
            tenantId,
            submissionDate: { $gte: startDate, $lte: endDate },
        }).select('issue staff submissionDate status responses').lean(); // Added 'responses'
        
        return NextResponse.json({
            staff: staffMembers,
            issues: activeIssues,
            submissions: submissions
        });
    } catch (error: any) {
        console.error("Error generating Issue report:", error);
        return NextResponse.json({ message: 'Server Error', error: error.message }, { status: 500 });
    }
}