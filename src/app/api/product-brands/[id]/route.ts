import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Brand from '@/models/ProductBrand';
import SubCategory from '@/models/ProductSubCategory';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant'; // Import tenant helper

// The checkPermission helper is good as is.
async function checkPermission(permission: string) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, permission)) {
    return null;
  }
  return session;
}

/**
 * Handles PUT requests to update a single product brand for the current tenant.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  // 1. Check user permissions
  const session = await checkPermission(PERMISSIONS.PRODUCTS_UPDATE);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  
  // 2. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }
    
  await dbConnect();
  try {
    const body = await req.json();

    // 3. Scope the update query with both the brand's ID and the tenantId
    const query = { _id: params.id, tenantId };
    const brand = await Brand.findOneAndUpdate(query, body, { new: true, runValidators: true });

    if (!brand) return NextResponse.json({ success: false, error: 'Brand not found for this tenant' }, { status: 404 });
    
    return NextResponse.json({ success: true, data: brand });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({
        success: false,
        error: 'A brand with this name and type already exists for this tenant.'
      }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

/**
 * Handles DELETE requests for a single product brand for the current tenant.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  // 1. Check user permissions
  const session = await checkPermission(PERMISSIONS.PRODUCTS_DELETE);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  // 2. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  await dbConnect();
  try {
    // 3. Tenant-Scoped Safety Check: Count sub-categories within the same tenant.
    const subCategoryCount = await SubCategory.countDocuments({ brand: params.id, tenantId });
    if (subCategoryCount > 0) {
      return NextResponse.json({ success: false, error: `Cannot delete brand. It has ${subCategoryCount} associated sub-categor(y)ies.` }, { status: 400 });
    }

    // 4. Scope the delete operation to the current tenant
    const deleteQuery = { _id: params.id, tenantId };
    const deletedBrand = await Brand.findOneAndDelete(deleteQuery);

    if (!deletedBrand) return NextResponse.json({ success: false, error: 'Brand not found for this tenant' }, { status: 404 });
    
    return NextResponse.json({ success: true, data: {} });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}