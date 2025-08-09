// app/api/settings/[key]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import dbConnect from '@/lib/dbConnect';
import Setting from '@/models/Setting';

// TENANT-AWARE: Import the tenant helper
import { getTenantIdOrBail } from '@/lib/tenant';

/**
 * GET handler: Retrieves a specific setting by its key, scoped to the tenant.
 */
export async function GET(request: NextRequest, { params }: { params: { key: string } }) {
  // TENANT-AWARE: Get tenant ID or exit
  const tenantIdOrResponse = getTenantIdOrBail(request);
  if (tenantIdOrResponse instanceof NextResponse) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;
  
  const session = await getServerSession(authOptions);

  const canViewEbSettings = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.EB_VIEW_CALCULATE);
  const canViewAlertSettings = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.ALERTS_READ);

  if (!session || (!canViewEbSettings && !canViewAlertSettings)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  }

  try {
    await dbConnect();
    
    // TENANT-AWARE: Scope the findOne query with the tenantId
    const setting = await Setting.findOne({ key: params.key, tenantId: tenantId }).lean();

    if (!setting) {
      // This logic is still perfect. If the setting doesn't exist for this tenant,
      // provide a default value.
      let defaultValue: any = null;
      if (params.key === 'globalLowStockThreshold') {
        defaultValue = '10';
      } else if (params.key === 'ebCostPerUnit') {
        defaultValue = 8;
      }
      return NextResponse.json({ success: true, setting: { key: params.key, value: defaultValue } });
    }

    return NextResponse.json({ success: true, setting });
  } catch (error) {
    console.error(`API Error GET /api/settings/${params.key} for tenant ${tenantId}:`, error);
    return NextResponse.json({ success: false, message: 'Server Error' }, { status: 500 });
  }
}

/**
 * POST handler: Updates or creates a setting, scoped to the tenant.
 */
export async function POST(request: NextRequest, { params }: { params: { key: string } }) {
  // TENANT-AWARE: Get tenant ID or exit
  const tenantIdOrResponse = getTenantIdOrBail(request);
  if (tenantIdOrResponse instanceof NextResponse) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;
  
  const session = await getServerSession(authOptions);
  
  const canEditEbSettings = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.EB_VIEW_CALCULATE);
  const canEditAlertSettings = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.ALERTS_CREATE) && hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.ALERTS_DELETE);
  
  if (!session || (!canEditEbSettings && !canEditAlertSettings)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { key } = params;
    const { value } = await request.json();

    // Validation logic remains the same
    if (key === 'globalLowStockThreshold') {
      const numValue = parseInt(value, 10);
      if (isNaN(numValue) || numValue < 0) {
        return NextResponse.json({ success: false, message: 'Threshold must be a valid non-negative number.' }, { status: 400 });
      }
    } else if (key === 'ebCostPerUnit') {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue < 0) {
        return NextResponse.json({ success: false, message: 'Cost per unit must be a valid non-negative number.' }, { status: 400 });
      }
    } else if (key.includes('Recipients')) {
      if (!Array.isArray(value)) {
        return NextResponse.json({ success: false, message: 'Invalid data format. Expected an array for recipients.' }, { status: 400 });
      }
      for (const email of value) {
        if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
          return NextResponse.json({ success: false, message: `Invalid email address found: ${email}` }, { status: 400 });
        }
      }
    } else {
        return NextResponse.json({ success: false, message: `Unknown or unhandled setting key: ${key}`}, { status: 400 });
    }

    await dbConnect();
    
    // TENANT-AWARE: Update the filter and the $set operator
    const updatedSetting = await Setting.findOneAndUpdate(
      { key: key, tenantId: tenantId }, // Filter by key AND tenantId
      { $set: { value: value, key: key, tenantId: tenantId } }, // Ensure tenantId is written
      { new: true, upsert: true, runValidators: true }
    );

    return NextResponse.json({ success: true, setting: updatedSetting });
  } catch (error) { 
    console.error(`API Error POST /api/settings/${params.key} for tenant ${tenantId}:`, error);
    return NextResponse.json({ success: false, message: 'Server Error' }, { status: 500 });
  }
}