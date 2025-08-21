// FILE: src/app/api/dashboard/low-stock-products/route.ts - CORRECTED VERSION

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose'; // CHANGED: Import the 'Types' utility from Mongoose
import dbConnect from '@/lib/dbConnect';
import Setting from '@/models/Setting';
import Product from '@/models/Product';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant';

// ===================================================================================
//  GET: Handler to fetch low-stock products for the current tenant
// ===================================================================================
export async function GET(request: NextRequest) {
  try {
    // --- MT: Get tenantId and check permissions first ---
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) return tenantId;

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.DASHBOARD_READ)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();

    // --- MT: 1. Fetch the tenant-specific threshold setting ---
    const thresholdSetting = await Setting.findOne({
      key: 'lowStockThreshold',
      // CHANGED: Cast the string tenantId to a Mongoose ObjectId
      tenantId: new Types.ObjectId(tenantId) 
    }).lean();
    
    const tenantThreshold = thresholdSetting ? parseInt(thresholdSetting.value, 10) : 10;
    
    if (isNaN(tenantThreshold)) {
      console.warn(`Warning: Low stock threshold for tenant ${tenantId} is not a valid number. Defaulting to 10.`);
    }

    // --- MT: 2. Find all products for THIS TENANT that are at or below the threshold ---
    const lowStockProducts = await Product.find({
      // CHANGED: Cast the string tenantId to a Mongoose ObjectId here as well
      tenantId: new Types.ObjectId(tenantId), 
      numberOfItems: { $gt: 0, $lte: tenantThreshold }
    })
    .select('name numberOfItems sku')
    .sort({ numberOfItems: 1 })
    .lean();

    // 3. Return the data in a structured format
    return NextResponse.json({ 
      success: true, 
      count: lowStockProducts.length,
      products: lowStockProducts,
      threshold: tenantThreshold,
    });

  } catch (error: any) {
    // Your server terminal will show the full error here, which is very helpful for debugging.
    console.error('[API /dashboard/low-stock-products] Error:', error);
    return NextResponse.json({ success: false, message: 'Server error.', error: error.message }, { status: 500 });
  }
}