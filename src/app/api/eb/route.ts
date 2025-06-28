import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { v2 as cloudinary } from 'cloudinary';

import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import EBReading from '@/models/ebReadings'; // Using your model name and path
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// --- CLOUDINARY CONFIGURATION ---
// Configures the Cloudinary SDK using environment variables for security.
// This should be done once at the top level of the module.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});


// --- HELPER FUNCTION ---
/**
 * Uploads a file buffer to Cloudinary.
 * @param file The file object to upload.
 * @returns A promise that resolves to the secure URL of the uploaded image.
 */
async function uploadImage(file: File): Promise<string> {
  // Convert the file to a buffer that can be streamed.
  const fileBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(fileBuffer);

  // Use a promise to handle the asynchronous upload stream.
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'eb-readings', // Organizes uploads into a specific folder in Cloudinary
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary Upload Error:', error);
          return reject(error);
        }
        if (result) {
          resolve(result.secure_url);
        } else {
          reject(new Error('Cloudinary upload failed without an error message.'));
        }
      }
    );
    // Write the buffer to the upload stream to start the upload.
    uploadStream.end(buffer);
  });
}


// --- API HANDLERS ---

/**
 * GET /api/eb
 * Fetches recent EB readings (limited to 30) for the main view.
 * Requires EB_VIEW_CALCULATE permission.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const readings = await EBReading.find({})
      .sort({ date: -1 }) // Newest first
      .limit(30);       // Limit to recent readings

    return NextResponse.json({ success: true, readings });
  } catch (error) {
    console.error('Error fetching EB readings:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/eb
 * Handles the upload of morning or evening meter reading images.
 * Requires EB_UPLOAD permission.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.EB_UPLOAD)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const type = formData.get('type') as 'morning' | 'evening';
    const image = formData.get('image') as File;
    const dateString = formData.get('date') as string;

    if (!type || !image || !dateString) {
      return NextResponse.json({ success: false, message: 'Type, image, and date are required' }, { status: 400 });
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ success: false, message: 'Invalid date format' }, { status: 400 });
    }

    await connectToDatabase();
    
    // Define the start and end of the specified day for an accurate query.
    const startOfDay = new Date(new Date(date).setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date(date).setHours(23, 59, 59, 999));

    let reading = await EBReading.findOne({ date: { $gte: startOfDay, $lte: endOfDay } });

    // --- Logic for creating or updating a reading ---
    if (!reading) { // No reading exists for this day yet
      if (type === 'morning') {
        const imageUrl = await uploadImage(image); // Upload image BEFORE creating DB record
        reading = await EBReading.create({
          date: startOfDay,
          startImageUrl: imageUrl,
          createdBy: session.user.id
        });
        return NextResponse.json({ success: true, reading }, { status: 201 }); // 201 Created
      } else {
        return NextResponse.json({ success: false, message: 'Morning reading must be uploaded first for a new day' }, { status: 400 });
      }
    } else { // A reading for this day already exists
      if (type === 'evening') {
        if (reading.endImageUrl) {
          return NextResponse.json({ success: false, message: 'Evening reading already exists for this day' }, { status: 400 });
        }
        const imageUrl = await uploadImage(image); // Upload image BEFORE updating DB record
        reading.endImageUrl = imageUrl;
        reading.updatedBy = session.user.id;
        reading.updatedAt = new Date();
        await reading.save();
      } else { // type === 'morning'
        return NextResponse.json({ success: false, message: 'Morning reading already exists for this day' }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, reading }, { status: 200 }); // 200 OK
  } catch (error) {
    console.error('Error processing EB reading upload:', error);
    // A more advanced pattern could delete the uploaded image from Cloudinary if the DB save fails.
    return NextResponse.json({ success: false, message: 'Internal server error during upload process' }, { status: 500 });
  }
}

/**
 * PUT /api/eb
 * Updates a reading with calculated units and costs.
 * Requires EB_VIEW_CALCULATE permission.
 */
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { readingId, startUnits, endUnits, costPerUnit } = await request.json();

    if (!readingId || startUnits === undefined || endUnits === undefined || costPerUnit === undefined) {
      return NextResponse.json({ success: false, message: 'Reading ID, units, and cost are all required' }, { status: 400 });
    }

    const unitsConsumed = endUnits - startUnits;
    if (unitsConsumed < 0) {
      return NextResponse.json({ success: false, message: 'End units must be greater than or equal to start units' }, { status: 400 });
    }

    await connectToDatabase();

    const reading = await EBReading.findById(readingId);
    if (!reading) {
      return NextResponse.json({ success: false, message: 'Reading not found' }, { status: 404 });
    }

    // Update fields
    reading.startUnits = startUnits;
    reading.endUnits = endUnits;
    reading.unitsConsumed = unitsConsumed;
    reading.costPerUnit = costPerUnit;
    reading.totalCost = unitsConsumed * costPerUnit;
    reading.updatedBy = session.user.id;
    reading.updatedAt = new Date();

    await reading.save();

    return NextResponse.json({ success: true, reading });
  } catch (error) {
    console.error('Error updating EB reading:', error);
    return NextResponse.json({ success: false, message: 'Internal server error while updating' }, { status: 500 });
  }
}