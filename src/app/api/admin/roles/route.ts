// /app/api/admin/roles/route.ts - TENANT-AWARE VERSION

import { NextRequest, NextResponse } from 'next/server'; // <-- 1. Import NextRequest
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Role from '@/models/role';
import User from '@/models/user'; // Corrected import name
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantId } from '@/lib/tenant'; // <-- 2. Import a tenant helper

// GET all roles for the current tenant
export async function GET(req: NextRequest) { // <-- 3. Add 'req'
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.ROLES_READ)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = getTenantId(req); // <-- 4. Get the tenantId from the request
    if (!tenantId) {
        return NextResponse.json({ success: false, message: 'Tenant ID is missing.' }, { status: 400 });
    }

    await connectToDatabase();
    
    // <-- 5. Scope the find query by tenantId
    const roles = await Role.find({ tenantId: tenantId })
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, roles });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE a role and its associated users within the current tenant
export async function DELETE(req: NextRequest) { // <-- 3. Change 'Request' to 'NextRequest'
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.ROLES_DELETE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const tenantId = getTenantId(req); // <-- 4. Get the tenantId
    if (!tenantId) {
        return NextResponse.json({ success: false, message: 'Tenant ID is missing.' }, { status: 400 });
    }

    const { roleId } = await req.json();

    if (!roleId) {
      return NextResponse.json({ success: false, message: 'Role ID is required' }, { status: 400 });
    }

    await connectToDatabase();
    
    // <-- 5. Scope the find query by tenantId AND roleId
    const role = await Role.findOne({ _id: roleId, tenantId: tenantId });
    if (!role) {
      return NextResponse.json({ success: false, message: 'Role not found in this salon' }, { status: 404 });
    }

    // <-- 5. Scope the user deletion by tenantId AND roleId
    await User.deleteMany({ roleId: roleId, tenantId: tenantId });

    // The 'role' object is a Mongoose document, so we can call .deleteOne() on it directly.
    // This is implicitly secure because we already verified it belongs to the tenant.
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

    await connectToDatabase();
    
    const { name, displayName, description, permissions } = await req.json();

    if (!name || !displayName || !permissions) {
      return NextResponse.json({ success: false, message: 'Name, display name, and permissions are required' }, { status: 400 });
    }
    
    const upperCaseName = name.toUpperCase();

    // This check handles 99% of cases
    const existingRole = await Role.findOne({ name: upperCaseName, tenantId: tenantId });
    if (existingRole) {
      return NextResponse.json({ success: false, message: `Role with name '${name}' already exists in this salon` }, { status: 409 });
    }

    const role = await Role.create({
      tenantId: tenantId,
      name: upperCaseName,
      displayName,
      description,
      permissions,
      createdBy: session.user.id
    });

    return NextResponse.json({ success: true, role }, { status: 201 });

  } catch (error) {
    // --- START OF IMPROVEMENT ---
    // This handles the race condition where the findOne check passes but the create fails
    // due to the unique index in the database.
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      const body = await req.json();
      return NextResponse.json({
        success: false,
        message: `Role with name '${body.name}' already exists in this salon (database conflict).`
      }, { status: 409 }); // 409 Conflict is the correct status code
    }
    // --- END OF IMPROVEMENT ---

    console.error('Error creating role:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}