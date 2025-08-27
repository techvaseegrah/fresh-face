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

// Helper function to upload media. We need to detect if it's an image or video.
async function uploadMedia(buffer: Buffer, fileType: string, tenantId: string, staffId: string, date: string): Promise<string> {
  // --- UPDATED ---: Dynamically set resource_type based on the file's MIME type
  const resource_type = fileType.startsWith('video/') ? 'video' : 'image';

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { 
        resource_type, 
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
        // The 'items' field now contains all the answer data as a JSON string
        const itemsJson = formData.get('items') as string;
        // The 'files' are now sent with a key that includes their original index
        // e.g., 'files[0]', 'files[2]'

        if (!sopId || !itemsJson) {
            return NextResponse.json({ message: 'Missing required data' }, { status: 400 });
        }
        
        // This is the array of answers from the form
        const items = JSON.parse(itemsJson);
        
        await dbConnect();

        const dateString = new Date().toISOString().split('T')[0];

        // --- MAJOR CHANGE: New logic to process detailed responses ---
        const processedResponses = await Promise.all(
            items.map(async (item: any, index: number) => {
                // The frontend will send files with a key like 'files[0]', 'files[1]' etc.
                const file = formData.get(`files[${index}]`) as File | null;
                
                let mediaUrl: string | undefined = undefined;

                if (file) {
                    // File size validation
                    const MAX_FILE_SIZE_MB = 10;
                    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                        throw new Error(`File "${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit.`);
                    }
                    
                    const buffer = Buffer.from(await file.arrayBuffer());
                    mediaUrl = await uploadMedia(buffer, file.type, tenantId.toString(), session.user.id, dateString);
                }

                // Construct the response object that matches the new DB schema
                return {
                    checklistItem: item.checklistItem,
                    answer: item.answer,
                    remarks: item.remarks,
                    mediaUrl: mediaUrl,
                };
            })
        );
        
        const today = startOfDay(new Date());

        // The logic for updating a rejected submission or creating a new one is still valid
        const existingRejectedSubmission = await SopSubmission.findOne({
            sop: sopId,
            staff: session.user.id,
            submissionDate: today,
            status: 'rejected',
        });

        if (existingRejectedSubmission) {
            existingRejectedSubmission.responses = processedResponses;
            existingRejectedSubmission.status = 'pending_review';
            existingRejectedSubmission.reviewNotes = undefined;
            existingRejectedSubmission.reviewedBy = undefined;
            
            await existingRejectedSubmission.save();
            return NextResponse.json({ message: 'Checklist re-submitted successfully' }, { status: 200 });

        } else {
            const newSubmission = new SopSubmission({
                sop: sopId,
                responses: processedResponses,
                staff: session.user.id,
                tenantId,
                submissionDate: today,
            });

            await newSubmission.save();
            return NextResponse.json({ message: 'Checklist submitted successfully' }, { status: 201 });
        }

    } catch (error: any) {
        console.error("SOP Submission Error:", error);
        return NextResponse.json({ message: error.message || 'Server Error' }, { status: 500 });
    }
}