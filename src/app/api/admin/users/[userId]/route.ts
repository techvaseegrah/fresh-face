// /app/api/admin/users/[userId]/route.ts - TENANT-AWARE VERSION

import { NextRequest, NextResponse } from 'next/server'; // <-- 1. Import NextRequest
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/user';
import Role from '@/models/role';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import bcrypt from 'bcryptjs';
import { getTenantId } from '@/lib/tenant'; // <-- 2. Import a tenant helper

export async function PATCH(
  req: NextRequest, // <-- 3. Change 'request' to 'req' and type to NextRequest
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.USERS_UPDATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = getTenantId(req); // <-- 4. Get the tenantId from the request
    if (!tenantId) {
        return NextResponse.json({ success: false, message: 'Tenant ID is missing.' }, { status: 400 });
    }

    const { userId } = params;
    const updateData = await req.json();

    await connectToDatabase();

    // <-- 5. Scope the 'find' operation by both userId and tenantId
    const user = await User.findOne({ _id: userId, tenantId: tenantId });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found in this salon' }, { status: 404 });
    }

    // Prepare update object
    const updates: any = {};
    if (updateData.name) updates.name = updateData.name;
    if (updateData.isActive !== undefined) updates.isActive = updateData.isActive;

    const newEmail = updateData.email ? updateData.email.toLowerCase() : undefined;
    // If email is changing, check if the new email is already taken within the tenant
    if (newEmail && newEmail !== user.email) {
        const existingUser = await User.findOne({ email: newEmail, tenantId: tenantId });
        if (existingUser) {
            return NextResponse.json({ success: false, message: `Email '${newEmail}' is already in use in this salon.` }, { status: 409 });
        }
        updates.email = newEmail;
    }

    // Handle role change, ensuring the new role also belongs to the tenant
    if (updateData.roleId && updateData.roleId !== user.roleId.toString()) {
      // <-- 5. Scope the 'role find' operation by roleId and tenantId
      const role = await Role.findOne({ _id: updateData.roleId, tenantId: tenantId });
      if (!role) {
        return NextResponse.json({ success: false, message: 'Invalid role for this salon' }, { status: 400 });
      }
      updates.roleId = updateData.roleId;
    }

    // Handle password change (this logic is fine)
    if (updateData.password) {
      // The pre-save hook in your User model should handle hashing.
      // If not, hashing it here is correct.
      updates.password = await bcrypt.hash(updateData.password, 10);
    }

    // <-- 6. Scope the 'update' operation by both userId and tenantId
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, tenantId: tenantId },
      { $set: { ...updates, updatedBy: session.user.id } },
      { new: true }
    )
    .populate({
      path: 'roleId',
      select: 'name displayName'
    })
    .select('-password');

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    // Add more specific error handling if possible, e.g., for duplicate key errors
    if ((error as any).code === 11000) {
        return NextResponse.json({ success: false, message: 'An email duplication error occurred.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}