import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Brand from '@/models/ProductBrand';
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
 * Handles GET requests to fetch a list of product brands,
 * filtered by type and scoped to the current tenant.
 */
export async function GET(req: NextRequest) {
  // 1. Check user permissions
  const session = await checkPermission(PERMISSIONS.PRODUCTS_READ);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  // 2. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  await dbConnect();
  const type = req.nextUrl.searchParams.get('type');
  if (!type) return NextResponse.json({ success: false, error: 'Product type is required' }, { status: 400 });
  
  try {
    // 3. Scope the find query with both type and tenantId
    const query = { type, tenantId };
    const brands = await Brand.find(query).sort({ name: 1 });
    return NextResponse.json({ success: true, data: brands });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}

/**
 * Handles POST requests to create a new product brand for the current tenant.
 */
export async function POST(req: NextRequest) {
  // 1. Check user permissions
  const session = await checkPermission(PERMISSIONS.PRODUCTS_CREATE);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  // 2. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  await dbConnect();
  try {
    const body = await req.json();

    // 3. Enforce the tenantId on the new document before creation
    const brandData = { ...body, tenantId };

    const brand = await Brand.create(brandData);
    return NextResponse.json({ success: true, data: brand }, { status: 201 });
  } catch (error: any) {
    // 4. Add specific error handling for unique constraint violations
    if (error.code === 11000) {
      return NextResponse.json({
        success: false,
        error: 'A brand with this name and type already exists for this tenant.'
      }, { status: 409 }); // 409 Conflict
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}