// /app/api/issue/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { v2 as cloudinary } from 'cloudinary';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import Issue, { IIssue } from '@/models/Issue';
import IssueSubmission, { IIssueSubmission } from '@/models/IssueSubmission';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { startOfDay } from 'date-fns';
import { Types } from 'mongoose';

// Ensure both Staff and User models are imported
import Staff from '@/models/staff';
import User from '@/models/user';

// --- Helper Types (No Changes) ---
interface PopulatedStaff {
    _id: Types.ObjectId;
    name: string;
    roleId: {
        _id: Types.ObjectId;
        displayName: string;
    };
}
interface PopulatedIssueTemplate {
    _id: Types.ObjectId;
    title: string;
    priority: 'high' | 'medium' | 'low' | 'none';
    createdAt: Date; // Add createdAt to the type
}
type PopulatedSubmission = Omit<IIssueSubmission, 'issue' | 'staff' | 'reviewedBy'> & {
    _id: Types.ObjectId;
    issue: PopulatedIssueTemplate | null;
    staff: PopulatedStaff | null;
    reviewedBy: { _id: Types.ObjectId; name: string } | null;
};

// --- Cloudinary Configuration (No Changes) ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
async function uploadToCloudinary(file: File): Promise<string> {
    const buffer = Buffer.from(await file.arrayBuffer());
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({ resource_type: "auto" }, (error, result) => {
            if (error) return reject(error);
            if (!result) return reject(new Error("Cloudinary upload failed with no result."));
            resolve(result.secure_url);
        });
        uploadStream.end(buffer);
    });
}

// --- POST Function (This is correct and needs no changes) ---
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session?.user?.role?.permissions, PERMISSIONS.ISSUE_MANAGE)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    try {
        await dbConnect();
        const formData = await req.formData();
        const title = formData.get('title') as string;
        const description = formData.get('description') as string;
        const priority = formData.get('priority') as string;
        const rolesJson = formData.get('roles') as string;
        const file = formData.get('file') as File | null;

        if (!title || !priority || !rolesJson) {
             return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        let fileUrl: string | undefined = undefined;
        if (file) {
            fileUrl = await uploadToCloudinary(file);
        }

        const roleIdStrings: string[] = JSON.parse(rolesJson);
        const roleObjectIds = roleIdStrings.map(id => new Types.ObjectId(id));
        
        const loggedInUserId = new Types.ObjectId(session.user.id);
        const staffCheck = await Staff.findById(loggedInUserId).lean();
        const creatorType = staffCheck ? 'Staff' : 'User';
        
        const newIssue = new Issue({
            title, description, priority,
            type: 'daily',
            roles: roleObjectIds,
            fileUrl: fileUrl,
            checklistItems: [{
                questionText: 'Is the issue resolved?',
                responseType: 'yes_no_remarks',
                mediaUpload: 'optional',
            }],
            tenantId,
            createdBy: loggedInUserId,
            createdByType: creatorType,
            isActive: true,
        });
        await newIssue.save();

        return NextResponse.json({
            message: "Issue template created successfully.",
            issue: newIssue
        }, { status: 201 });

    } catch (error: any) {
        console.error("ISSUE TEMPLATE CREATION API ERROR:", error);
        return NextResponse.json({ message: 'Server Error', error: error.message }, { status: 500 });
    }
}

