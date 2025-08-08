// src/app/api/products/[id]/route.ts - MULTI-TENANT VERSION

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/Product';
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


export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  // 2. Check user permissions
  const session = await checkPermission(PERMISSIONS.PRODUCTS_UPDATE);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  try {
    const body = await req.json();

    // 3. Find the document scoped to the current tenant
    const product = await Product.findOne({ _id: params.id, tenantId });

    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found for this tenant' }, { status: 404 });
    }

    // This part remains the same: apply changes and save to trigger hooks
    Object.assign(product, body);
    const savedProduct = await product.save();

    return NextResponse.json({ success: true, data: savedProduct });

  } catch (error: any) {
    // Catch validation errors from .save() and potential duplicate key errors
    if (error.code === 11000) {
      return NextResponse.json({
        success: false,
        error: 'A product with this SKU already exists for this tenant.'
      }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  // 1. Get Tenant ID or bail if not present
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  // 2. Check user permissions
  const session = await checkPermission(PERMISSIONS.PRODUCTS_DELETE);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  try {
    // 3. Scope the delete operation to the current tenant
    const deleteQuery = { _id: params.id, tenantId };
    const deletedProduct = await Product.findOneAndDelete(deleteQuery);

    if (!deletedProduct) return NextResponse.json({ success: false, error: 'Product not found for this tenant' }, { status: 404 });
    
    return NextResponse.json({ success: true, data: {} });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}