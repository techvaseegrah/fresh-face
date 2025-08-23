import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { v2 as cloudinary } from 'cloudinary';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import SopSubmission from '@/models/SopSubmission';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { startOfDay } from 'date-fns';

// Configure Cloudinary (remains the same)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to upload media (remains the same)
async function uploadMedia(buffer: Buffer, tenantId: string, staffId: string, date: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { 
        resource_type: 'video', 
        folder: `sop-submissions/${tenantId}/${date}`,
        public_id: `staff_${staffId}_${Date.now()}`
      },
      (error, result) => {
        if (error) return reject(error);
        if (result) return resolve(result.secure_url);
        reject(new Error("Cloudinary upload failed."));
      }
    );
    uploadStream.end(buffer);
  });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions || [], PERMISSIONS.SOP_SUBMIT_CHECKLIST)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    try {
        const formData = await req.formData();
        const sopId = formData.get('sopId') as string;
        const responsesJson = formData.get('responses') as string;
        const files = formData.getAll('files') as File[];

        if (!sopId || !responsesJson || files.length === 0) {
            return NextResponse.json({ message: 'Missing required data' }, { status: 400 });
        }

        // Server-side file size validation (remains the same and is crucial)
        const MAX_FILE_SIZE_MB = 10;
        const maxFileSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
        for (const file of files) {
            if (file.size > maxFileSizeBytes) {
                return NextResponse.json({ message: `File "${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit.` }, { status: 400 });
            }
        }

        const responses = JSON.parse(responsesJson);
        
        await dbConnect();
        
        // Upload all media files to Cloudinary in parallel
        const processedResponses = await Promise.all(
            responses.map(async (response: any, index: number) => {
                const file = files[index];
                if (file) {
                    const buffer = Buffer.from(await file.arrayBuffer());
                    const dateString = new Date().toISOString().split('T')[0];
                    const url = await uploadMedia(buffer, tenantId.toString(), session.user.id, dateString);
                    // --- CORRECTED ---: Use the new 'mediaUrl' field name to match the schema
                    return { ...response, mediaUrl: url };
                }
                return response;
            })
        );
        
        const today = startOfDay(new Date());

        // --- NEW WORKFLOW LOGIC ---
        // Check if there is an existing 'rejected' submission for this SOP, user, and day.
        const existingRejectedSubmission = await SopSubmission.findOne({
            sop: sopId,
            staff: session.user.id,
            submissionDate: today,
            status: 'rejected',
        });

        if (existingRejectedSubmission) {
            // If a rejected submission exists, UPDATE it instead of creating a new one.
            existingRejectedSubmission.responses = processedResponses;
            existingRejectedSubmission.status = 'pending_review'; // Reset the status for re-review
            existingRejectedSubmission.reviewNotes = undefined; // Clear previous rejection notes
            existingRejectedSubmission.reviewedBy = undefined; // Clear previous reviewer
            
            await existingRejectedSubmission.save();
            return NextResponse.json({ message: 'Checklist re-submitted successfully' }, { status: 200 });

        } else {
            // If no rejected submission exists, create a brand new submission.
            const newSubmission = new SopSubmission({
                sop: sopId,
                responses: processedResponses,
                staff: session.user.id,
                tenantId,
                submissionDate: today,
                // The 'status' will default to 'pending_review' as per the schema
            });

            await newSubmission.save();
            return NextResponse.json({ message: 'Checklist submitted successfully' }, { status: 201 });
        }
        // --- END OF NEW WORKFLOW LOGIC ---

    } catch (error: any) {
        console.error("SOP Submission Error:", error);
        return NextResponse.json({ message: error.message || 'Server Error' }, { status: 500 });
    }
}