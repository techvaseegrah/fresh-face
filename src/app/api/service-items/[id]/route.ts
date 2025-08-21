import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import ServiceItem from '@/models/ServiceItem';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant'; // Import the tenant helper

// Re-introducing the permission check helper for security
async function checkPermission(permission: string) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, permission)) {
    return null;
  }
  return session;
}

interface IParams { params: { id: string } }

// PUT (update) a service item
export async function PUT(req: NextRequest, { params }: IParams) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  // 2. Check user permissions (re-added for security)
  const session = await checkPermission(PERMISSIONS.SERVICES_UPDATE);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    const body = await req.json();

    // 3. Scope the update query with both the item's ID and the tenantId
    const query = { _id: params.id, tenantId };
    const service = await ServiceItem.findOneAndUpdate(query, body, { new: true, runValidators: true });
    
    if (!service) return NextResponse.json({ success: false, error: 'Service not found for this tenant' }, { status: 404 });
    
    return NextResponse.json({ success: true, data: service });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

// DELETE a service item
export async function DELETE(req: NextRequest, { params }: IParams) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  // 2. Check user permissions (re-added for security)
  const session = await checkPermission(PERMISSIONS.SERVICES_DELETE);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    // 3. Scope the delete operation to the current tenant
    const query = { _id: params.id, tenantId };
    const deletedService = await ServiceItem.findOneAndDelete(query);
    
    if (!deletedService) return NextResponse.json({ success: false, error: 'Service not found for this tenant' }, { status: 404 });
    
    return NextResponse.json({ success: true, data: {} });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}