import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import ServiceCategory from '@/models/ServiceCategory';
import ServiceSubCategory from '@/models/ServiceSubCategory';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant'; // Import the tenant helper

// Note: It's assumed your Mongoose models ('ServiceCategory', 'ServiceSubCategory') 
// have a 'tenantId' field to associate them with a specific tenant.

async function checkPermission(permission: string) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, permission)) {
    return null;
  }
  return session;
}

interface IParams { params: { id: string } }

// PUT (update) a service category
export async function PUT(req: NextRequest, { params }: IParams) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId; // Return the error response
  }

  // 2. Check user permissions
  const session = await checkPermission(PERMISSIONS.SERVICES_UPDATE);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    const body = await req.json();
    
    // 3. Scope the update query with the tenantId
    const query = { _id: params.id, tenantId };
    const category = await ServiceCategory.findOneAndUpdate(query, body, { new: true, runValidators: true });
    
    if (!category) return NextResponse.json({ success: false, error: 'Category not found for this tenant' }, { status: 404 });
    
    return NextResponse.json({ success: true, data: category });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

// DELETE a service category
export async function DELETE(req: NextRequest, { params }: IParams) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId; // Return the error response
  }

  // 2. Check user permissions
  const session = await checkPermission(PERMISSIONS.SERVICES_DELETE);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    // 3. Scope the sub-category check to the current tenant
    const subCategoryCount = await ServiceSubCategory.countDocuments({ mainCategory: params.id, tenantId });
    if (subCategoryCount > 0) {
      return NextResponse.json({ success: false, error: `Cannot delete. Used by ${subCategoryCount} sub-categor(y)ies.` }, { status: 400 });
    }
    
    // 4. Scope the delete operation to the current tenant
    const deleteQuery = { _id: params.id, tenantId };
    const deletedCategory = await ServiceCategory.findOneAndDelete(deleteQuery);
    
    if (!deletedCategory) return NextResponse.json({ success: false, error: 'Category not found for this tenant' }, { status: 404 });
    
    return NextResponse.json({ success: true, data: {} });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}