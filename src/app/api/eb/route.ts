import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { v2 as cloudinary } from 'cloudinary';

import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import EBReading, { IHistoryEntry } from '@/models/ebReadings'; // Using your model
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// --- CLOUDINARY CONFIGURATION ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function uploadImage(file: File): Promise<string> {
  const fileBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(fileBuffer);
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'eb-readings', resource_type: 'auto' },
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
 * Fetches recent EB readings. This logic remains the same.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    await connectToDatabase();
    const readings = await EBReading.find({}).sort({ date: -1 }).limit(30);
    return NextResponse.json({ success: true, readings });
  } catch (error) {
    console.error('Error fetching EB readings:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/eb
 * Handles the upload of a MORNING meter reading image.
 * This is now simplified as there is no 'evening' type.
 */
export async function POST(request: Request) {
  try {
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

    const imageUrl = await uploadImage(image);
    
    // Normalize date to the start of the day in UTC to avoid timezone issues.
    const recordDate = new Date(dateString);
    recordDate.setUTCHours(0, 0, 0, 0);

    await connectToDatabase();

    // Find a record for the specific day and update it, or create a new one if it doesn't exist.
    const reading = await EBReading.findOneAndUpdate(
      { date: recordDate },
      {
        $set: {
          morningImageUrl: imageUrl,
          updatedBy: session.user.id,
        },
        $setOnInsert: { // These fields are only set when a new document is created
          date: recordDate,
          createdBy: session.user.id,
        }
      },
      {
        upsert: true, // Creates the document if it doesn't exist
        new: true,    // Returns the modified document
        setDefaultsOnInsert: true
      }
    );

    return NextResponse.json({ success: true, reading }, { status: 201 });
  } catch (error) {
    console.error('Error processing EB reading upload:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/eb
 * Updates a reading with a new morning unit value and triggers recalculations.
 * This is the core of the new logic.
 */
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { readingId, morningUnits, costPerUnit } = await request.json();

    if (!readingId) {
      return NextResponse.json({ success: false, message: 'Reading ID is required' }, { status: 400 });
    }

    await connectToDatabase();

    const currentReading = await EBReading.findById(readingId);
    if (!currentReading) {
      return NextResponse.json({ success: false, message: 'Reading not found' }, { status: 404 });
    }

    // --- 1. Update the record that was directly edited ---
    if (morningUnits !== undefined && currentReading.morningUnits !== morningUnits) {
        const historyEntry: IHistoryEntry = {
          timestamp: new Date(),
          user: { id: session.user.id, name: session.user.name || 'Unknown' },
          changes: [{ field: 'Morning Units', oldValue: currentReading.morningUnits, newValue: morningUnits }],
        };
        currentReading.history.push(historyEntry);
        currentReading.morningUnits = morningUnits;
        currentReading.updatedBy = session.user.id;
    }

    // --- 2. Recalculate consumption for the PREVIOUS day ---
    const previousDate = new Date(currentReading.date);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousReading = await EBReading.findOne({ date: previousDate });

    if (previousReading && typeof previousReading.morningUnits === 'number' && typeof currentReading.morningUnits === 'number') {
      if (currentReading.morningUnits >= previousReading.morningUnits) {
          previousReading.unitsConsumed = currentReading.morningUnits - previousReading.morningUnits;
          previousReading.totalCost = previousReading.unitsConsumed * (previousReading.costPerUnit || 8);
          previousReading.updatedBy = session.user.id;
          await previousReading.save();
      }
    }
    
    // --- 3. Recalculate consumption for the CURRENT day ---
    const nextDate = new Date(currentReading.date);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextReading = await EBReading.findOne({ date: nextDate });

    if (nextReading && typeof nextReading.morningUnits === 'number' && typeof currentReading.morningUnits === 'number') {
       if (nextReading.morningUnits >= currentReading.morningUnits) {
          currentReading.unitsConsumed = nextReading.morningUnits - currentReading.morningUnits;
          const currentCostPerUnit = costPerUnit !== undefined ? costPerUnit : currentReading.costPerUnit;
          currentReading.costPerUnit = currentCostPerUnit;
          currentReading.totalCost = currentReading.unitsConsumed * (currentCostPerUnit || 8);
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