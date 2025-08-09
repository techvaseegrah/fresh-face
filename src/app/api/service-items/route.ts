// src/app/api/service-items/route.ts - MULTI-TENANT VERSION

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import ServiceItem from '@/models/ServiceItem';
import ServiceSubCategory from '@/models/ServiceSubCategory';
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
  // 1. Get Tenant ID and check permissions (this part is correct)
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }
  
  const session = await checkPermission(PERMISSIONS.SERVICES_CREATE);
  if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();
    const body = await req.json();
    const { serviceCode, name, price, duration, subCategory } = body;

    // 2. Add detailed input validation
    if (!serviceCode || !name || !price || !duration || !subCategory) {
        return NextResponse.json({ success: false, message: 'Service Code, Name, Price, Duration, and Sub-Category are required.' }, { status: 400 });
    }

    const upperCaseCode = serviceCode.trim().toUpperCase();

    // =========================================================================
    // === THE FIX IS HERE ===
    // 3. Proactively check for a duplicate service code within the current tenant.
    // =========================================================================
    const existingService = await ServiceItem.findOne({
      serviceCode: upperCaseCode,
      tenantId: tenantId
    });

    if (existingService) {
      // If a duplicate is found, return a 409 Conflict error immediately.
      return NextResponse.json({
        success: false,
        message: `A service with code '${upperCaseCode}' already exists for this salon.`
      }, { status: 409 });
    }
    // =========================================================================
    
    // 4. Validate that the subCategory exists for this tenant
    const categoryExists = await ServiceSubCategory.findOne({ _id: subCategory, tenantId: tenantId });
    if (!categoryExists) {
        return NextResponse.json({ success: false, message: 'The selected sub-category is invalid for this salon.' }, { status: 400 });
    }

    // 5. If all checks pass, create the new service item.
    const serviceItem = await ServiceItem.create({
      ...body,
      tenantId: tenantId,
      serviceCode: upperCaseCode // Use the sanitized code
    });

    return NextResponse.json({ success: true, data: serviceItem }, { status: 201 });

  } catch (error: any) {
    console.error("POST /api/service-items DETAILED ERROR:", error);

    // This catch block is now a robust fallback.
    if (error.code === 11000) {
      return NextResponse.json({ success: false, message: 'A service with this code already exists for this tenant.' }, { status: 409 });
    }
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((e: any) => e.message).join('. ');
        return NextResponse.json({ success: false, message: `Validation Failed: ${messages}` }, { status: 400 });
    }

    return NextResponse.json({ success: false, message: 'An unknown server error occurred.' }, { status: 500 });
  }
}