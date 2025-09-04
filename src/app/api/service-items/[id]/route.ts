import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import ServiceItem from '@/models/ServiceItem';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose'; // <-- Import mongoose for ObjectId validation

async function checkPermission(permission: string) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, permission)) {
    return null;
  }
  return session;
}

interface IParams { params: { id: string } }

// --- START: ADDED GET HANDLER ---
export async function GET(req: NextRequest, { params }: IParams) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  // 2. Check user permissions
  const session = await checkPermission(PERMISSIONS.SERVICES_READ);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  try {
    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid Service ID format' }, { status: 400 });
    }

    // 3. Scope the find query with both the item's ID and the tenantId
    const query = { _id: id, tenantId };
    const service = await ServiceItem.findOne(query).lean();

    if (!service) {
      return NextResponse.json({ success: false, error: 'Service not found for this tenant' }, { status: 404 });
    }

    // Match the response structure the frontend expects
    return NextResponse.json({ success: true, service: service });
  } catch (error: any) {
    console.error(`Error fetching service item ${params.id}:`, error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}
// --- END: ADDED GET HANDLER ---

// PUT (update) a service item
export async function PUT(req: NextRequest, { params }: IParams) {
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  const session = await checkPermission(PERMISSIONS.SERVICES_UPDATE);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    const body = await req.json();
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
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  const session = await checkPermission(PERMISSIONS.SERVICES_DELETE);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    const query = { _id: params.id, tenantId };
    const deletedService = await ServiceItem.findOneAndDelete(query);
    
    if (!deletedService) return NextResponse.json({ success: false, error: 'Service not found for this tenant' }, { status: 404 });
    
    return NextResponse.json({ success: true, data: {} });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}