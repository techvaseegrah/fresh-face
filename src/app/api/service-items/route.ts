// src/app/api/service-items/route.ts - MULTI-TENANT VERSION

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import ServiceItem from '@/models/ServiceItem';
import mongoose from 'mongoose';
import { getTenantIdOrBail } from '@/lib/tenant'; // Import tenant helper
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// Helper for permission checks
async function checkPermission(permission: string) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, permission)) {
    return null;
  }
  return session;
}


export async function GET(req: NextRequest) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  // 2. Check user permissions
  const session = await checkPermission(PERMISSIONS.SERVICES_READ);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  try {
    const subCategoryId = req.nextUrl.searchParams.get('subCategoryId');
    const gender = req.nextUrl.searchParams.get('gender');
    const search = req.nextUrl.searchParams.get('search');

    // 3. Add tenantId to the base query to ensure data isolation
    const query: any = { tenantId };

    if (subCategoryId) {
      if (!mongoose.Types.ObjectId.isValid(subCategoryId)) {
        return NextResponse.json({ success: false, error: 'Invalid Sub-Category ID' }, { status: 400 });
      }
      query.subCategory = new mongoose.Types.ObjectId(subCategoryId);
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // The find() query is now safely scoped to the tenant
    let serviceItems = await ServiceItem.find(query)
      .populate({
        path: 'subCategory',
        populate: {
          path: 'mainCategory',
          model: 'ServiceCategory',
          select: 'targetAudience' // This is fine, as the population follows IDs from tenant-scoped items
        }
      })
      .populate('consumables.product', 'name sku unit')
      .sort({ name: 1 });

    // The post-query filtering in JS is safe because the initial `serviceItems` list is already tenant-scoped
    if (gender && (gender === 'male' || gender === 'female')) {
      serviceItems = serviceItems.filter(item => {
        // The type assertion helps with strict TypeScript settings
        const targetAudience = (item.subCategory as any)?.mainCategory?.targetAudience;
        return targetAudience === 'Unisex' || targetAudience?.toLowerCase() === gender;
      });
    }

    const formattedServices = serviceItems.map(item => {
      const serviceObject = item.toObject();
      return {
        ...serviceObject,
        _id: item._id.toString(),
        id: item._id.toString(),
        audience: (item.subCategory as any)?.mainCategory?.targetAudience,
      };
    });

    return NextResponse.json({
      success: true,
      services: formattedServices,
      data: formattedServices
    });
  } catch (error: any) {
    console.error('ServiceItem API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Server Error'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }
  
  // 2. Check user permissions
  const session = await checkPermission(PERMISSIONS.SERVICES_CREATE);
  if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  try {
    const body = await req.json();
    
    // 3. Enforce the tenantId on the new document to ensure it's saved for the correct tenant
    const serviceData = { ...body, tenantId };

    const serviceItem = await ServiceItem.create(serviceData);
    return NextResponse.json({ success: true, data: serviceItem }, { status: 201 });
  } catch (error: any) {
    // Optional: Add more specific error handling, e.g., for duplicate service codes within a tenant
    if (error.code === 11000) {
        return NextResponse.json({ success: false, error: 'A service with this code already exists for this tenant.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}