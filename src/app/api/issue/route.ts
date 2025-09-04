// src/app/api/issue/route.ts

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

// ✅ This is critical for Mongoose's dynamic population to work
import Staff from '@/models/staff';
import User from '@/models/user';

// --- Helper Types ---
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
}
type PopulatedSubmission = Omit<IIssueSubmission, 'issue' | 'staff' | 'reviewedBy'> & {
    _id: Types.ObjectId;
    issue: PopulatedIssueTemplate | null;
    staff: PopulatedStaff | null;
    reviewedBy: { _id: Types.ObjectId; name: string } | null;
};

// --- Cloudinary Configuration ---
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

// --- POST Function (Admin Creates Template) ---
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
            createdBy: session.user.id,
            // ✅ FIX: Specify that the creator is a 'User' (admin).
            createdByType: 'User',
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

        const baseQuery = async (query: any): Promise<PopulatedSubmission[]> => {
            return await query
                .populate('issue', 'title priority')
                .populate({ path: 'staff', select: 'name roleId', populate: { path: 'roleId', select: 'displayName' } })
                .populate('reviewedBy', 'name')
                .lean();
        };

        const formatSubmission = (sub: PopulatedSubmission) => ({
            _id: sub._id.toString(),
            dataType: 'submission' as const,
            title: sub.issue!.title,
            status: sub.status,
            priority: sub.issue!.priority,
            submissionDate: sub.submissionDate.toISOString(),
            assignee: { name: sub.staff!.name, roles: [sub.staff!.roleId?.displayName || 'Unknown Role'] },
            issueId: sub.issue!._id.toString(),
            reviewer: sub.reviewedBy ? { name: sub.reviewedBy.name } : null,
        });

        if (filter === 'today') {
            const todaysSubmissions = await baseQuery(IssueSubmission.find({ tenantId, submissionDate: { $gte: todayStart } }));
            
            const dailyTemplates = await Issue.find({ tenantId, isActive: true, type: 'daily' }).populate('roles', 'displayName').lean();

            const reportedIssues = await Issue.find({ tenantId, isActive: true, type: 'one_time' })
                .populate('roles', 'displayName')
                // ✅ This now populates the creator's name from either 'User' or 'Staff' model
                .populate('createdBy', 'name')
                .lean();

            const submittedIssueIds = new Set(todaysSubmissions.map((s) => s.issue?._id.toString()));
            const pendingTemplates = dailyTemplates.filter((template) => !submittedIssueIds.has(template._id.toString()));
            const formattedSubmissions = todaysSubmissions.filter((sub) => sub.issue && sub.staff).map(formatSubmission);
            
            const formatPendingIssue = (template: any) => ({
                _id: template._id.toString(),
                dataType: 'template' as const,
                title: template.title,
                status: 'pending_assignment' as const,
                priority: template.priority,
                submissionDate: null,
                assignee: {
                    // This will now show the correct creator's name (admin or staff)
                    name: (template.createdBy as any)?.name || 'Deleted User',
                    roles: template.roles.map((r: any) => r.displayName)
                },
                issueId: template._id.toString(),
                reviewer: null,
            });

            const formattedPendingTemplates = pendingTemplates.map(formatPendingIssue);
            const formattedReportedIssues = reportedIssues.map(formatPendingIssue);

            return NextResponse.json([...formattedSubmissions, ...formattedPendingTemplates, ...formattedReportedIssues]);
        }

        let queryOptions: any = { tenantId };
        switch(filter) {
            case 'ongoing': queryOptions.status = { $in: ['pending_review'] }; break;
            case 'completed': queryOptions.status = 'approved'; break;
            case 'rejected': queryOptions.status = 'rejected'; break;
            default: return NextResponse.json([]);
        }
        
        const submissions = await baseQuery(IssueSubmission.find(queryOptions).sort({ submissionDate: -1 }));
        const formattedResults = submissions.filter((sub) => sub.issue && sub.staff).map(formatSubmission);
        return NextResponse.json(formattedResults);

    } catch (error: any) {
        console.error(`Error fetching issues for filter "${filter}":`, error);
        return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
    }
}