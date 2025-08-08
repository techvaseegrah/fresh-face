// /app/api/services/import/route.ts - MULTI-TENANT VERSION

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant'; // 1. Import the tenant helper

import ServiceCategory from '@/models/ServiceCategory';
import ServiceSubCategory from '@/models/ServiceSubCategory';
import ServiceItem from '@/models/ServiceItem';
import Product from '@/models/Product';

// Note: It's assumed all models (ServiceCategory, ServiceSubCategory, ServiceItem, Product) 
// have a 'tenantId' field to enable data scoping.

interface ServiceImportRow {
  ServiceName: string;
  ServiceCode: string;
  CategoryName: string;
  SubCategoryName: string;
  Duration: number;
  Price: number;
  MembershipRate?: number;
  [key: string]: any; 
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_CREATE)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  // 2. Get the Tenant ID at the beginning of the request or fail early.
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  try {
    const rows: ServiceImportRow[] = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, message: 'No service data provided.' }, { status: 400 });
    }

    await dbConnect();
    
    const report = {
      totalRows: rows.length,
      successfulImports: 0,
      failedImports: 0,
      errors: [] as { row: number; serviceName?: string; message: string }[],
    };

    const productCache = new Map<string, any>();

    for (const [index, row] of rows.entries()) {
      try {
        if (!row.ServiceCode || !row.ServiceName || !row.CategoryName || !row.SubCategoryName) {
            throw new Error('Missing required fields (ServiceCode, ServiceName, CategoryName, SubCategoryName).');
        }

        // 3. Scope find/create for ServiceCategory by tenantId.
        const category = await ServiceCategory.findOneAndUpdate(
          { name: row.CategoryName, tenantId }, // Filter includes tenantId
          { $setOnInsert: { name: row.CategoryName, tenantId } }, // Add tenantId on creation
          { upsert: true, new: true, runValidators: true }
        );

        // 4. Scope find/create for ServiceSubCategory by tenantId.
        const subCategory = await ServiceSubCategory.findOneAndUpdate(
          { name: row.SubCategoryName, mainCategory: category._id, tenantId }, // Filter includes tenantId
          { $setOnInsert: { name: row.SubCategoryName, mainCategory: category._id, tenantId } }, // Add tenantId on creation
          { upsert: true, new: true, runValidators: true }
        );
        
        // Resolve consumables, also scoped by tenant.
        const resolvedConsumables = [];
        for (let i = 1; i <= 10; i++) {
          const sku = row[`Consumable${i}_SKU`];
          const defaultQty = row[`Consumable${i}_Default_Qty`];

          if (sku && defaultQty) {
            let product = productCache.get(sku);
            if (!product) {
              // 5. Scope Product lookup by tenantId.
              // This assumes Products (inventory) are specific to each tenant.
              product = await Product.findOne({ sku: String(sku).trim().toUpperCase(), tenantId }).lean();
              if (!product) throw new Error(`Product with SKU "${sku}" for this tenant not found.`);
              productCache.set(sku, product);
            }
            resolvedConsumables.push({
              product: product._id,
              unit: row[`Consumable${i}_Unit`] || product.unit,
              quantity: {
                default: Number(defaultQty),
              },
            });
          }
        }
        
        // 6. Build the service data object, now including the tenantId.
        const serviceData = {
          name: row.ServiceName,
          serviceCode: row.ServiceCode,
          subCategory: subCategory._id,
          duration: row.Duration,
          price: row.Price,
          membershipRate: row.MembershipRate,
          consumables: resolvedConsumables,
          tenantId: tenantId, // Explicitly add tenantId to the data payload
        };
        
        // 7. Scope find/update for ServiceItem by tenantId.
        await ServiceItem.findOneAndUpdate(
          { serviceCode: row.ServiceCode, tenantId }, // Filter by serviceCode AND tenantId
          { $set: serviceData }, // $set operator will apply all fields, including tenantId
          { upsert: true, new: true, runValidators: true }
        );

        report.successfulImports++;
      } catch (error: any) {
        report.failedImports++;
        report.errors.push({ row: index + 2, serviceName: row.ServiceName, message: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Service import process completed.',
      report,
    });

  } catch (error: any) {
    console.error("API Error during service import:", error);
    return NextResponse.json({ success: false, message: 'Server-side error during import.' }, { status: 500 });
  }
}