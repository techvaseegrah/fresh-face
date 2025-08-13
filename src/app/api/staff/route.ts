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

/**
 * A specific, high-privilege permission for the permanent deletion of a staff member.
 * This should only be assigned to the most trusted administrative roles.
 */
const PERMISSION_STAFF_PERMANENT_DELETE = "staff:permanent-delete";

// =================================================================================
// HELPER FUNCTIONS
// =================================================================================

/**
 * Checks if a given string is a valid MongoDB ObjectId.
 * @param id The string to validate.
 * @returns True if the ID is valid, otherwise false.
 */
const isValidObjectId = (id: string): boolean => mongoose.Types.ObjectId.isValid(id);

/**
 * Defines a lean staff document type for optimized queries.
 */
type LeanStaffDocument = Omit<IStaff, keyof mongoose.Document<Types.ObjectId>> & { _id: Types.ObjectId };

/**
 * Uploads a base64 encoded image to Cloudinary.
 * @param imageData The base64 image data string.
 * @param folder The target folder in Cloudinary.
 * @returns The secure URL of the uploaded image or null.
 */
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

/**
 * Retrieves the next sequential staff ID number for a given tenant.
 * @param tenantId The ID of the tenant.
 * @returns The next staff ID as a string.
 */
async function getNextStaffId(tenantId: string): Promise<string> {
    await dbConnect();
    const settings = await ShopSetting.findOne({ key: 'defaultSettings', tenantId }).lean();
    const nextNumber = settings?.staffIdBaseNumber || 1;
    return nextNumber.toString();
}

/**
 * Checks if the current user session has the required permission.
 * @param permission The permission string to check for.
 * @returns Null if permission is granted, otherwise an error object.
 */
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

// =================================================================================
// API ROUTE HANDLERS
// =================================================================================

/**
 * Handles GET requests to fetch staff data.
 */
export async function GET(request: NextRequest) {
  // 1. Ensure Tenant ID is present
  const tenantIdOrResponse = getTenantIdOrBail(request);
  if (tenantIdOrResponse instanceof NextResponse) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;

  // 2. Check for read permissions
  const permissionCheck = await checkPermissions(PERMISSIONS.STAFF_LIST_READ);
  if (permissionCheck) {
    return NextResponse.json({ success: false, error: permissionCheck.error }, { status: permissionCheck.status });
  }

  // 3. Connect to DB and parse URL parameters
  await dbConnect();
  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action');
  const staffId = searchParams.get('id');

  try {
    // --- ACTION: Get the next available staff ID number ---
    if (action === 'getNextId') {
      const nextId = await getNextStaffId(tenantId);
      return NextResponse.json({ success: true, data: { nextId } });
    }
    
    // --- ACTION: Get a list of all active staff for the Billing Modal ---
    if (action === 'listForBilling') {
        const activeStaff = await Staff.find(
          {
            tenantId,       // Scope by tenant
            status: 'active', // Only get active staff
          },
          '_id name email' // Select only the fields needed by the modal
        )
        .sort({ name: 'asc' })
        .lean<{ _id: Types.ObjectId, name: string, email: string }[]>();

        return NextResponse.json({
            success: true,
            // The BillingModal expects the response key to be 'staff'
            staff: activeStaff.map(s => ({ 
                _id: s._id.toString(), 
                name: s.name,
                email: s.email 
            }))
        });
    }
    
    // --- ACTION: Get a filtered list of stylists for appointment assignment ---
    if (action === 'listForAssignment') {
        const assignableStaff = await Staff.find(
          {
            tenantId, // Scope by tenant
            status: 'active',
            // Filter by specific positions
            position: { $in: [/^stylist$/i, /^lead stylist$/i, /^manager$/i] }
          },
          '_id name'
        )
        .sort({ name: 'asc' })
        .lean<{ _id: Types.ObjectId, name: string }[]>();

        return NextResponse.json({
            success: true,
            stylists: assignableStaff.map(s => ({ _id: s._id.toString(), name: s.name }))
        });
    }

    // --- ACTION: Get a detailed list of all staff for the main management page ---
    if (action === 'list') {
      const staffList = await Staff.find({ tenantId }) // Scope by tenant
        .select('staffIdNumber name email phone aadharNumber position joinDate salary address image status aadharImage passbookImage agreementImage')
        .sort({ name: 'asc' })
        .lean<LeanStaffDocument[]>();
      return NextResponse.json({ success: true, data: staffList.map(s => ({...s, id: s._id.toString()})) });
    }

    // --- ACTION: Get a single staff member by their document ID ---
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

    // --- Fallback if no valid action or ID is provided ---
    return NextResponse.json({ success: false, error: 'Invalid action or missing ID for GET request' }, { status: 400 });
  
  } catch (error) {
    console.error('Error fetching staff:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, error: `Failed to fetch staff: ${message}` }, { status: 500 });
  }
}

/**
 * Handles POST requests to create a new staff member.
 */
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

/**
 * Handles PUT requests to update an existing staff member.
 */
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

/**
 * Handles DELETE requests to deactivate or permanently delete a staff member.
 */
export async function DELETE(request: NextRequest) {
  const tenantIdOrResponse = getTenantIdOrBail(request);
  if (tenantIdOrResponse instanceof NextResponse) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;

  await dbConnect();
  const { searchParams } = request.nextUrl;
  const staffId = searchParams.get('id');
  const isPermanentDelete = searchParams.get('permanent') === 'true';

  if (!staffId || !isValidObjectId(staffId)) {
    return NextResponse.json({ success: false, error: 'Valid Staff ID is required' }, { status: 400 });
  }

  try {
    if (isPermanentDelete) {
      const permissionCheck = await checkPermissions(PERMISSION_STAFF_PERMANENT_DELETE);
      if (permissionCheck) {
        return NextResponse.json({ success: false, error: permissionCheck.error }, { status: permissionCheck.status });
      }
      
      const deletedStaff = await Staff.findOneAndDelete({ _id: staffId, tenantId });
      
      if (!deletedStaff) {
        return NextResponse.json({ success: false, error: 'Staff member not found or already deleted' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'Staff member permanently deleted.' });

    } else {
      const permissionCheck = await checkPermissions(PERMISSIONS.STAFF_LIST_DELETE);
      if (permissionCheck) {
        return NextResponse.json({ success: false, error: permissionCheck.error }, { status: permissionCheck.status });
      }

      const deactivatedStaff = await Staff.findOneAndUpdate({ _id: staffId, tenantId }, { status: 'inactive' }, { new: true }).lean<LeanStaffDocument>();
      
      if (!deactivatedStaff) {
        return NextResponse.json({ success: false, error: 'Staff member not found' }, { status: 404 });
      }
      
      return NextResponse.json({ success: true, message: 'Staff member deactivated successfully', data: {...deactivatedStaff, id: deactivatedStaff._id.toString()} });
    }
  } catch (error: any) {
    console.error('Error during DELETE operation:', error);
    return NextResponse.json({ success: false, error: `Failed to process delete request: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
}