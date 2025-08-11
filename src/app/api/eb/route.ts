// /app/api/eb/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { v2 as cloudinary } from 'cloudinary';

import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import EBReading, { IHistoryEntry } from '@/models/ebReadings';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import Setting from '@/models/Setting';
import { getTenantIdOrBail } from '@/lib/tenant';

// --- CLOUDINARY CONFIGURATION ---
// This should already be in your project from the original code
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// --- MODIFIED UTILITY FUNCTION ---
// This function now accepts the tenantId to organize uploads
async function uploadImage(file: File, tenantId: string): Promise<string> {
  const fileBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(fileBuffer);
  return new Promise((resolve, reject) => {
    // Images will now be stored in a folder structure like: eb-readings/tenant_id_123/
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: `eb-readings/${tenantId}`, resource_type: 'auto' },
      (error, result) => {
        if (error) return reject(error);
        if (result) return resolve(result.secure_url);
        reject(new Error('Cloudinary upload failed.'));
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * GET /api/eb
 * Fetches recent EB readings for the current tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) return tenantId;

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    await connectToDatabase();
    const readings = await EBReading.find({ tenantId: tenantId }).sort({ date: -1 }).limit(30);
    return NextResponse.json({ success: true, readings });
  } catch (error) {
    console.error('Error fetching EB readings:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/eb
 * Creates a new reading for the current tenant.
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) return tenantId;

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.EB_UPLOAD)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const image = formData.get('image') as File;
    const dateString = formData.get('date') as string;

    if (!image || !dateString) {
      return NextResponse.json({ success: false, message: 'Image and date are required' }, { status: 400 });
    }

    // --- MODIFICATION: Pass the tenantId to the upload function ---
    const imageUrl = await uploadImage(image, tenantId);
    
    const recordDate = new Date(dateString);
    recordDate.setUTCHours(0, 0, 0, 0);

    await connectToDatabase();
    
    const costSetting = await Setting.findOne({ key: 'ebCostPerUnit', tenantId: tenantId });
    const costToStamp = costSetting ? costSetting.value : 8;

    const reading = await EBReading.findOneAndUpdate(
      { date: recordDate, tenantId: tenantId },
      {
        $set: { morningImageUrl: imageUrl, updatedBy: session.user.id },
        $setOnInsert: {
          date: recordDate,
          createdBy: session.user.id,
          costPerUnit: costToStamp,
          tenantId: tenantId,
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ success: true, reading }, { status: 201 });
  } catch (error) {
    console.error('Error processing EB reading upload:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/eb
 * Updates a reading for the current tenant.
 */
export async function PUT(request: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) return tenantId;

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { readingId, morningUnits } = await request.json();

    if (!readingId) {
      return NextResponse.json({ success: false, message: 'Reading ID is required' }, { status: 400 });
    }

    await connectToDatabase();

    const currentReading = await EBReading.findOne({ _id: readingId, tenantId: tenantId });
    if (!currentReading) {
      return NextResponse.json({ success: false, message: 'Reading not found' }, { status: 404 });
    }
    
    if (morningUnits !== undefined && currentReading.morningUnits !== morningUnits) {
        // --- FIX: Added tenantId to the history entry object ---
        const historyEntry: IHistoryEntry = {
          timestamp: new Date(),
          user: { id: session.user.id, name: session.user.name || 'Unknown' },
          changes: [{ field: 'Morning Units', oldValue: currentReading.morningUnits, newValue: morningUnits }],
          tenantId: tenantId, // This line was added
        };
        currentReading.history.push(historyEntry);
        currentReading.morningUnits = morningUnits;
        currentReading.updatedBy = session.user.id;
    }

    const previousDate = new Date(currentReading.date);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousReading = await EBReading.findOne({ date: previousDate, tenantId: tenantId });

    if (previousReading && typeof previousReading.morningUnits === 'number' && typeof currentReading.morningUnits === 'number') {
      if (currentReading.morningUnits >= previousReading.morningUnits) {
          previousReading.unitsConsumed = currentReading.morningUnits - previousReading.morningUnits;
          previousReading.totalCost = previousReading.unitsConsumed * (currentReading.costPerUnit || 8);
          previousReading.updatedBy = session.user.id;
          await previousReading.save();
      }
    }
    
    const nextDate = new Date(currentReading.date);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextReading = await EBReading.findOne({ date: nextDate, tenantId: tenantId });

    if (nextReading && typeof nextReading.morningUnits === 'number' && typeof currentReading.morningUnits === 'number') {
       if (nextReading.morningUnits >= currentReading.morningUnits) {
          currentReading.unitsConsumed = nextReading.morningUnits - currentReading.morningUnits;
          currentReading.totalCost = currentReading.unitsConsumed * (nextReading.costPerUnit || 8);
       } else {
          currentReading.unitsConsumed = undefined;
          currentReading.totalCost = undefined;
       }
    } else {
      currentReading.unitsConsumed = undefined;
      currentReading.totalCost = undefined;
    }

    await currentReading.save();
    
    return NextResponse.json({ success: true, message: 'Reading updated and recalculated successfully' });
  } catch (error) {
    console.error('Error updating EB reading:', error);
    return NextResponse.json({ success: false, message: 'Internal server error while updating' }, { status: 500 });
  }
}