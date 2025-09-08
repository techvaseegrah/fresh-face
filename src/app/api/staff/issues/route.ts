import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { v2 as cloudinary } from 'cloudinary';
import { authOptions } from '@/lib/auth'; // Ensure you have auth options that can handle staff sessions
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import Issue from '@/models/Issue';
import { Types } from 'mongoose';

// --- Cloudinary Configuration ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadToCloudinary(file: File): Promise<string> {
    const buffer = Buffer.from(await file.arrayBuffer());
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: "auto" },
            (error, result) => {
                if (error) return reject(error);
                if (!result) return reject(new Error("Cloudinary upload failed."));
                resolve(result.secure_url);
            }
        );
        uploadStream.end(buffer);
    });
}

// --- POST Function to Create a Staff-Reported Issue ---
export async function POST(req: NextRequest) {
    // Assuming staff are also authenticated via NextAuth and their session contains their staff ID
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    try {
        await dbConnect();
        const formData = await req.formData();
        const title = formData.get('title') as string;
        const description = formData.get('description') as string;
        const priority = formData.get('priority') as 'high' | 'medium' | 'low';
        // Staff-reported issues are typically assigned to admin/manager roles for review
        const rolesJson = formData.get('roles') as string; 
        const file = formData.get('file') as File | null;

        if (!title || !rolesJson) {
             return NextResponse.json({ message: 'Title and assigning at least one Role are required' }, { status: 400 });
        }
        
        const roleIdStrings: string[] = JSON.parse(rolesJson);
        if (roleIdStrings.length === 0) {
            return NextResponse.json({ message: 'At least one role must be assigned for review' }, { status: 400 });
        }
        const roleObjectIds = roleIdStrings.map(id => new Types.ObjectId(id));

        let fileUrl: string | undefined = undefined;
        if (file) {
            fileUrl = await uploadToCloudinary(file);
        }
        
        const newIssue = new Issue({
            title,
            description,
            priority: priority || 'medium',
            roles: roleObjectIds, // Roles who can see/manage this issue
            type: 'one_time', // Staff issues are always one-time reports
            checklistItems: [{
                questionText: 'Acknowledge and address the reported issue.',
                responseType: 'yes_no_remarks',
                mediaUpload: 'optional',
            }],
            fileUrl: fileUrl,
            tenantId,

            // ✅ THE FIX: Explicitly set the creator's ID and their type ('Staff')
            createdBy: new Types.ObjectId(session.user.id),
            createdByType: 'Staff', 

            isActive: true,
        });

        await newIssue.save();

        return NextResponse.json({
            message: "Issue reported successfully. Admin has been notified.",
            issue: newIssue
        }, { status: 201 });

    } catch (error: any) {
        console.error("STAFF ISSUE CREATION API ERROR:", error);
        return NextResponse.json({ message: 'Server Error', error: error.message }, { status: 500 });
    }
}