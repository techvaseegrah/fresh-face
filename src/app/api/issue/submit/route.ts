import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { v2 as cloudinary } from 'cloudinary';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import IssueSubmission from '@/models/IssueSubmission';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { startOfDay } from 'date-fns';

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
            if (!result) return reject(new Error("Cloudinary upload failed."));
            resolve(result.secure_url);
        });
        uploadStream.end(buffer);
    });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions || [], PERMISSIONS.ISSUE_SUBMIT_CHECKLIST)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;
    
    try {
        await dbConnect();
        const formData = await req.formData();
        const issueId = formData.get('issueId') as string;
        const itemsJson = formData.get('items') as string;

        if (!issueId || !itemsJson) {
            return NextResponse.json({ message: 'Missing required data' }, { status: 400 });
        }
        
        const parsedResponses = JSON.parse(itemsJson);
        const file = formData.get('files[0]') as File | null;

        if (file && parsedResponses[0]) {
            const mediaUrl = await uploadToCloudinary(file);
            parsedResponses[0].mediaUrl = mediaUrl;
        }
        
        const today = startOfDay(new Date());

        // ✅ THE CRITICAL CHANGE: The query to find the document no longer includes the staff ID.
        // It now finds the single shared document for the issue for today.
        const submission = await IssueSubmission.findOneAndUpdate(
            { issue: issueId, tenantId, submissionDate: { $gte: today } },
            // We set the staff ID here, so we always know who was the last person to submit it.
            { $set: { responses: parsedResponses, status: 'pending_review', staff: session.user.id, submissionDate: new Date() } },
            { new: true, upsert: true }
        );
        
        return NextResponse.json({ message: 'Issue submitted successfully', submission });
    } catch (error: any) {
        console.error("Issue Submission API Error:", error);
        return NextResponse.json({ message: error.message || 'Server Error' }, { status: 500 });
    }
}