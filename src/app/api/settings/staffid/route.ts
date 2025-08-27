// src/app/api/settings/staffid/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import ShopSetting from '../../../../models/ShopSetting';
import { getTenantIdOrBail } from '@/lib/tenant'; // Import the tenant helper

// This line tells Next.js to never cache the results of this route.
// It will be re-executed on every request, ensuring fresh data for each tenant.
export const dynamic = 'force-dynamic';

/**
 * GET handler to fetch the current settings for a specific tenant.
 */
export async function GET(request: NextRequest) {
  // 1. Get the tenant ID from the request header or bail out with an error.
  const tenantIdOrResponse = getTenantIdOrBail(request);
  if (tenantIdOrResponse instanceof NextResponse) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;

  await dbConnect();

  try {
    // 2. Find the settings document that is scoped to the specific tenant.
    let settings = await ShopSetting.findOne({ key: 'defaultSettings', tenantId: tenantId });
    
    // 3. If no settings exist for this tenant, create them with default values.
    if (!settings) {
      console.log(`No settings found for tenant ${tenantId}, creating with default values...`);
      const newSettingsData = {
        key: 'defaultSettings',
        tenantId: tenantId,
        // The Mongoose schema will apply other default values (e.g., staffIdBaseNumber: 1).
      };
      settings = await new ShopSetting(newSettingsData).save();
    }
    
    return NextResponse.json({ success: true, data: settings.toObject() });
  } catch (error) {
    console.error(`Failed to fetch settings for tenant ${tenantId}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, error: `Failed to fetch settings: ${message}` }, { status: 500 });
  }
}

/**
 * POST handler to update the settings for a specific tenant.
 */
export async function POST(request: NextRequest) {
  // 1. Get the tenant ID from the request header or bail out.
  const tenantIdOrResponse = getTenantIdOrBail(request);
  if (tenantIdOrResponse instanceof NextResponse) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;

  await dbConnect();

  try {
    const body = await request.json();

    // Prevent key and tenantId from being changed via the request body.
    delete body.key;
    delete body.tenantId;

    // 2. Use findOneAndUpdate with `upsert: true` scoped to the tenant.
    // This atomically finds and updates the document for the correct tenant,
    // or creates it if it does not exist.
    const updatedSettings = await ShopSetting.findOneAndUpdate(
      // The filter is now tenant-specific.
      { key: 'defaultSettings', tenantId: tenantId },
      { 
        // Set the new values from the request body.
        $set: body,
        // If a new document is created (upserted), ensure its tenantId and key are set.
        $setOnInsert: { tenantId: tenantId, key: 'defaultSettings' }
      },
      { 
        new: true,           // Return the modified document after the update.
        upsert: true,        // Create the document if it doesn't exist.
        runValidators: true, // Ensure the updates adhere to schema rules.
      }
    );

    return NextResponse.json({ success: true, data: updatedSettings.toObject() });
  } catch (error: any) {
    console.error(`Failed to update settings for tenant ${tenantId}:`, error);
    if (error.name === 'ValidationError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = error.message || 'An unknown error occurred';
    return NextResponse.json({ success: false, error: `Failed to update settings: ${message}` }, { status: 500 });
  }
}