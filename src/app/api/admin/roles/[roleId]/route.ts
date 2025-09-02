// /app/api/admin/roles/[roleId]/route.ts - FULLY CORRECTED

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Role from '@/models/role';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantId } from '@/lib/tenant';

// Your existing PATCH function (which is correct)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { roleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.ROLES_UPDATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = getTenantId(req);
    if (!tenantId) {
        return NextResponse.json({ success: false, message: 'Tenant ID is missing.' }, { status: 400 });
    }

    const { roleId } = params;
    const updateData = await req.json();

    await connectToDatabase();

    const role = await Role.findOne({ _id: roleId, tenantId: tenantId });
    if (!role) {
      return NextResponse.json({ success: false, message: 'Role not found in this salon' }, { status: 404 });
    }

    if (role.isSystemRole) {
      return NextResponse.json({ 
        success: false, 
        message: 'System roles cannot be modified' 
      }, { status: 403 });
    }

    const updates: any = {};
    if (updateData.displayName) updates.displayName = updateData.displayName;
    if (updateData.description !== undefined) updates.description = updateData.description;
    if (updateData.permissions) updates.permissions = updateData.permissions;
    if (updateData.isActive !== undefined) updates.isActive = updateData.isActive;

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


// --- NEWLY ADDED AND CORRECTED DELETE FUNCTION ---
export async function DELETE(
  req: NextRequest,
  { params }: { params: { roleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    // 1. Check for session and DELETE permission
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.ROLES_DELETE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get the tenantId from the request
    const tenantId = getTenantId(req);
    if (!tenantId) {
        return NextResponse.json({ success: false, message: 'Tenant ID is missing.' }, { status: 400 });
    }

    const { roleId } = params;

    await connectToDatabase();

    // 3. CRITICAL: First, find the role to ensure it exists in the tenant AND to check if it's a system role
    const roleToDelete = await Role.findOne({ _id: roleId, tenantId: tenantId });

    if (!roleToDelete) {
      return NextResponse.json({ success: false, message: 'Role not found in this salon' }, { status: 404 });
    }

    // 4. PREVENT DELETION: Add the same protection for system roles
    if (roleToDelete.isSystemRole) {
      return NextResponse.json({
        success: false,
        message: 'System roles cannot be deleted. You can only make them inactive.'
      }, { status: 403 }); // 403 Forbidden is a more appropriate status code here
    }

    // 5. SECURE DELETION: Delete the role only if the ID and tenantId match
    await Role.findOneAndDelete({ _id: roleId, tenantId: tenantId });

    return NextResponse.json({ success: true, message: 'Role deleted successfully.' });

  } catch (error) {
    console.error('Error deleting role:', error);
    // This is likely the response your UI is currently receiving, causing the "unexpected error" message
    return NextResponse.json({ success: false, message: 'An unexpected error occurred while deleting the role.' }, { status: 500 });
  }
}