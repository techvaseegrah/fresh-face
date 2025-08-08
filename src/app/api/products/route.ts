// src/app/api/products/route.ts - MULTI-TENANT VERSION

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/Product';
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
  const session = await checkPermission(PERMISSIONS.PRODUCTS_READ);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  await dbConnect();

  try {
    const sku = req.nextUrl.searchParams.get('sku');
    const search = req.nextUrl.searchParams.get('search');
    const subCategoryId = req.nextUrl.searchParams.get('subCategoryId');

    // 3. Add tenantId to the base query to ensure data isolation
    const query: any = { tenantId };

    if (subCategoryId) {
      if (!mongoose.Types.ObjectId.isValid(subCategoryId)) {
        return NextResponse.json({ success: false, error: 'Invalid Sub-Category ID' }, { status: 400 });
      }
      query.subCategory = new mongoose.Types.ObjectId(subCategoryId);
    }
    if (sku) {
      // Using regex for an exact, case-insensitive match
      query.sku = { $regex: `^${sku}$`, $options: 'i' };
    }
    if (search) {
      // Use regex for a "contains" search on the product name
      query.name = { $regex: search, $options: 'i' };
    }
    
    // The find() query is now safely scoped to the tenant
    const products = await Product.find(query)
      .populate('brand', 'name type')
      .populate('subCategory', 'name')
      .sort({ name: 1 });
      
    return NextResponse.json({ success: true, data: products });

  } catch (error) {
    console.error("API Error fetching products:", error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  // 2. Check user permissions
  const session = await checkPermission(PERMISSIONS.PRODUCTS_CREATE);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  try {
    const body = await req.json();

    // 3. Enforce the tenantId on the new document before creation
    const productData = { ...body, tenantId };
    
    const product = await Product.create(productData);

    console.log("API PRODUCT CREATION:", product);
    
    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (error: any) {
    console.error("API PRODUCT CREATION ERROR:", error);
    // 4. Provide specific feedback for unique constraint violations (e.g., duplicate SKU)
    if (error.code === 11000) {
      return NextResponse.json({
        success: false,
        error: 'A product with this SKU already exists for this tenant.'
      }, { status: 409 }); // 409 Conflict is a good status code here
    }
    return NextResponse.json({ success: false, error: error.message || 'Failed to create product' }, { status: 400 });
  }
}