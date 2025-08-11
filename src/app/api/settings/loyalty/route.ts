// app/api/settings/loyalty/route.ts

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Setting, { ILoyaltySettings } from '@/models/Setting';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getServerSession } from 'next-auth';

// TENANT-AWARE: Import the tenant helper
import { getTenantIdOrBail } from '@/lib/tenant';

// Helper to get settings with a fallback default, now tenant-aware
async function getLoyaltySettings(tenantId: string): Promise<ILoyaltySettings> {
  const defaultSettings: ILoyaltySettings = { rupeesForPoints: 100, pointsAwarded: 6 };
  try {
    // TENANT-AWARE: Filter by key AND tenantId
    const settingDoc = await Setting.findOne({ key: 'loyalty', tenantId: tenantId });
    if (settingDoc) {
      return settingDoc.value;
    }
    // TENANT-AWARE: Create the default setting FOR THIS TENANT if it doesn't exist
    await Setting.create({ key: 'loyalty', value: defaultSettings, tenantId: tenantId });
    return defaultSettings;
  } catch (error) {
    console.error(`Error fetching/creating loyalty settings for tenant ${tenantId}, using default.`, error);
    return defaultSettings;
  }
}

// ===================================================================
//  GET: Handler for fetching current loyalty settings for the admin page
// ===================================================================
export async function GET(req: NextRequest) {
  // TENANT-AWARE: Get tenant ID or exit
  const tenantIdOrResponse = getTenantIdOrBail(req);
  if (tenantIdOrResponse instanceof NextResponse) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;

  const session = await getServerSession(authOptions);
  if (!session || !session.user || !hasPermission(session.user.role.permissions, PERMISSIONS.LOYALTY_SETTINGS_READ)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    await connectToDatabase();
    // TENANT-AWARE: Pass tenantId to the helper
    const settings = await getLoyaltySettings(tenantId);
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error(`Error in GET /api/settings/loyalty for tenant ${tenantId}:`, error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// ===================================================================
//  PUT: Handler for UPDATING the loyalty settings from the admin page
// ===================================================================
export async function PUT(req: NextRequest) {
  // TENANT-AWARE: Get tenant ID or exit
  const tenantIdOrResponse = getTenantIdOrBail(req);
  if (tenantIdOrResponse instanceof NextResponse) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;

  const session = await getServerSession(authOptions);
  if (!session || !session.user || !hasPermission(session.user.role.permissions, PERMISSIONS.LOYALTY_SETTINGS_UPDATE)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    await connectToDatabase();
    const body: ILoyaltySettings = await req.json();

    // Validation remains the same
    if (typeof body.rupeesForPoints !== 'number' || typeof body.pointsAwarded !== 'number' || body.rupeesForPoints <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid settings values provided.' }, { status: 400 });
    }

    // TENANT-AWARE: Update the filter and the $set operator to be tenant-scoped
    const updatedSetting = await Setting.findOneAndUpdate(
      { key: 'loyalty', tenantId: tenantId }, // Filter by key AND tenantId
      { $set: { value: body, key: 'loyalty', tenantId: tenantId } }, // Ensure tenantId is written on create/update
      { new: true, upsert: true, runValidators: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Loyalty settings updated successfully!',
      settings: updatedSetting.value,
    });

  } catch (error: any) {
    console.error(`Error updating loyalty settings for tenant ${tenantId}:`, error);
    return NextResponse.json({ success: false, message: 'Failed to update settings.' }, { status: 500 });
  }
}