// src/app/api/staff/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Staff, { IStaff } from '../../../models/staff';
import Stylist from '../../../models/Stylist';
import mongoose, { Types } from 'mongoose';

// Helper function to validate MongoDB ObjectId string
const isValidObjectId = (id: string): boolean => mongoose.Types.ObjectId.isValid(id);

// Define a more specific type for lean results that include _id
// This ensures that _id is properly typed when using .lean()
type LeanStaffDocument = Omit<IStaff, keyof mongoose.Document<Types.ObjectId>> & { _id: Types.ObjectId };


export async function GET(request: NextRequest) {
  await dbConnect();
  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action');
  const staffId = searchParams.get('id');
  const position = searchParams.get('position');

  try {
    if (action === 'list') {
      const filter: { status: 'active'; position?: string } = { status: 'active' };

      // If a position is provided in the URL, add it to the filter
      if (position) {
        filter.position = position;
      }

      const staffList = await Staff.find(filter)
        .sort({ name: 'asc' })
        .lean<LeanStaffDocument[]>();

      return NextResponse.json({ success: true, data: staffList.map(s => ({...s, id: s._id.toString()})) });
    }

    if (staffId) {
      if (!isValidObjectId(staffId)) {
        return NextResponse.json({ success: false, error: 'Invalid staff ID format' }, { status: 400 });
      }
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
  await dbConnect();
  try {
    const body = await request.json();
    // 1. Destructure aadharNumber from the request body
    const { name, email, position, phone, salary, address, image, aadharNumber } = body;

    if (!name || !email || !position) {
      return NextResponse.json({ success: false, error: 'Name, email, and position are required' }, { status: 400 });
    }

    // Check for existing staff by email
    const existingStaffByEmail = await Staff.findOne({ email }).lean();
    if (existingStaffByEmail) {
      return NextResponse.json({ success: false, error: 'Email already exists' }, { status: 400 });
    }
    
    // Optional: Check for existing staff by Aadhar number if provided
    if (aadharNumber) {
        const existingStaffByAadhar = await Staff.findOne({ aadharNumber }).lean();
        if (existingStaffByAadhar) {
            return NextResponse.json({ success: false, error: 'Aadhar number already exists' }, { status: 400 });
        }
    }

    // 2. Add aadharNumber when creating the new staff member
    const newStaffDoc = new Staff({
      name, email, position, phone, salary, address,
      aadharNumber,
      image: image || null,
      status: 'active',
    });
    const savedStaff = await newStaffDoc.save();

    // ======================================================================
    //  AUTOMATION LOGIC: Check position and create a linked stylist record
    // ======================================================================
    if (savedStaff.position.toLowerCase().trim() === 'stylist') {
      const existingStylist = await Stylist.findOne({ staffInfo: savedStaff._id });
      if (!existingStylist) {
        console.log(`Staff member ${savedStaff.name} is a stylist. Creating linked stylist record...`);
        const newStylist = new Stylist({
          staffInfo: savedStaff._id,
          availabilityStatus: 'Available',
        });
        await newStylist.save();
        console.log(`Stylist record created for ${savedStaff.name}.`);
      }
    }
    // ======================================================================

    const staffObject = savedStaff.toObject();
    return NextResponse.json({ success: true, data: {...staffObject, id: savedStaff._id.toString()} }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding staff:', error);
    if (error.name === 'ValidationError') {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
        return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }
    // Handle the unique constraint error from the database
    if (error.code === 11000) {
        return NextResponse.json({ success: false, error: 'A user with that email or Aadhar number already exists.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: `Failed to add staff member: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  await dbConnect();
  const { searchParams } = request.nextUrl;
  const staffId = searchParams.get('id');

  if (!staffId || !isValidObjectId(staffId)) {
    return NextResponse.json({ success: false, error: 'Valid Staff ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    // 1. Destructure aadharNumber from the request body
    const { name, email, position, phone, salary, address, image, status, aadharNumber } = body;
    const updateData: Partial<IStaff> = {};

    // 2. Add aadharNumber to the updateData object if it exists
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (position !== undefined) updateData.position = position;
    if (phone !== undefined) updateData.phone = phone;
    if (salary !== undefined) updateData.salary = salary;
    if (address !== undefined) updateData.address = address;
    if (image !== undefined) updateData.image = image;
    if (aadharNumber !== undefined) updateData.aadharNumber = aadharNumber;
    if (status !== undefined && ['active', 'inactive'].includes(status)) updateData.status = status as 'active' | 'inactive';

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No update data provided' }, { status: 400 });
    }
    
    // Check for uniqueness on email and aadhar number before updating
    if (updateData.email || updateData.aadharNumber) {
        const orConditions = [];
        if (updateData.email) orConditions.push({ email: updateData.email });
        if (updateData.aadharNumber) orConditions.push({ aadharNumber: updateData.aadharNumber });

        if (orConditions.length > 0) {
            const existingStaff = await Staff.findOne({
                _id: { $ne: staffId }, // Check for a document that is NOT the one we're updating
                $or: orConditions
            }).lean();

            if (existingStaff) {
                const errorMessage = existingStaff.email === updateData.email 
                    ? 'New email already in use by another staff member.'
                    : 'New Aadhar number already in use by another staff member.';
                return NextResponse.json({ success: false, error: errorMessage }, { status: 409 });
            }
        }
    }

    const updatedStaff = await Staff.findByIdAndUpdate(staffId, { $set: updateData }, { new: true, runValidators: true }).lean<LeanStaffDocument>();
    if (!updatedStaff) {
      return NextResponse.json({ success: false, error: 'Staff member not found' }, { status: 404 });
    }

    // Future Enhancement: If position changes from/to 'stylist', you could add/remove the Stylist record here.

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
  await dbConnect();
  const { searchParams } = request.nextUrl;
  const staffId = searchParams.get('id');

  if (!staffId || !isValidObjectId(staffId)) {
    return NextResponse.json({ success: false, error: 'Valid Staff ID is required' }, { status: 400 });
  }

  try {
    // This is a "soft delete" that just deactivates the staff member.
    // This is good practice because it preserves historical data.
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