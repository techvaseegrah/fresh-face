// /app/api/settings/membership/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import connectToDatabase from '@/lib/mongodb';
import Setting from '@/models/Setting';

// TENANT-AWARE: Import the tenant helper
import { getTenantIdOrBail } from '@/lib/tenant';

const MEMBERSHIP_FEE_KEY = 'membershipFee';

// --- GET Handler: Fetch the current fee for a specific tenant ---
export async function GET(req: NextRequest) {
  // TENANT-AWARE: Get tenant ID or exit
  const tenantIdOrResponse = getTenantIdOrBail(req);
  if (tenantIdOrResponse instanceof NextResponse) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;

  // Added permission check for security and consistency
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role?.permissions, PERMISSIONS.MEMBERSHIP_SETTINGS_READ)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  }

  await connectToDatabase();
  try {
    // TENANT-AWARE: Scope the query to the specific tenant
    const setting = await Setting.findOne({ key: MEMBERSHIP_FEE_KEY, tenantId: tenantId }).lean();

    // If not found for this tenant, return a default value
    if (!setting) {
      return NextResponse.json({ success: true, price: 0, message: "Default value, setting not found." });
    }

    return NextResponse.json({ success: true, price: parseFloat(setting.value) });

  } catch (error) {
    console.error(`[GET /api/settings/membership for tenant ${tenantId}] ${error}`);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

// --- POST Handler: Update the fee for a specific tenant ---
export async function POST(req: NextRequest) {
  // TENANT-AWARE: Get tenant ID or exit
  const tenantIdOrResponse = getTenantIdOrBail(req);
  if (tenantIdOrResponse instanceof NextResponse) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;

  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role?.permissions, PERMISSIONS.MEMBERSHIP_SETTINGS_WRITE)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  }

  await connectToDatabase();
  try {
    const { price } = await req.json();
    const numericPrice = parseFloat(price);

    if (isNaN(numericPrice) || numericPrice < 0) {
      return NextResponse.json({ success: false, message: 'Invalid price. Must be a non-negative number.' }, { status: 400 });
    }

    // TENANT-AWARE: Update the filter and the $set operator to be tenant-scoped
    await Setting.findOneAndUpdate(
      { key: MEMBERSHIP_FEE_KEY, tenantId: tenantId }, // Filter by key AND tenantId
      { $set: { key: MEMBERSHIP_FEE_KEY, value: String(numericPrice), tenantId: tenantId } }, // Ensure tenantId is written
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, message: 'Membership fee updated successfully.' });

  } catch (error) {
    console.error(`[POST /api/settings/membership for tenant ${tenantId}] ${error}`);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}