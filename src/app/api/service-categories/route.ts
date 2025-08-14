import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import ServiceCategory from '@/models/ServiceCategory';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant'; // Import the tenant helper

// Note: It's assumed your 'ServiceCategory' Mongoose model has a 
// 'tenantId' field of type String or ObjectId.

async function checkPermission(permission: string) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, permission)) {
    return null;
  }
  return session;
}

// GET all service categories for the current tenant
export async function GET(req: NextRequest) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  // 2. Check user permissions
  const session = await checkPermission(PERMISSIONS.SERVICES_READ);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    // 3. Scope the find query with the tenantId
    const findQuery = { tenantId };
    const categories = await ServiceCategory.find(findQuery).sort({ name: 1 });
    
    return NextResponse.json({ success: true, data: categories });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}

// POST a new service category for the current tenant
export async function POST(req: NextRequest) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  // 2. Check user permissions
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_CREATE)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  try {
    const body = await req.json();

    // 3. Validate input
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
        return NextResponse.json({ success: false, message: 'Category name is required.' }, { status: 400 });
    }
    const trimmedName = body.name.trim();

    // 4. Proactive, TENANT-SCOPED duplicate check
    // This is the crucial fix. The query now includes the tenantId.
    const existingCategory = await ServiceCategory.findOne({
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }, // Case-insensitive check
        tenantId: tenantId // This ensures the check is only for the current salon
    });

    if (existingCategory) {
        return NextResponse.json({ success: false, message: `A category named '${trimmedName}' already exists in this salon.` }, { status: 409 });
    }

    // 5. If no duplicate is found, proceed with creation
    const category = await ServiceCategory.create({ 
        ...body, 
        name: trimmedName,
        tenantId: tenantId 
    });
    
    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/service-categories:", error);
    // This catch block is now a fallback for other potential errors.
    if (error.code === 11000) {
        return NextResponse.json({ success: false, message: 'A category with this name already exists for this tenant.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: error.message || "Server Error" }, { status: 500 });
  }
}