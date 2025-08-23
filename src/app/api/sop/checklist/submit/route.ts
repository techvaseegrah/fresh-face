import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { v2 as cloudinary } from 'cloudinary';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import SopSubmission from '@/models/SopSubmission';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { startOfDay } from 'date-fns';

// Configure Cloudinary (ensure these variables are in your .env.local)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- CHANGED ---: Renamed function to be more generic
// Helper function to upload a media buffer to Cloudinary in a structured folder
async function uploadMedia(buffer: Buffer, tenantId: string, staffId: string, date: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { 
        // --- CRITICAL CHANGE ---: Tell Cloudinary this is a video file
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

        // --- CRITICAL CHANGE ---: Add server-side file size validation
        const MAX_FILE_SIZE_MB = 10;
        const maxFileSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;

        for (const file of files) {
            if (file.size > maxFileSizeBytes) {
                return NextResponse.json(
                    { message: `File "${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit.` },
                    { status: 400 } // Use 400 for a bad request from the client
                );
            }
        }
        // --- END OF VALIDATION ---

        const responses = JSON.parse(responsesJson);
        
        await dbConnect();
        
        const processedResponses = await Promise.all(
            responses.map(async (response: any, index: number) => {
                const file = files[index];
                if (file) {
                    const buffer = Buffer.from(await file.arrayBuffer());
                    const dateString = new Date().toISOString().split('T')[0];
                    // --- CHANGED ---: Use the new function name and a more generic variable name
                    const mediaUrl = await uploadMedia(buffer, tenantId.toString(), session.user.id, dateString);
                    return { ...response, imageUrl: mediaUrl }; // Still use imageUrl to match the DB schema
                }
                return response;
            })
        );
        
        const today = startOfDay(new Date());

        const newSubmission = new SopSubmission({
            sop: sopId,
            responses: processedResponses,
            staff: session.user.id,
            tenantId,
            submissionDate: today,
        });

        await newSubmission.save();
        return NextResponse.json({ message: 'Checklist submitted successfully' }, { status: 201 });
    } catch (error) {
        console.error("SOP Submission Error:", error);
        // Provide a more specific error message if possible
        if (error instanceof Error && 'message' in error) {
             return NextResponse.json({ message: error.message || 'Server Error' }, { status: 500 });
        }
        return NextResponse.json({ message: 'An unknown server error occurred' }, { status: 500 });
    }
}