import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import ServiceSubCategory from '@/models/ServiceSubCategory';
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


// GET all sub-categories, filtered by mainCategory ID and scoped to the tenant
export async function GET(req: NextRequest) {
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
    const mainCategoryId = req.nextUrl.searchParams.get('mainCategoryId');
    if (!mainCategoryId) {
      return NextResponse.json({ success: false, error: 'Main Category ID is required.' }, { status: 400 });
    }

    // 3. Scope the find query with both mainCategory and tenantId
    const query = { mainCategory: mainCategoryId, tenantId };
    const subCategories = await ServiceSubCategory.find(query).sort({ name: 1 });

    return NextResponse.json({ success: true, data: subCategories });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}

// POST a new sub-category, associating it with the current tenant
export async function POST(req: NextRequest) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  // 2. Check user permissions
  const session = await checkPermission(PERMISSIONS.SERVICES_CREATE);
  if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  try {
    const body = await req.json();
    if (!body.mainCategory) {
        return NextResponse.json({ success: false, error: 'Parent category ID is required.' }, { status: 400 });
    }

    // 3. Add the tenantId to the document before creation to ensure it's saved for the correct tenant
    const subCategoryData = { ...body, tenantId };
    const subCategory = await ServiceSubCategory.create(subCategoryData);

    return NextResponse.json({ success: true, data: subCategory }, { status: 201 });
  } catch (error: any) {
    // Handle potential duplicate key errors (e.g., if you have a unique index on name, mainCategory, and tenantId)
    if (error.code === 11000) {
        return NextResponse.json({ success: false, error: 'A sub-category with this name already exists in the selected category.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}