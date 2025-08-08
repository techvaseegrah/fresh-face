import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import ProductSubCategory from '@/models/ProductSubCategory'; 
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

/**
 * Handles GET requests to fetch a list of product sub-categories.
 * It filters the list by the parent 'brandId' and is scoped to the current tenant.
 */
export async function GET(req: NextRequest) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }
  
  // 2. Check user permissions
  const session = await checkPermission(PERMISSIONS.PRODUCTS_READ);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  try {
    const brandId = req.nextUrl.searchParams.get('brandId');
    const type = req.nextUrl.searchParams.get('type');

    if (!brandId) {
      return NextResponse.json({ success: false, error: 'Brand ID is required.' }, { status: 400 });
    }

    // 3. Build the query object, including the tenantId for data isolation
    let query: any = { brand: brandId, tenantId };
    if (type) {
      query.type = type;
    }

    const subCategories = await ProductSubCategory.find(query).sort({ name: 1 });
    return NextResponse.json({ success: true, data: subCategories });
    
  } catch (error) {
    console.error("API Error fetching product sub-categories:", error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}

/**
 * Handles POST requests to create a new product sub-category for the current tenant.
 * The request body must contain the 'name' and the parent 'brand' ID.
 */
export async function POST(req: NextRequest) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  // 2. Check user permissions
  const session = await checkPermission(PERMISSIONS.PRODUCTS_CREATE);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  try {
    const body = await req.json();
    if (!body.brand) {
        return NextResponse.json({ success: false, error: 'Parent brand ID is required to create a sub-category.' }, { status: 400 });
    }

    // 3. Enforce the tenantId on the new document before creation
    const subCategoryData = { ...body, tenantId };

    const subCategory = await ProductSubCategory.create(subCategoryData);
    return NextResponse.json({ success: true, data: subCategory }, { status: 201 });
  } catch (error: any) {
    // 4. Add specific error handling for unique constraint violations
    if (error.code === 11000) {
      return NextResponse.json({
        success: false,
        error: 'A sub-category with this name already exists for this brand.'
      }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}