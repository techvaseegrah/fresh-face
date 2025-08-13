// app/api/staff/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Staff, { IStaff } from '../../../models/staff';
import ShopSetting from '../../../models/ShopSetting';
import mongoose, { Types } from 'mongoose';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import cloudinary from '../../../lib/cloudinary';
import { getTenantIdOrBail } from '@/lib/tenant';

// Helper functions (no changes needed here)
const isValidObjectId = (id: string): boolean => mongoose.Types.ObjectId.isValid(id);
type LeanStaffDocument = Omit<IStaff, keyof mongoose.Document<Types.ObjectId>> & { _id: Types.ObjectId };
async function uploadImageToCloudinary(imageData: string | undefined | null, folder: string): Promise<string | null> {
    if (imageData && imageData.startsWith('data:image')) {
        try {
            const result = await cloudinary.uploader.upload(imageData, { folder, resource_type: 'image' });
            return result.secure_url;
        } catch (error) {
            console.error('Cloudinary upload failed:', error);
            throw new Error('Failed to upload image to Cloudinary.');
        }
    }
    return imageData || null;
}
async function getNextStaffId(tenantId: string): Promise<string> {
    await dbConnect();
    const settings = await ShopSetting.findOne({ key: 'defaultSettings', tenantId }).lean();
    const nextNumber = settings?.staffIdBaseNumber || 1;
    return nextNumber.toString();
}
async function checkPermissions(permission: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role?.permissions) {
    return { error: 'Authentication required.', status: 401 };
  }
  if (!hasPermission(session.user.role.permissions, permission)) {
    return { error: 'You do not have permission to perform this action.', status: 403 };
  }
  return null;
}

