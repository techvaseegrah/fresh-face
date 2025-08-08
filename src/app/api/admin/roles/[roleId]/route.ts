// /app/api/admin/roles/[roleId]/route.ts - TENANT-AWARE VERSION

import { NextRequest, NextResponse } from 'next/server'; // <-- 1. Import NextRequest
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Role from '@/models/role';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantId } from '@/lib/tenant'; // <-- 2. Import a tenant helper

export async function PATCH(
  req: NextRequest, // <-- 3. Change 'request' to 'req' and type to NextRequest
  { params }: { params: { roleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.ROLES_UPDATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = getTenantId(req); // <-- 4. Get the tenantId from the request
    if (!tenantId) {
        return NextResponse.json({ success: false, message: 'Tenant ID is missing.' }, { status: 400 });
    }

    const { roleId } = params;
    const updateData = await req.json();

    await connectToDatabase();

    // <-- 5. Scope the 'find' operation by both roleId and tenantId
    // This is the key security step. It ensures we only find a role that
    // matches the ID AND belongs to the current user's salon.
    const role = await Role.findOne({ _id: roleId, tenantId: tenantId });
    if (!role) {
      return NextResponse.json({ success: false, message: 'Role not found in this salon' }, { status: 404 });
    }

    // Prevent editing system roles (this logic is correct and remains)
    if (role.isSystemRole) {
      return NextResponse.json({ 
        success: false, 
        message: 'System roles cannot be modified' 
      }, { status: 403 });
    }

    // Prepare update object (this logic is correct and remains)
    const updates: any = {};
    if (updateData.displayName) updates.displayName = updateData.displayName;
    if (updateData.description !== undefined) updates.description = updateData.description;
    if (updateData.permissions) updates.permissions = updateData.permissions;
    if (updateData.isActive !== undefined) updates.isActive = updateData.isActive;

    // <-- 6. Scope the 'update' operation by both roleId and tenantId
    // This is a "defense in depth" measure. Even if the code flow was compromised,
    // this query would still prevent updating a role outside the current tenant.
    const updatedRole = await Role.findOneAndUpdate(
      { _id: roleId, tenantId: tenantId },
      { $set: { ...updates, updatedBy: session.user.id } },
      { new: true }
    );

    return NextResponse.json({ success: true, role: updatedRole });
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}