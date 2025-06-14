// app/api/eb/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import EBReading from '@/models/ebReadings';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// Placeholder for image upload function (implement with your storage service)
async function uploadImage(file: File): Promise<string> {
  // Implement image upload to your storage service (e.g., AWS S3, Cloudinary)
  // Return the URL of the uploaded image
  return 'https://example.com/placeholder-image-url';
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const readings = await EBReading.find({})
      .sort({ date: -1 })
      .limit(30);

    return NextResponse.json({ success: true, readings });
  } catch (error) {
    console.error('Error fetching EB readings:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

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

    // Normalize date to start of day for query
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    // Check if a reading exists for the date
    let reading = await EBReading.findOne({ date: { $gte: startOfDay, $lte: endOfDay } });

    const imageUrl = await uploadImage(image);

    if (!reading) {
      // Create new reading for morning
      if (type === 'morning') {
        reading = await EBReading.create({
          date: startOfDay,
          startImageUrl: imageUrl,
          createdBy: session.user.id
        });
      } else {
        return NextResponse.json({ success: false, message: 'Morning reading must be uploaded first' }, { status: 400 });
      }
    } else {
      // Update existing reading for evening
      if (type === 'evening') {
        if (reading.endImageUrl) {
          return NextResponse.json({ success: false, message: 'Evening reading already exists' }, { status: 400 });
        }
        reading.endImageUrl = imageUrl;
        reading.updatedBy = session.user.id;
        reading.updatedAt = new Date();
        await reading.save();
      } else {
        return NextResponse.json({ success: false, message: 'Morning reading already exists' }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, reading }, { status: reading.startImageUrl && !reading.endImageUrl ? 201 : 200 });
  } catch (error) {
    console.error('Error processing EB reading:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { readingId, startUnits, endUnits, costPerUnit } = await request.json();




    if (!readingId || startUnits === undefined || endUnits === undefined || costPerUnit === undefined) {
      return NextResponse.json({ success: false, message: 'All fields are required' }, { status: 400 });
    }

    const unitsConsumed = endUnits - startUnits;
    if (unitsConsumed < 0) {
      return NextResponse.json({ success: false, message: 'End units must be greater than start units' }, { status: 400 });
    }

    await connectToDatabase();

    const reading = await EBReading.findById(readingId);
    if (!reading) {
      return NextResponse.json({ success: false, message: 'Reading not found' }, { status: 404 });
    }

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
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}