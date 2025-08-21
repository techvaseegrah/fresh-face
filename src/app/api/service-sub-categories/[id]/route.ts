import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import ServiceSubCategory from '@/models/ServiceSubCategory';
import ServiceItem from '@/models/ServiceItem';
import { getTenantIdOrBail } from '@/lib/tenant'; // Import tenant helper
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// Helper for permission checks
async function checkPermission(permission: string) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, permission)) {
    return null;
  }
  return session;
}

interface IParams { params: { id: string } }

// PUT (update) a sub-category
export async function PUT(req: NextRequest, { params }: IParams) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }
  
  // 2. Check user permissions
  const session = await checkPermission(PERMISSIONS.SERVICES_UPDATE);
  if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  try {
    const body = await req.json();

    // 3. Scope the update query with both the item's ID and the tenantId
    const query = { _id: params.id, tenantId };
    const subCategory = await ServiceSubCategory.findOneAndUpdate(query, body, { new: true, runValidators: true });

    if (!subCategory) return NextResponse.json({ success: false, error: 'Sub-Category not found for this tenant' }, { status: 404 });
    
    return NextResponse.json({ success: true, data: subCategory });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

// DELETE a sub-category
export async function DELETE(req: NextRequest, { params }: IParams) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }
  
  // 2. Check user permissions
  const session = await checkPermission(PERMISSIONS.SERVICES_DELETE);
  if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  try {
    // 3. Scope the dependency check to the current tenant
    const dependencyQuery = { subCategory: params.id, tenantId };
    const serviceCount = await ServiceItem.countDocuments(dependencyQuery);

    if (serviceCount > 0) {
      return NextResponse.json({ success: false, error: `Cannot delete. Used by ${serviceCount} service(s).` }, { status: 400 });
    }
    
    // 4. Scope the delete operation to the current tenant
    const deleteQuery = { _id: params.id, tenantId };
    const deletedSubCategory = await ServiceSubCategory.findOneAndDelete(deleteQuery);

    if (!deletedSubCategory) return NextResponse.json({ success: false, error: 'Sub-Category not found for this tenant' }, { status: 404 });
    
    return NextResponse.json({ success: true, data: {} });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}