export async function GET(request: NextRequest) {
  const tenantIdOrResponse = getTenantIdOrBail(request);
  if (tenantIdOrResponse instanceof NextResponse) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;

  const permissionCheck = await checkPermissions(PERMISSIONS.STAFF_LIST_READ);
  if (permissionCheck) {
    return NextResponse.json({ success: false, error: permissionCheck.error }, { status: permissionCheck.status });
  }
  await dbConnect();
  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action');
  const staffId = searchParams.get('id');

  try {
    if (action === 'getNextId') {
      const nextId = await getNextStaffId(tenantId);
      return NextResponse.json({ success: true, data: { nextId } });
    }

    if (action === 'listForAssignment') {
        const assignableStaff = await Staff.find({ tenantId, status: 'active', position: { $in: [/^stylist$/i, /^lead stylist$/i, /^manager$/i] } }, '_id name')
        .sort({ name: 'asc' })
        .lean<{ _id: Types.ObjectId, name: string }[]>();
        return NextResponse.json({ success: true, stylists: assignableStaff.map(s => ({ _id: s._id.toString(), name: s.name })) });
    }

    // ✅ THE FIX IS HERE. This block serves BOTH the Staff List and Incentives pages.
    if (action === 'list') {
      // 1. Select ALL fields needed by both pages: name, salary, status, position, etc.
      const staffList = await Staff.find({ tenantId })
        .select('_id name salary status position phone image')
        .sort({ name: 'asc' })
        .lean<LeanStaffDocument[]>();
      
      // 2. Map the data to a new format that includes everything needed.
      const formattedData = staffList.map(staff => ({
        // 3. Spread all the fetched properties (name, status, position, etc.)
        ...staff,
        // 4. Convert _id to a string 'id' for the frontend.
        id: staff._id.toString(),
        // 5. Explicitly create the `hasSalary` boolean for the Incentives page.
        hasSalary: typeof staff.salary === 'number' && staff.salary > 0,
      }));

      return NextResponse.json({ success: true, data: formattedData });
    }

    if (staffId) {
      if (!isValidObjectId(staffId)) {
        return NextResponse.json({ success: false, error: 'Invalid staff ID format' }, { status: 400 });
      }
      const staffMember = await Staff.findOne({ _id: staffId, tenantId }).lean<LeanStaffDocument>();
      if (!staffMember) {
        return NextResponse.json({ success: false, error: 'Staff member not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: {...staffMember, id: staffMember._id.toString()} });
    }
    
    const allStaff = await Staff.find({ tenantId }).lean<LeanStaffDocument[]>();
    const formattedAllStaff = allStaff.map(staff => ({ ...staff, id: staff._id.toString() }));
    return NextResponse.json({ success: true, data: formattedAllStaff });

  } catch (error) {
    console.error('Error fetching staff:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, error: `Failed to fetch staff: ${message}` }, { status: 500 });
  }
}

// ======================================================================================
// Your POST, PUT, and DELETE functions are correct and do not need to be changed.
// ======================================================================================

export async function POST(request: NextRequest) {
  const tenantIdOrResponse = getTenantIdOrBail(request);
  if (tenantIdOrResponse instanceof NextResponse) { return tenantIdOrResponse; }
  const tenantId = tenantIdOrResponse;
  const permissionCheck = await checkPermissions(PERMISSIONS.STAFF_LIST_CREATE);
  if (permissionCheck) { return NextResponse.json({ success: false, error: permissionCheck.error }, { status: permissionCheck.status }); }
  await dbConnect();
  try {
    const body = await request.json();
    const [uploadedImageUrl, uploadedAadharUrl, uploadedPassbookUrl, uploadedAgreementUrl] = await Promise.all([
        uploadImageToCloudinary(body.image, 'salon/staff_photos'),
        uploadImageToCloudinary(body.aadharImage, 'salon/staff_documents'),
        uploadImageToCloudinary(body.passbookImage, 'salon/staff_documents'),
        uploadImageToCloudinary(body.agreementImage, 'salon/staff_documents'),
    ]);
    const { staffIdNumber, name, email, position, phone, salary, address, aadharNumber, joinDate } = body;
    if (!staffIdNumber || !name || !phone || !position || !aadharNumber) {
      return NextResponse.json({ success: false, error: 'Staff ID, Name, phone, position, and Aadhar Number are required' }, { status: 400 });
    }
    const existingStaff = await Staff.findOne({ tenantId, $or: [{ staffIdNumber }, ...(email ? [{ email }] : []), ...(aadharNumber ? [{ aadharNumber }] : [])] }).lean();
    if (existingStaff) {
        let errorMessage = 'A user with this data already exists.';
        if (existingStaff.staffIdNumber === staffIdNumber) errorMessage = `Staff ID ${staffIdNumber} already exists. Please try again.`;
        else if (email && existingStaff.email === email) errorMessage = 'Email already exists.';
        else if (aadharNumber && existingStaff.aadharNumber === aadharNumber) errorMessage = 'Aadhar number already exists.';
        return NextResponse.json({ success: false, error: errorMessage }, { status: 409 });
    }
    const newStaffDoc = new Staff({ tenantId, staffIdNumber, name, email: email || null, position, phone, salary, address, aadharNumber, joinDate, image: uploadedImageUrl, aadharImage: uploadedAadharUrl, passbookImage: uploadedPassbookUrl, agreementImage: uploadedAgreementUrl, status: 'active' });
    const savedStaff = await newStaffDoc.save();
    await ShopSetting.updateOne({ key: 'defaultSettings', tenantId }, { $inc: { staffIdBaseNumber: 1 } }, { upsert: true });
    const staffObject = savedStaff.toObject();
    return NextResponse.json({ success: true, data: {...staffObject, id: savedStaff._id.toString()} }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding staff:', error);
    if (error.name === 'ValidationError') return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    return NextResponse.json({ success: false, error: `Failed to add staff member: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const tenantIdOrResponse = getTenantIdOrBail(request);
  if (tenantIdOrResponse instanceof NextResponse) { return tenantIdOrResponse; }
  const tenantId = tenantIdOrResponse;
  const permissionCheck = await checkPermissions(PERMISSIONS.STAFF_LIST_UPDATE);
  if (permissionCheck) { return NextResponse.json({ success: false, error: permissionCheck.error }, { status: permissionCheck.status }); }
  await dbConnect();
  const { searchParams } = request.nextUrl;
  const staffId = searchParams.get('id');
  if (!staffId || !isValidObjectId(staffId)) {
    return NextResponse.json({ success: false, error: 'Valid Staff ID is required' }, { status: 400 });
  }
  try {
    const updateData = await request.json();
    if (Object.keys(updateData).length === 0) { return NextResponse.json({ success: false, error: 'No update data provided' }, { status: 400 }); }
    const [uploadedImageUrl, uploadedAadharUrl, uploadedPassbookUrl, uploadedAgreementUrl] = await Promise.all([
        uploadImageToCloudinary(updateData.image, 'salon/staff_photos'),
        uploadImageToCloudinary(updateData.aadharImage, 'salon/staff_documents'),
        uploadImageToCloudinary(updateData.passbookImage, 'salon/staff_documents'),
        uploadImageToCloudinary(updateData.agreementImage, 'salon/staff_documents'),
    ]);
    updateData.image = uploadedImageUrl; updateData.aadharImage = uploadedAadharUrl; updateData.passbookImage = uploadedPassbookUrl; updateData.agreementImage = uploadedAgreementUrl;
    const orConditions: any[] = [];
    if (updateData.staffIdNumber) orConditions.push({ staffIdNumber: updateData.staffIdNumber });
    if (updateData.email) orConditions.push({ email: updateData.email });
    if (updateData.aadharNumber) orConditions.push({ aadharNumber: updateData.aadharNumber });
    if (orConditions.length > 0) {
        const existingStaff = await Staff.findOne({ _id: { $ne: staffId }, tenantId, $or: orConditions }).lean();
        if (existingStaff) {
            let errorMessage = 'Data is already in use by another staff member.';
            if (updateData.staffIdNumber && existingStaff.staffIdNumber === updateData.staffIdNumber) errorMessage = 'This Staff ID is already in use.';
            else if (updateData.email && existingStaff.email === updateData.email) errorMessage = 'This Email is already in use.';
            else if (updateData.aadharNumber && existingStaff.aadharNumber === updateData.aadharNumber) errorMessage = 'This Aadhar number is already in use.';
            return NextResponse.json({ success: false, error: errorMessage }, { status: 409 });
        }
    }
    const updatedStaff = await Staff.findOneAndUpdate({ _id: staffId, tenantId }, { $set: updateData }, { new: true, runValidators: true }).lean<LeanStaffDocument>();
    if (!updatedStaff) { return NextResponse.json({ success: false, error: 'Staff member not found' }, { status: 404 }); }
    return NextResponse.json({ success: true, data: {...updatedStaff, id: updatedStaff._id.toString()} });
  } catch (error: any) {
    console.error('Error updating staff:', error);
    if (error.name === 'ValidationError') return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    if (error.code === 11000) return NextResponse.json({ success: false, error: 'A user with that email or Aadhar number already exists.' }, { status: 409 });
    return NextResponse.json({ success: false, error: `Failed to update staff member: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const tenantIdOrResponse = getTenantIdOrBail(request);
  if (tenantIdOrResponse instanceof NextResponse) { return tenantIdOrResponse; }
  const tenantId = tenantIdOrResponse;
  const permissionCheck = await checkPermissions(PERMISSIONS.STAFF_LIST_DELETE);
  if (permissionCheck) { return NextResponse.json({ success: false, error: permissionCheck.error }, { status: permissionCheck.status }); }
  await dbConnect();
  const { searchParams } = request.nextUrl;
  const staffId = searchParams.get('id');
  if (!staffId || !isValidObjectId(staffId)) {
    return NextResponse.json({ success: false, error: 'Valid Staff ID is required' }, { status: 400 });
  }
  try {
    const deactivatedStaff = await Staff.findOneAndUpdate({ _id: staffId, tenantId }, { status: 'inactive' }, { new: true }).lean<LeanStaffDocument>();
    if (!deactivatedStaff) { return NextResponse.json({ success: false, error: 'Staff member not found' }, { status: 404 }); }
    return NextResponse.json({ success: true, message: 'Staff member deactivated successfully', data: {...deactivatedStaff, id: deactivatedStaff._id.toString()} });
  } catch (error: any) {
    console.error('Error deactivating staff:', error);
    return NextResponse.json({ success: false, error: `Failed to deactivate staff: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
}