// --- GET Function (Dashboard Data) ---
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions || [], PERMISSIONS.ISSUE_READ)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'today';
    await dbConnect();

    try {
        const todayStart = startOfDay(new Date());

        const baseQuery = (query: any): Promise<PopulatedSubmission[]> => {
            return query
                .populate('issue', 'title priority createdAt') // ✅ ADD createdAt HERE
                .populate({ path: 'staff', select: 'name roleId', populate: { path: 'roleId', select: 'displayName' } })
                .populate({ path: 'reviewedBy', select: 'name roleId', populate: { path: 'roleId', select: 'displayName name' }})
                .lean();
        };

        const formatSubmissionData = (sub: PopulatedSubmission, issueMap: Map<string, any>) => {
            const originalIssue = issueMap.get(sub.issue!._id.toString());
            if (!originalIssue || !sub.staff || !originalIssue.createdBy) {
                return null;
            }

            const assignee = sub.staff;
            const assigneeName = assignee.name;
            const assigneeRole = assignee.roleId?.displayName || 'Staff';

            const creator = originalIssue.createdBy as any;
            const creatorName = creator.name || 'Platform Admin';
            let creatorRole = 'Admin';
            if (originalIssue.createdByType === 'Staff' && creator.position) {
                creatorRole = creator.position;
            } else if (originalIssue.createdByType === 'User' && creator.roleId) {
                creatorRole = creator.roleId.displayName || creator.roleId.name || 'Admin';
            }
            
            const reviewer = sub.reviewedBy ? { 
                name: sub.reviewedBy.name, 
                role: (sub.reviewedBy as any).roleId?.displayName || 'Admin' 
            } : null;

            return {
                _id: sub._id.toString(),
                dataType: 'submission' as const,
                title: sub.issue!.title,
                status: sub.status,
                priority: sub.issue!.priority,
                submissionDate: sub.submissionDate.toISOString(),
                createdDate: sub.issue!.createdAt.toISOString(), // ✅ ADD createdDate TO RESPONSE
                assignee: { name: assigneeName, roles: [assigneeRole] }, 
                submittedBy: { name: creatorName, role: creatorRole }, 
                issueId: sub.issue!._id.toString(),
                reviewer: reviewer,
            };
        };

        if (filter === 'today') {
            const todaysSubmissions = await baseQuery(IssueSubmission.find({ tenantId, submissionDate: { $gte: todayStart } }));

            const submittedIssueIds = todaysSubmissions.map(s => s.issue!._id);
            const userCreatedSubmittedIssues = await Issue.find({ _id: { $in: submittedIssueIds }, createdByType: 'User' }).populate({ path: 'createdBy', populate: { path: 'roleId', select: 'displayName name' } }).lean();
            const staffCreatedSubmittedIssues = await Issue.find({ _id: { $in: submittedIssueIds }, createdByType: 'Staff' }).populate('createdBy').lean();
            const issueMap = new Map([...userCreatedSubmittedIssues, ...staffCreatedSubmittedIssues].map(issue => [issue._id.toString(), issue]));
            
            const formattedSubmissions = todaysSubmissions.map(sub => formatSubmissionData(sub, issueMap)).filter(Boolean);
            
            const userCreatedIssues = await Issue.find({ tenantId, isActive: true, createdByType: 'User', type: { $in: ['one_time', 'daily'] } }).populate('roles', 'displayName').populate({ path: 'createdBy', populate: { path: 'roleId', select: 'displayName name' } }).lean();
            const staffCreatedIssues = await Issue.find({ tenantId, isActive: true, createdByType: 'Staff', type: { $in: ['one_time', 'daily'] } }).populate('roles', 'displayName').populate('createdBy').lean();
            const reportedIssues = [...userCreatedIssues, ...staffCreatedIssues];

            const allSubmittedIdsSet = new Set(todaysSubmissions.map(s => s.issue!._id.toString()));
            const pendingReportedIssues = reportedIssues.filter(template => !allSubmittedIdsSet.has(template._id.toString()));
            
            const formatPendingIssue = (template: any) => {
                const creator = template.createdBy as any;
                if (!creator) return null;
                const creatorName = creator.name || 'Platform Admin';
                let creatorRole = 'Admin';
                if (template.createdByType === 'Staff' && creator.position) { creatorRole = creator.position; } 
                else if (template.createdByType === 'User' && creator.roleId) { creatorRole = creator.roleId.displayName || creator.roleId.name || 'Admin'; }
                return {
                    _id: template._id.toString(), dataType: 'template' as const, title: template.title, status: 'pending_assignment' as const, priority: template.priority,
                    submissionDate: null,
                    createdDate: template.createdAt.toISOString(), // ✅ ADD createdDate TO RESPONSE
                    assignee: { name: null, roles: template.roles.map((r: any) => r.displayName) },
                    submittedBy: { name: creatorName, role: creatorRole }, issueId: template._id.toString(), reviewer: null,
                };
            };
            const formattedReportedIssues = pendingReportedIssues.map(formatPendingIssue).filter(issue => issue !== null);

            return NextResponse.json([...formattedSubmissions, ...formattedReportedIssues]);
        }

        let queryOptions: any = { tenantId };
        if (filter === 'ongoing') queryOptions.status = { $in: ['pending_review'] };
        if (filter === 'completed') queryOptions.status = 'approved';
        if (filter === 'rejected') queryOptions.status = 'rejected';

        const submissions = await baseQuery(IssueSubmission.find(queryOptions).sort({ submissionDate: -1 }));
        
        const submittedIssueIds = submissions.map(s => s.issue!._id);
        const userCreatedSubmittedIssues = await Issue.find({ _id: { $in: submittedIssueIds }, createdByType: 'User' }).populate({ path: 'createdBy', populate: { path: 'roleId', select: 'displayName name' } }).lean();
        const staffCreatedSubmittedIssues = await Issue.find({ _id: { $in: submittedIssueIds }, createdByType: 'Staff' }).populate('createdBy').lean();
        const issueMap = new Map([...userCreatedSubmittedIssues, ...staffCreatedSubmittedIssues].map(issue => [issue._id.toString(), issue]));

        const formattedResults = submissions.map(sub => formatSubmissionData(sub, issueMap)).filter(Boolean);
        
        return NextResponse.json(formattedResults);

    } catch (error: any) {
        console.error(`Error fetching issues for filter "${filter}":`, error);
        return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
    }
}