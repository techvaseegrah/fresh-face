import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import ProductSubCategory from '@/models/ProductSubCategory';
import Product from '@/models/Product'; 
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

/**
 * Handles PUT requests to update a single product sub-category for the current tenant.
 */
export async function PUT(req: NextRequest, { params }: IParams) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }
  
  // 2. Check user permissions
  const session = await checkPermission(PERMISSIONS.PRODUCTS_UPDATE);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  try {
    const body = await req.json();

    // 3. Scope the update query with both the item's ID and the tenantId
    const query = { _id: params.id, tenantId };
    const subCategory = await ProductSubCategory.findOneAndUpdate(query, body, { new: true, runValidators: true });
    
    if (!subCategory) {
      return NextResponse.json({ success: false, error: 'Product Sub-Category not found for this tenant' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: subCategory });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({
        success: false,
        error: 'A sub-category with this name already exists for this brand.'
      }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

/**
 * Handles DELETE requests for a single product sub-category for the current tenant.
 * Includes a tenant-scoped safety check to prevent deletion if products are using it.
 */
export async function DELETE(req: NextRequest, { params }: IParams) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  // 2. Check user permissions
  const session = await checkPermission(PERMISSIONS.PRODUCTS_DELETE);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  try {
    // 3. Tenant-Scoped Safety Check: Count products using this sub-category within the same tenant.
    const productCount = await Product.countDocuments({ subCategory: params.id, tenantId });
    if (productCount > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete. This sub-category is used by ${productCount} product(s).` },
        { status: 400 }
      );
    }

    // 4. Scope the delete operation to the current tenant
    const deleteQuery = { _id: params.id, tenantId };
    const deletedSubCategory = await ProductSubCategory.findOneAndDelete(deleteQuery);
    
    if (!deletedSubCategory) {
      return NextResponse.json({ success: false, error: 'Product Sub-Category not found for this tenant' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: {} });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}