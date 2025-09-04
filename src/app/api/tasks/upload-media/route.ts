// src/app/api/tasks/upload-media/route.ts - FINAL ROBUST VERSION

import { NextRequest, NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';
import { getServerSession } from 'next-auth/next'; // ✅ IMPORT getServerSession
import { authOptions } from '@/lib/auth';     // ✅ IMPORT authOptions

// Increase the body size limit to allow larger file uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    // ✅ ROBUST METHOD: Get the session directly on the server.
    // This is the most reliable way to get user and tenant info.
    const session = await getServerSession(authOptions);

    // Security Check: Ensure the user is authenticated and has a tenantId
    if (!session?.user?.tenantId) {
      console.error("API SECURITY ERROR: Unauthenticated user or missing tenantId tried to upload.");
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    // --- Standard upload logic ---
    const { fileData } = await request.json();
    if (!fileData) {
      return NextResponse.json({ success: false, error: 'No file data received.' }, { status: 400 });
    }

    const result = await cloudinary.uploader.upload(fileData, {
      folder: `salon/${tenantId}/task_media`,
      resource_type: 'auto',
    });

    return NextResponse.json({ success: true, url: result.secure_url });

  } catch (error: any) {
    // This will now catch any error, including session issues or Cloudinary issues.
    console.error('CRITICAL API CRASH in /api/tasks/upload-media:', error);
    return NextResponse.json({ success: false, error: 'The upload process crashed on the server.' }, { status: 500 });
  }
}