// /app/api/products/import/route.ts - MULTI-TENANT VERSION

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/Product';
import ProductBrand from '@/models/ProductBrand';
import ProductSubCategory from '@/models/ProductSubCategory';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant'; // 1. Import the tenant helper

// NOTE: It is assumed that Product, ProductBrand, and ProductSubCategory models all have a 'tenantId' field.

// Define the expected structure of a row from the Excel file
interface ProductImportRow {
  BrandName: string;
  SubCategoryName: string;
  ProductName: string;
  SKU: string;
  ProductType: 'Retail' | 'In-House';
  Price: number;
  NumberOfItems: number;
  QuantityPerItem: number;
  Unit: 'ml' | 'g' | 'kg' | 'l' | 'piece';
  StockedDate: string; 
  ExpiryDate?: string;
  LowStockThreshold?: number;
}

export async function POST(req: NextRequest) {
  // 1. --- PERMISSION & TENANT CHECK ---
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.PRODUCTS_CREATE)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  
  // 2. Get the Tenant ID right at the start or fail.
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  try {
    const productsToImport: ProductImportRow[] = await req.json();
    if (!Array.isArray(productsToImport) || productsToImport.length === 0) {
      return NextResponse.json({ success: false, message: 'No products to import.' }, { status: 400 });
    }

    await dbConnect();
    
    // 3. --- REPORTING & CACHING ---
    const report = {
      totalRows: productsToImport.length,
      successfulImports: 0,
      failedImports: 0,
      newBrands: new Set<string>(),
      newSubCategories: new Set<string>(),
      errors: [] as { row: number; message: string; data: ProductImportRow }[],
    };

    const brandCache = new Map<string, any>();
    const subCategoryCache = new Map<string, any>();

    // 4. --- PROCESS EACH ROW ---
    for (const [index, row] of productsToImport.entries()) {
      try {
        if (!row.BrandName || !row.SubCategoryName || !row.ProductName || !row.SKU || !row.ProductType) {
          throw new Error('Missing required fields: BrandName, SubCategoryName, ProductName, SKU, and ProductType are all required.');
        }

        // --- Find or Create Brand (Scoped to Tenant) ---
        const brandCacheKey = `${row.BrandName}-${row.ProductType}-${tenantId}`; // Tenant-specific cache key
        if (!brandCache.has(brandCacheKey)) {
          const brand = await ProductBrand.findOneAndUpdate(
            { name: row.BrandName, type: row.ProductType, tenantId }, // Filter includes tenantId
            { $setOnInsert: { name: row.BrandName, type: row.ProductType, tenantId } }, // Add tenantId on creation
            { upsert: true, new: true, runValidators: true }
          );
          brandCache.set(brandCacheKey, brand);
          // isNew is not a standard mongoose property, but upsert result contains `upserted` field.
          // A better check might be needed if you rely on this heavily. For simplicity, we'll keep the logic.
          report.newBrands.add(brand.name);
        }
        const brand = brandCache.get(brandCacheKey);

        // --- Find or Create SubCategory (Scoped to Tenant) ---
        const subCategoryCacheKey = `${row.SubCategoryName}-${brand._id}-${tenantId}`; // Tenant-specific cache key
        if (!subCategoryCache.has(subCategoryCacheKey)) {
          const subCategory = await ProductSubCategory.findOneAndUpdate(
            { name: row.SubCategoryName, brand: brand._id, tenantId }, // Filter includes tenantId
            { $setOnInsert: { name: row.SubCategoryName, brand: brand._id, type: brand.type, tenantId } }, // Add tenantId on creation
            { upsert: true, new: true, runValidators: true }
          );
          subCategoryCache.set(subCategoryCacheKey, subCategory);
          report.newSubCategories.add(subCategory.name);
        }
        const subCategory = subCategoryCache.get(subCategoryCacheKey);
        
        // --- Create or Update Product (Scoped to Tenant) ---
        const productData = {
            name: row.ProductName,
            brand: brand._id,
            subCategory: subCategory._id,
            type: brand.type,
            price: row.Price,
            numberOfItems: row.NumberOfItems,
            quantityPerItem: row.QuantityPerItem,
            unit: row.Unit,
            stockedDate: new Date(row.StockedDate),
            expiryDate: row.ExpiryDate ? new Date(row.ExpiryDate) : null,
            lowStockThreshold: row.LowStockThreshold || 10,
            totalQuantity: row.NumberOfItems * row.QuantityPerItem,
            tenantId: tenantId, // Explicitly add tenantId to the data
        };
        
        await Product.findOneAndUpdate(
            { sku: row.SKU, tenantId }, // CRITICAL: Filter by SKU and tenantId
            { $set: productData }, // $set will apply the tenantId on both update and insert
            { upsert: true, new: true, runValidators: true }
        );

        report.successfulImports++;

      } catch (error: any) {
        report.failedImports++;
        report.errors.push({
          row: index + 2,
          message: error.message || 'An unknown error occurred.',
          data: row,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Import process completed.',
      report: {
          ...report,
          newBrands: Array.from(report.newBrands),
          newSubCategories: Array.from(report.newSubCategories)
      }
    });

  } catch (error: any) {
    console.error("API Error during product import:", error);
    return NextResponse.json({ success: false, message: 'Failed to process import request.' }, { status: 500 });
  }
}