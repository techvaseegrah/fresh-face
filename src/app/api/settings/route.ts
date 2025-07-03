// app/api/settings/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ShopSetting from '@/models/ShopSetting';
import { NextRequest } from 'next/server';

const SETTINGS_KEY = 'defaultSettings';

/**
 * @description GET handler to fetch the current shop settings.
 */
export async function GET() {
  try {
    await dbConnect();

    let settings = await ShopSetting.findOne({ key: SETTINGS_KEY }).lean();

    // If no settings exist in the DB, create them now.
    if (!settings) {
      // 1. Create the document and save it.
      await new ShopSetting().save();
      
      // ✅ FIX: Re-fetch the newly created document using .lean()
      // This ensures the 'settings' variable always has a consistent type.
      settings = await ShopSetting.findOne({ key: SETTINGS_KEY }).lean();
    }

    // Now, `settings` will definitely have a value and the correct type.
    return NextResponse.json({ success: true, data: settings });
    
  } catch (error: any) {
    console.error("GET /api/settings Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * @description POST handler to update the shop settings.
 */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();

    const updatedSettings = await ShopSetting.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: body },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    return NextResponse.json({ success: true, data: updatedSettings });
  } catch (error: any) {
    console.error("POST /api/settings Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}