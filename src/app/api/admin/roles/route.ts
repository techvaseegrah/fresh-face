// /app/api/admin/roles/route.ts - TENANT-AWARE VERSION

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Role from '@/models/role';
import User from '@/models/user';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantId } from '@/lib/tenant';

// GET all roles for the current tenant
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // ✅ START OF PERMISSION FIX
    // This check now allows access if the user can either read roles directly
    // OR if they have permission to manage issues, which requires loading this list.
    const userPermissions = session?.user?.role?.permissions || [];
    const canReadRoles = hasPermission(userPermissions, PERMISSIONS.ROLES_READ);
    const canManageIssues = hasPermission(userPermissions, PERMISSIONS.ISSUE_MANAGE);

    if (!session || (!canReadRoles && !canManageIssues)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    // ✅ END OF PERMISSION FIX

    const tenantId = getTenantId(req);
    if (!tenantId) {
        return NextResponse.json({ success: false, message: 'Tenant ID is missing.' }, { status: 400 });
    }

    await connectToDatabase();
    
    const roles = await Role.find({ tenantId: tenantId })
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, roles });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE a role and its associated users within the current tenant
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.ROLES_DELETE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const tenantId = getTenantId(req);
    if (!tenantId) {
        return NextResponse.json({ success: false, message: 'Tenant ID is missing.' }, { status: 400 });
    }

    const { roleId } = await req.json();

    if (!roleId) {
      return NextResponse.json({ success: false, message: 'Role ID is required' }, { status: 400 });
    }

    await connectToDatabase();
    
    const role = await Role.findOne({ _id: roleId, tenantId: tenantId });
    if (!role) {
      return NextResponse.json({ success: false, message: 'Role not found in this salon' }, { status: 404 });
    }

    await User.deleteMany({ roleId: roleId, tenantId: tenantId });

    await role.deleteOne();

    return NextResponse.json({ success: true, message: 'Role and associated users deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

// POST (create) a new role for the current tenant
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.ROLES_CREATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = getTenantId(req);
    if (!tenantId) {
        return NextResponse.json({ success: false, message: 'Tenant ID is missing.' }, { status: 400 });
    }

    // <<< STEP 1: READ canHandleBilling FROM THE REQUEST BODY >>>
    const { name, displayName, description, permissions, canHandleBilling } = await req.json();

    if (!name || !displayName) { // Permissions are not strictly required for creation
      return NextResponse.json({ success: false, message: 'Name and display name are required' }, { status: 400 });
    }
    
    await connectToDatabase();
    
    const upperCaseName = name.toUpperCase();

    const existingRole = await Role.findOne({ name: upperCaseName, tenantId: tenantId });
    if (existingRole) {
      return NextResponse.json({ success: false, message: `Role with name '${name}' already exists in this salon` }, { status: 409 });
    }

    // <<< STEP 2: PASS canHandleBilling WHEN CREATING THE ROLE >>>
    const role = await Role.create({
      tenantId: tenantId,
      name: upperCaseName,
      displayName,
      description,
      permissions: permissions || [],
      canHandleBilling: canHandleBilling || false, // Add this line
      createdBy: session.user.id
    });

    return NextResponse.json({ success: true, role }, { status: 201 });

  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      const body = await req.json();
      return NextResponse.json({
        success: false,
        message: `Role with name '${body.name}' already exists in this salon (database conflict).`
      }, { status: 409 });
    }

    console.error('Error creating role:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}