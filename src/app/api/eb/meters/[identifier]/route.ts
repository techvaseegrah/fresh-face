// src/app/api/eb/meters/[identifier]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant';
import connectToDatabase from '@/lib/mongodb';
import Meter from '@/models/Meter';

interface RouteParams {
  params: {
    identifier: string;
  };
}

/**
 * PUT handler to update a meter's name.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { identifier } = params;
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) return tenantId;

    const session = await getServerSession(authOptions);
    // Use a relevant permission, EB_UPLOAD is a good choice for meter management
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.EB_UPLOAD)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return NextResponse.json({ success: false, message: 'A valid meter name (at least 3 characters) is required.' }, { status: 400 });
    }

    await connectToDatabase();

    // Find the meter by its unique identifier and tenantId to ensure security
    const meter = await Meter.findOneAndUpdate(
      { identifier, tenantId },
      { $set: { name: name.trim() } },
      { new: true } // Return the updated document
    );

    if (!meter) {
      return NextResponse.json({ success: false, message: 'Meter not found or you do not have permission to edit it.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, meter });

  } catch (error) {
    console.error('Error updating meter:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE handler to remove a meter.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { identifier } = params;
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) return tenantId;

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.EB_UPLOAD)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Find and delete the meter by its unique identifier and tenantId
    const result = await Meter.deleteOne({ identifier, tenantId });

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: 'Meter not found or you do not have permission to delete it.' }, { status: 404 });
    }

    // Note: This does NOT delete associated EBReadings, preserving historical data.
    
    return NextResponse.json({ success: true, message: 'Meter deleted successfully.' });

  } catch (error) {
    console.error('Error deleting meter:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}