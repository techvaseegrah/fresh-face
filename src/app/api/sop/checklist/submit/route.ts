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

// Helper function to upload an image buffer to Cloudinary in a structured folder
async function uploadImage(buffer: Buffer, tenantId: string, staffId: string, date: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { 
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
        
        if (!sopId || !responsesJson) {
            return NextResponse.json({ message: 'Missing required data' }, { status: 400 });
        }
        
        // This is an array of objects like { text: '...', checked: true }
        const responses = JSON.parse(responsesJson); 
        // This is an array of the uploaded files
        const files = formData.getAll('files') as File[];
        
        await dbConnect();
        
        // Match files to their responses by index and upload them to Cloudinary
        const processedResponses = await Promise.all(
            responses.map(async (response: any, index: number) => {
                const file = files[index];
                if (file) {
                    const buffer = Buffer.from(await file.arrayBuffer());
                    const dateString = new Date().toISOString().split('T')[0];
                    const imageUrl = await uploadImage(buffer, tenantId.toString(), session.user.id, dateString);
                    // Return a new object with the imageUrl included
                    return { ...response, imageUrl };
                }
                // If somehow a response has no file, just return it as is
                return response;
            })
        );
        
        const today = startOfDay(new Date());

        const newSubmission = new SopSubmission({
            sop: sopId,
            responses: processedResponses, // Save the responses that now include the Cloudinary URLs
            staff: session.user.id,
            tenantId,
            submissionDate: today,
        });

        await newSubmission.save();
        return NextResponse.json({ message: 'Checklist submitted successfully' }, { status: 201 });
    } catch (error) {
        console.error("SOP Submission Error:", error);
        return NextResponse.json({ message: 'Server Error' }, { status: 500 });
    }
}