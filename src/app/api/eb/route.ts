// PASTE THIS FULL CORRECTED CODE INTO: src/app/api/eb/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { v2 as cloudinary } from 'cloudinary';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import EBReading from '@/models/ebReadings'; // Make sure your model is named ebReadings
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import Setting from '@/models/Setting';
import { getTenantIdOrBail } from '@/lib/tenant';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

async function uploadImage(file: File, tenantId: string): Promise<string> {
    const fileBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(fileBuffer);
    return new Promise((resolve, reject) => {
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

// This single POST function now handles both CREATE and UPDATE (UPSERT)
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
        const meterIdentifier = formData.get('meterIdentifier') as string;

        if (!image || !dateString || !meterIdentifier) {
            return NextResponse.json({ success: false, message: 'Image, date, and meter are required.' }, { status: 400 });
        }

        // Upload the new image first
        const imageUrl = await uploadImage(image, tenantId);
        
        // Normalize the date to avoid timezone issues
        const recordDate = new Date(dateString);
        recordDate.setUTCHours(0, 0, 0, 0);

        await connectToDatabase();
        
        // Find the cost setting to apply on creation
        const costSetting = await Setting.findOne({ key: 'ebCostPerUnit', tenantId: tenantId });
        const costToStamp = costSetting ? costSetting.value : 8; // Default value if not set

        // This is the query to find the document
        const query = { 
            date: recordDate, 
            tenantId: tenantId, 
            meterIdentifier: meterIdentifier 
        };
        
        // This is the data for the document
        const updatePayload = {
            $set: { // Fields to update every time
                morningImageUrl: imageUrl, 
                updatedBy: session.user.id 
            },
            $setOnInsert: { // Fields to set only when creating a new document
                date: recordDate,
                meterIdentifier: meterIdentifier,
                tenantId: tenantId,
                createdBy: session.user.id,
                costPerUnit: costToStamp,
            }
        };

        // The powerful upsert command
        const reading = await EBReading.findOneAndUpdate(
            query,
            updatePayload,
            { 
                upsert: true, // This is the key: create if it doesn't exist
                new: true, // Return the new/updated document
                setDefaultsOnInsert: true 
            }
        );

        if (!reading) {
             throw new Error("Failed to create or update the reading.");
        }

        // Use 200 for update, 201 for create could be implemented if needed, but 200 is fine for both.
        return NextResponse.json({ success: true, reading: reading }, { status: 200 });

    } catch (error: any) {
        console.error('Error processing EB reading upload:', error);
        return NextResponse.json({ success: false, message: 'Internal server error during upload.' }, { status: 500 });
    }
}


// Your other functions (GET, PUT for updating units, etc.) can remain below
export async function GET(request: NextRequest) {
    // ... no changes needed for your GET code ...
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

export async function PUT(request: NextRequest) {
    // ... no changes needed for your PUT code that updates units ...
    // This is for updating the *number* of units, not the image.
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
            const historyEntry = {
                timestamp: new Date(),
                user: { id: session.user.id, name: session.user.name || 'Unknown' },
                changes: [{ field: 'Morning Units', oldValue: currentReading.morningUnits, newValue: morningUnits }],
                tenantId: tenantId,
            };
            currentReading.history.push(historyEntry as any); // Using any to bypass strict type for simplicity here
            currentReading.morningUnits = morningUnits;
            currentReading.updatedBy = session.user.id;
        }

        // --- Recalculation logic remains the same ---
        const previousDate = new Date(currentReading.date);
        previousDate.setDate(previousDate.getDate() - 1);
        const previousReading = await EBReading.findOne({ date: previousDate, tenantId: tenantId, meterIdentifier: currentReading.meterIdentifier });

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
        const nextReading = await EBReading.findOne({ date: nextDate, tenantId: tenantId, meterIdentifier: currentReading.meterIdentifier });

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