// app/api/billing/inventory-preview/route.ts - MULTI-TENANT REFACTORED VERSION

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { InventoryManager } from '@/lib/inventoryManager';
import Customer from '@/models/customermodel';
import { Gender } from '@/types/gender';
import { getTenantIdOrBail } from '@/lib/tenant';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// ===================================================================================
//  POST: Handler to preview inventory impact before confirming a billing
// ===================================================================================
export async function POST(req: NextRequest) {
  try {
    // --- MT: Get tenantId and check permissions first ---
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    // const session = await getServerSession(authOptions);
    // // Assuming this action requires billing creation/read permissions
    // if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.BILLING_CREATE)) {
    //   return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    // }

    await connectToDatabase();

    const { serviceIds, customerId } = await req.json();

    if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Service IDs are required' },
        { status: 400 }
      );
    }

    // Get customer gender if available
    let customerGender: Gender = Gender.Other;
    if (customerId) {
      // --- MT: Scope the customer lookup by tenantId ---
      const customer = await Customer.findOne({ _id: customerId, tenantId });
      customerGender = customer?.gender || Gender.Other;
    }

    // --- MT: Pass the tenantId to the InventoryManager ---
    // This is crucial because the manager needs to look up tenant-specific services and products.
    const inventoryImpact = await InventoryManager.calculateMultipleServicesInventoryImpact(
      serviceIds,
      customerGender,
      tenantId // Pass the tenantId
    );

    return NextResponse.json({
      success: true,
      data: {
        customerGender,
        inventoryImpact: inventoryImpact.impactSummary,
        totalUpdates: inventoryImpact.totalUpdates
      }
    });

  } catch (error: any) {
    console.error('Inventory preview error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to calculate inventory impact' },
      { status: 500 }
    );
  }
}