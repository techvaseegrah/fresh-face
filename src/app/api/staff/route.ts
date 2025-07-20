// src/app/api/staff/route.ts
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Staff, { IStaff } from '../../../models/staff';
import Stylist from '../../../models/Stylist';
import ShopSetting from '../../../models/ShopSetting';
import mongoose, { Types } from 'mongoose';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

// Helper function to validate MongoDB ObjectId string
const isValidObjectId = (id: string): boolean => mongoose.Types.ObjectId.isValid(id);

// Define a more specific type for lean results that include _id
type LeanStaffDocument = Omit<IStaff, keyof mongoose.Document<Types.ObjectId>> & { _id: Types.ObjectId };

/**
 * Reads the current start number from the shop settings.
 * Used to pre-fill the Staff ID field on the ADD staff page.
 */
async function getNextStaffId(): Promise<string> {
    await dbConnect();
    const settings = await ShopSetting.findOne({ key: 'defaultSettings' }).lean();
    const startNumber = settings?.staffIdBaseNumber || 1;
    return startNumber.toString();
}


async function checkPermissions(permission: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role?.permissions) {
    return { error: 'Authentication required.', status: 401 };
  }
  const userPermissions = session.user.role.permissions;
  if (!hasPermission(userPermissions, permission)) {
    return { error: 'You do not have permission to perform this action.', status: 403 };
  }
  return null; 
}

