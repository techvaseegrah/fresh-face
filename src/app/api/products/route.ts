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
  // 1. Get Tenant ID (no change)
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;

  // 2. Check permissions (no change)
  const session = await checkPermission(PERMISSIONS.PRODUCTS_CREATE);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    const body = await req.json();
    const { sku } = body; // Destructure for the check

    // Add validation for required fields
    if (!sku || !body.name || !body.brand || !body.subCategory) {
        return NextResponse.json({ success: false, error: 'SKU, name, brand, and sub-category are required.' }, { status: 400 });
    }

    // --- START OF REFINEMENT ---
    // 3. Explicitly check if the SKU already exists for this tenant.
    const existingProduct = await Product.findOne({ sku, tenantId });
    if (existingProduct) {
      return NextResponse.json({
        success: false,
        error: `A product with the SKU '${sku}' already exists in this salon.`
      }, { status: 409 });
    }
    // --- END OF REFINEMENT ---

    // 4. Enforce the tenantId and create the new document.
    const productData = { ...body, tenantId, createdBy: session.user.id };
    const product = await Product.create(productData);

    return NextResponse.json({ success: true, data: product }, { status: 201 });

  } catch (error: any) {
    // 5. Keep the unique constraint handler as a final defense against race conditions.
    if (error.code === 11000) {
      return NextResponse.json({
        success: false,
        error: 'A product with this SKU already exists for this tenant.'
      }, { status: 409 });
    }
    if (error.name === 'ValidationError') {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    
    console.error("API PRODUCT CREATION ERROR:", error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}