// src/app/api/issue/[issueId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { v2 as cloudinary } from 'cloudinary';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import Issue from '@/models/Issue';
import IssueSubmission from '@/models/IssueSubmission';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

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
            if (error) {
                return reject(error);
            }
            if (!result) {
                return reject(new Error("Cloudinary upload failed with no result."));
            }
            resolve(result.secure_url);
        });
        uploadStream.end(buffer);
    });
}


// --- GET a single issue's details ---
export async function GET(req: NextRequest, { params }: { params: { issueId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions, PERMISSIONS.ISSUE_READ)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    await dbConnect();
    const issue = await Issue.findOne({ _id: params.issueId, tenantId }).populate('roles', 'displayName');
    if (!issue) {
        return NextResponse.json({ message: 'Issue not found' }, { status: 404 });
    }
    return NextResponse.json(issue);
}


// --- PUT (Update) an existing issue ---
export async function PUT(req: NextRequest, { params }: { params: { issueId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions, PERMISSIONS.ISSUE_MANAGE)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    try {
        await dbConnect();
        const formData = await req.formData();
        const updateData: any = {
            title: formData.get('title'),
            description: formData.get('description'),
            priority: formData.get('priority'),
            roles: JSON.parse(formData.get('roles') as string),
        };

        const file = formData.get('file') as File | null;
        if (file) {
            updateData.fileUrl = await uploadToCloudinary(file);
        } else if (formData.get('fileUrl') === 'null') {
            updateData.fileUrl = null;
        }

        const updatedIssue = await Issue.findOneAndUpdate(
            { _id: params.issueId, tenantId },
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedIssue) {
            return NextResponse.json({ message: 'Issue not found' }, { status: 404 });
        }
        return NextResponse.json(updatedIssue);

    } catch (error: any) {
        console.error("ISSUE UPDATE API ERROR:", error);
        return NextResponse.json({ message: 'Server Error', error: error.message }, { status: 500 });
    }
}


// --- DELETE an issue and all its related submissions ---
export async function DELETE(req: NextRequest, { params }: { params: { issueId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions, PERMISSIONS.ISSUE_MANAGE)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    try {
        await dbConnect();

        // Step 1: Delete the Issue Template
        const result = await Issue.deleteOne({ _id: params.issueId, tenantId });

        if (result.deletedCount === 0) {
            return NextResponse.json({ message: 'Issue not found' }, { status: 404 });
        }

        // Step 2: Delete all associated submissions (daily tasks)
        await IssueSubmission.deleteMany({ issue: params.issueId, tenantId });

        return NextResponse.json({ message: 'Issue and all its tasks deleted successfully' });
    } catch (error: any) {
        console.error("ISSUE DELETION API ERROR:", error);
        return NextResponse.json({ message: 'Server Error', error: error.message }, { status: 500 });
    }
}