export async function GET(request: NextRequest) {
    
  const permissionCheck = await checkPermissions(PERMISSIONS.STAFF_LIST_READ);
  if (permissionCheck) {
    return NextResponse.json({ success: false, error: permissionCheck.error }, { status: permissionCheck.status });
  }
  await dbConnect();
  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action');
  const staffId = searchParams.get('id');
  const position = searchParams.get('position');

  try {
    if (action === 'getNextId') {
      const nextId = await getNextStaffId();
      return NextResponse.json({ success: true, data: { nextId } });
    }

    if (action === 'list') {
      // Your original filter was { status: 'active' }. Based on your screenshot showing
      // all users, I've removed the filter to ensure all staff data is sent to the frontend.
      // The .lean() will fetch ALL fields from the schema, including the new image fields.
      const staffList = await Staff.find({}) // Removed filter to fetch all users
        .sort({ name: 'asc' })
        .lean<LeanStaffDocument[]>();
      return NextResponse.json({ success: true, data: staffList.map(s => ({...s, id: s._id.toString()})) });
    }

    if (staffId) {
      if (!isValidObjectId(staffId)) {
        return NextResponse.json({ success: false, error: 'Invalid staff ID format' }, { status: 400 });
      }
      // This part is correct and will fetch all fields for a single staff member.
      const staffMember = await Staff.findById(staffId).lean<LeanStaffDocument>();
      if (!staffMember) {
        return NextResponse.json({ success: false, error: 'Staff member not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: {...staffMember, id: staffMember._id.toString()} });
    }
    return NextResponse.json({ success: false, error: 'Invalid action or missing ID for GET request' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching staff:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, error: `Failed to fetch staff: ${message}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  
  const permissionCheck = await checkPermissions(PERMISSIONS.STAFF_LIST_CREATE);
  if (permissionCheck) {
    return NextResponse.json({ success: false, error: permissionCheck.error }, { status: permissionCheck.status });
  }

  await dbConnect();
  try {
    const body = await request.json();
    // --- CHANGE 1: Destructure the new document fields from the request body ---
    const { 
        name, email, position, phone, salary, address, image, aadharNumber, joinDate,
        aadharImage, passbookImage, agreementImage 
    } = body;

    if (!name || !email || !position) {
      return NextResponse.json({ success: false, error: 'Name, email, and position are required' }, { status: 400 });
    }

    const settings = await ShopSetting.findOneAndUpdate(
        { key: 'defaultSettings' },
        { $inc: { staffIdBaseNumber: 1 } },
        { new: false, upsert: true }
    );

    const newStaffIdNumber = (settings?.staffIdBaseNumber || 1).toString();

    const existingStaff = await Staff.findOne({
        $or: [
            { staffIdNumber: newStaffIdNumber },
            { email },
            ...(aadharNumber ? [{ aadharNumber }] : [])
        ]
    }).lean();

    if (existingStaff) {
        await ShopSetting.updateOne({ key: 'defaultSettings' }, { $inc: { staffIdBaseNumber: -1 } });
        
        let errorMessage = 'A user with this data already exists.';
        if (existingStaff.staffIdNumber === newStaffIdNumber) {
            errorMessage = `Staff ID ${newStaffIdNumber} already exists. Please check settings and try again.`;
        } else if (existingStaff.email === email) {
            errorMessage = 'Email already exists.';
        } else if (aadharNumber && existingStaff.aadharNumber === aadharNumber) {
            errorMessage = 'Aadhar number already exists.';
        }
        return NextResponse.json({ success: false, error: errorMessage }, { status: 409 });
    }

    // --- CHANGE 2: Add the new document fields when creating the Staff document ---
    const newStaffDoc = new Staff({
      staffIdNumber: newStaffIdNumber,
      name, email, position, phone, salary, address, aadharNumber, joinDate,
      image: image || null,
      aadharImage: aadharImage || null,
      passbookImage: passbookImage || null,
      agreementImage: agreementImage || null,
      status: 'active',
    });
    const savedStaff = await newStaffDoc.save();

    if (savedStaff.position.toLowerCase().trim() === 'stylist') {
      const existingStylist = await Stylist.findOne({ staffInfo: savedStaff._id });
      if (!existingStylist) {
        const newStylist = new Stylist({
          staffInfo: savedStaff._id,
          availabilityStatus: 'Available',
        });
        await newStylist.save();
      }
    }

    const staffObject = savedStaff.toObject();
    return NextResponse.json({ success: true, data: {...staffObject, id: savedStaff._id.toString()} }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding staff:', error);
    await ShopSetting.updateOne({ key: 'defaultSettings' }, { $inc: { staffIdBaseNumber: -1 } });
    if (error.name === 'ValidationError') {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: `Failed to add staff member: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
   
  const permissionCheck = await checkPermissions(PERMISSIONS.STAFF_LIST_UPDATE);
  if (permissionCheck) {
    return NextResponse.json({ success: false, error: permissionCheck.error }, { status: permissionCheck.status });
  }

  await dbConnect();
  const { searchParams } = request.nextUrl;
  const staffId = searchParams.get('id'); // This is the unique MongoDB _id

  if (!staffId || !isValidObjectId(staffId)) {
    return NextResponse.json({ success: false, error: 'Valid Staff ID is required' }, { status: 400 });
  }

  try {
    // This `updateData` will correctly contain any new document fields sent from the frontend.
    // No change is needed here.
    const updateData = await request.json(); 

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No update data provided' }, { status: 400 });
    }
    
    // This logic to check for duplicates is correct. No change needed.
    const orConditions: any[] = [];
    if (updateData.staffIdNumber) orConditions.push({ staffIdNumber: updateData.staffIdNumber });
    if (updateData.email) orConditions.push({ email: updateData.email });
    if (updateData.aadharNumber) orConditions.push({ aadharNumber: updateData.aadharNumber });

    if (orConditions.length > 0) {
        const existingStaff = await Staff.findOne({
            _id: { $ne: staffId }, // IMPORTANT: Exclude the current staff member from the check
            $or: orConditions
        }).lean();

        if (existingStaff) {
            let errorMessage = 'Data is already in use by another staff member.';
            if (updateData.staffIdNumber && existingStaff.staffIdNumber === updateData.staffIdNumber) errorMessage = 'This Staff ID is already in use by another staff member.';
            else if (updateData.email && existingStaff.email === updateData.email) errorMessage = 'This Email is already in use by another staff member.';
            else if (updateData.aadharNumber && existingStaff.aadharNumber === updateData.aadharNumber) errorMessage = 'This Aadhar number is already in use by another staff member.';
            return NextResponse.json({ success: false, error: errorMessage }, { status: 409 });
        }
    }

    // This `$set` operator is flexible and correctly updates any fields provided in `updateData`,
    // including the new document fields. No change is needed here.
    const updatedStaff = await Staff.findByIdAndUpdate(staffId, { $set: updateData }, { new: true, runValidators: true }).lean<LeanStaffDocument>();
    if (!updatedStaff) {
      return NextResponse.json({ success: false, error: 'Staff member not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: {...updatedStaff, id: updatedStaff._id.toString()} });
  } catch (error: any) {
    console.error('Error updating staff:', error);
     if (error.name === 'ValidationError') {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
        return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }
    if (error.code === 11000) {
        return NextResponse.json({ success: false, error: 'A user with that email or Aadhar number already exists.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: `Failed to update staff member: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {

    const permissionCheck = await checkPermissions(PERMISSIONS.STAFF_LIST_DELETE);
  if (permissionCheck) {
    return NextResponse.json({ success: false, error: permissionCheck.error }, { status: permissionCheck.status });
  }

  // No changes are needed in this function.
  await dbConnect();
  const { searchParams } = request.nextUrl;
  const staffId = searchParams.get('id');

  if (!staffId || !isValidObjectId(staffId)) {
    return NextResponse.json({ success: false, error: 'Valid Staff ID is required' }, { status: 400 });
  }

  try {
    const deactivatedStaff = await Staff.findByIdAndUpdate(
      staffId,
      { status: 'inactive' },
      { new: true }
    ).lean<LeanStaffDocument>();

    if (!deactivatedStaff) {
        return NextResponse.json({ success: false, error: 'Staff member not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Staff member deactivated successfully', data: {...deactivatedStaff, id: deactivatedStaff._id.toString()} });
  } catch (error: any) {
    console.error('Error deactivating staff:', error);
    return NextResponse.json({ success: false, error: `Failed to deactivate staff: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
}