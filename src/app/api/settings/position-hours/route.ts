// src/app/api/settings/position-hours/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import ShopSetting, { IPositionHourSetting } from '../../../../models/ShopSetting';
import Staff from '../../../../models/staff';

// TENANT-AWARE: Import the tenant helper
import { getTenantIdOrBail } from '../../../../lib/tenant';

interface PositionHourData {
  positionName: string;
  requiredHours: number;
}

export async function GET(request: NextRequest) {
  // TENANT-AWARE: Get tenant ID or exit
  const tenantIdOrResponse = getTenantIdOrBail(request);
  if (tenantIdOrResponse instanceof NextResponse) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;
  
  await dbConnect();

  try {
    // TENANT-AWARE: Scope the distinct query to the current tenant
    const allPositionsInUse: string[] = await Staff.distinct('position', { 
      position: { $ne: null, $ne: '' },
      tenantId: tenantId 
    });

    // TENANT-AWARE: Find the settings document for the current tenant
    const settingsDoc = await ShopSetting.findOne({ key: 'defaultSettings', tenantId: tenantId }).lean();

    const savedPositionSettings: IPositionHourSetting[] = settingsDoc?.positionHours || [];
    const shopDefaultHours = settingsDoc?.defaultDailyHours ?? 8;

    const settingsMap = new Map<string, number>();
    savedPositionSettings.forEach(setting => {
      settingsMap.set(setting.positionName, setting.requiredHours);
    });

    const responseData: PositionHourData[] = allPositionsInUse.map(position => ({
      positionName: position,
      // Default to monthly hours if not set (e.g., 8 hours * 22 working days)
      requiredHours: settingsMap.get(position) ?? (shopDefaultHours * 22),
    }));
    
    responseData.sort((a, b) => a.positionName.localeCompare(b.positionName));

    return NextResponse.json({ success: true, data: responseData });

  } catch (error) {
    console.error(`API Error in GET /api/settings/position-hours for tenant ${tenantId}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown server error occurred';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // TENANT-AWARE: Get tenant ID or exit
  const tenantIdOrResponse = getTenantIdOrBail(request);
  if (tenantIdOrResponse instanceof NextResponse) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;

  await dbConnect();

  try {
    const body: PositionHourData[] = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Invalid request body. Expected an array.' }, { status: 400 });
    }

    // TENANT-AWARE: Scope the update operation to the current tenant
    await ShopSetting.findOneAndUpdate(
        { key: 'defaultSettings', tenantId: tenantId },
        { $set: { 
            positionHours: body,
            key: 'defaultSettings', // Explicitly set key on upsert
            tenantId: tenantId      // Explicitly set tenantId on upsert
          } 
        },
        { new: true, upsert: true }
    );

    return NextResponse.json({ 
        success: true, 
        message: 'Settings saved successfully.',
    });

  } catch (error) {
    console.error(`API Error in POST /api/settings/position-hours for tenant ${tenantId}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown server error occurred';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}