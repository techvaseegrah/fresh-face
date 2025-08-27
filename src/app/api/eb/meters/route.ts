// src/app/api/eb/meters/route.ts (NEW FILE)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant';
import Meter from '@/models/Meter'; // Import our new model

/**
 * GET handler to fetch all meters for the current tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) return tenantId;

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.EB_UPLOAD)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const meters = await Meter.find({ tenantId: tenantId }).sort({ createdAt: 1 });

    return NextResponse.json({ success: true, meters });

  } catch (error) {
    console.error('Failed to fetch EB meters:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}

/**
 * POST handler to create a new meter for the current tenant.
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) return tenantId;

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.EB_UPLOAD)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return NextResponse.json({ success: false, message: 'A valid meter name (at least 3 characters) is required.' }, { status: 400 });
    }

    await connectToDatabase();

    // Check if a meter with this name already exists for the tenant
    const existingMeter = await Meter.findOne({ tenantId: tenantId, name: name.trim() });
    if (existingMeter) {
        return NextResponse.json({ success: false, message: 'A meter with this name already exists.' }, { status: 409 }); // 409 Conflict
    }

    // Generate a unique, URL-friendly identifier
    const identifier = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`;

    const newMeter = new Meter({
        tenantId,
        name: name.trim(),
        identifier,
        createdBy: session.user.id,
    });

    await newMeter.save();
    
    return NextResponse.json({ success: true, meter: newMeter }, { status: 201 });

  } catch (error) {
    console.error('Failed to create EB meter:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}