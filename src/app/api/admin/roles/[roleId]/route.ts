// /app/api/admin/roles/[roleId]/route.ts - CORRECTED PATCH FUNCTION

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Role from '@/models/role';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantId } from '@/lib/tenant';

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

    // --- THIS BLOCK IS NOW CORRECT ---
    const updates: any = {};
    if (updateData.displayName) updates.displayName = updateData.displayName;
    if (updateData.description !== undefined) updates.description = updateData.description;
    if (updateData.permissions) updates.permissions = updateData.permissions;
    if (updateData.isActive !== undefined) updates.isActive = updateData.isActive;
    
    // <<< THIS IS THE FIX: Handle the new canHandleBilling field >>>
    if (updateData.canHandleBilling !== undefined) {
      updates.canHandleBilling = updateData.canHandleBilling;
    }
    // --- END OF FIX ---

    const updatedRole = await Role.findOneAndUpdate(
      { _id: roleId, tenantId: tenantId },
      { $set: { ...updates, updatedBy: session.user.id } },
      { new: true, runValidators: true } // Added runValidators as a best practice
    );

    return NextResponse.json({ success: true, role: updatedRole });
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

// Your DELETE function is correct and does not need any changes for this feature.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { roleId: string } }
) {
  // ... (Your existing DELETE code is fine) ...
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.ROLES_DELETE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = getTenantId(req);
    if (!tenantId) {
        return NextResponse.json({ success: false, message: 'Tenant ID is missing.' }, { status: 400 });
    }

    const { roleId } = params;

    await connectToDatabase();

    const roleToDelete = await Role.findOne({ _id: roleId, tenantId: tenantId });

    if (!roleToDelete) {
      return NextResponse.json({ success: false, message: 'Role not found in this salon' }, { status: 404 });
    }
   
    if (roleToDelete.isSystemRole) {
      return NextResponse.json({
        success: false,
        message: 'System roles cannot be deleted. You can only make them inactive.'
      }, { status: 403 });
    }

    await Role.findOneAndDelete({ _id: roleId, tenantId: tenantId });

    return NextResponse.json({ success: true, message: 'Role deleted successfully.' });

  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json({ success: false, message: 'An unexpected error occurred while deleting the role.' }, { status: 500 });
  }
}