import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import dbConnect from '@/lib/dbConnect';
import Setting from '@/models/Setting';

/**
 * GET handler: Retrieves a specific setting by its key.
 */
export async function GET(request: NextRequest, { params }: { params: { key: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.ALERTS_READ)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  }

  try {
    await dbConnect();
    const setting = await Setting.findOne({ key: params.key }).lean();

    if (!setting) {
      let defaultValue: string | string[] = [];
      if (params.key === 'globalLowStockThreshold') {
        defaultValue = '10';
      }
      return NextResponse.json({ success: true, setting: { key: params.key, value: defaultValue } });
    }

    return NextResponse.json({ success: true, setting });
  } catch (error) {
    console.error(`API Error GET /api/settings/${params.key}:`, error);
    return NextResponse.json({ success: false, message: 'Server Error' }, { status: 500 });
  }
}

/**
 * POST handler: Updates or creates a setting.
 */
export async function POST(request: NextRequest, { params }: { params: { key: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.ALERTS_CREATE) || !hasPermission(session.user.role.permissions, PERMISSIONS.ALERTS_DELETE)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { key } = params;
    const { value } = await request.json();

    if (key === 'globalLowStockThreshold') {
      const numValue = parseInt(value, 10);
      if (isNaN(numValue) || numValue < 0) {
        return NextResponse.json({ success: false, message: 'Threshold must be a valid non-negative number.' }, { status: 400 });
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
        return NextResponse.json({ success: false, message: `Unknown setting key: ${key}`}, { status: 400 });
    }

    await dbConnect();
    
    const updatedSetting = await Setting.findOneAndUpdate(
      { key: key },
      { $set: { value: value, key: key } },
      { new: true, upsert: true, runValidators: true }
    );

    return NextResponse.json({ success: true, setting: updatedSetting });
  } catch (error) { 
    console.error(`API Error POST /api/settings/${params.key}:`, error);
    return NextResponse.json({ success: false, message: 'Server Error' }, { status: 500 });
  }
}