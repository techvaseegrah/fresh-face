// /app/api/admin/users/route.ts - TENANT-AWARE VERSION

import { NextRequest, NextResponse } from 'next/server'; // <-- 1. Import NextRequest
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/user';
import Role from '@/models/role';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantId } from '@/lib/tenant'; // <-- 2. Import a tenant helper

// GET all users for the current tenant
export async function GET(req: NextRequest) { // <-- 3. Add 'req'
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.USERS_READ)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = getTenantId(req); // <-- 4. Get the tenantId
    if (!tenantId) {
        return NextResponse.json({ success: false, message: 'Tenant ID is missing.' }, { status: 400 });
    }

    await connectToDatabase();
    
    // <-- 5. Scope the find query by tenantId
    const users = await User.find({ tenantId: tenantId })
      .populate({
        path: 'roleId',
        select: 'name displayName'
      })
      .select('-password')
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE a user within the current tenant
export async function DELETE(req: NextRequest) { // <-- 3. Change 'Request' to 'NextRequest'
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.USERS_DELETE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = getTenantId(req); // <-- 4. Get the tenantId
     if (!tenantId) {
        return NextResponse.json({ success: false, message: 'Tenant ID is missing.' }, { status: 400 });
    }

    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
    }

    await connectToDatabase();
    
    // <-- 5. Scope the delete query by tenantId and userId
    const result = await User.deleteOne({ _id: userId, tenantId: tenantId });
    
    // Check if a document was actually deleted
    if (result.deletedCount === 0) {
        return NextResponse.json({ success: false, message: 'User not found in this salon' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

// POST (create) a new user for the current tenant
export async function POST(req: NextRequest) { // <-- 3. Change 'Request' to 'NextRequest'
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.USERS_CREATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = getTenantId(req); // <-- 4. Get the tenantId
     if (!tenantId) {
        return NextResponse.json({ success: false, message: 'Tenant ID is missing.' }, { status: 400 });
    }

    await connectToDatabase();
    
    const { name, email, password, roleId } = await req.json();

    if (!name || !email || !password || !roleId) {
      return NextResponse.json({ success: false, message: 'All fields are required' }, { status: 400 });
    }
    
    const lowerCaseEmail = email.toLowerCase();

    // <-- 5. Scope the "check if user exists" query by tenantId
    const existingUser = await User.findOne({ email: lowerCaseEmail, tenantId: tenantId });
    if (existingUser) {
      return NextResponse.json({ success: false, message: `User with email '${email}' already exists in this salon` }, { status: 409 });
    }

    // <-- 5. Verify the role exists AND belongs to the current tenant
    const role = await Role.findOne({ _id: roleId, tenantId: tenantId });
    if (!role) {
      return NextResponse.json({ success: false, message: 'Invalid role for this salon' }, { status: 400 });
    }

    // <-- 6. Add tenantId to the new user being created
    const user = await User.create({
      tenantId: tenantId,
      name,
      email: lowerCaseEmail,
      password, // Remember to hash this in the model pre-save hook!
      roleId,
      createdBy: session.user.id
    });

    // The findById is implicitly secure because we just created the user
    const userWithRole = await User.findById(user._id)
      .populate({
        path: 'roleId',
        select: 'name displayName'
      })
      .select('-password');

    return NextResponse.json({ success: true, user: userWithRole }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}