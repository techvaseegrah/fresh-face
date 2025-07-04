// /app/api/services/import/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

import ServiceCategory from '@/models/ServiceCategory';
import ServiceSubCategory from '@/models/ServiceSubCategory';
import ServiceItem from '@/models/ServiceItem';
import Product from '@/models/Product';

interface ServiceImportRow {
  ServiceName: string;
  ServiceCode: string;
  CategoryName: string;
  SubCategoryName: string;
  Audience: 'male' | 'female' | 'Unisex';
  Duration: number;
  Price: number;
  MembershipRate?: number;
  Consumable_SKU?: string;
  Consumable_Unit?: string;
  Consumable_Default_Qty?: number;
  Consumable_Male_Qty?: number;
  Consumable_Female_Qty?: number;
}

export async function POST(req: NextRequest) {
  // 1. --- PERMISSION & SETUP ---
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_CREATE)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows: ServiceImportRow[] = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, message: 'No service data provided.' }, { status: 400 });
    }

    await dbConnect();

    // 2. --- GROUP ROWS BY SERVICE CODE ---
    // This aggregates all consumables under a single service entry.
    const serviceGroups = new Map<string, { details: ServiceImportRow; consumables: any[] }>();
    for (const row of rows) {
      if (!row.ServiceCode) continue;
      if (!serviceGroups.has(row.ServiceCode)) {
        serviceGroups.set(row.ServiceCode, { details: row, consumables: [] });
      }
      if (row.Consumable_SKU) {
        serviceGroups.get(row.ServiceCode)!.consumables.push({
          sku: row.Consumable_SKU,
          unit: row.Consumable_Unit,
          quantity: {
            default: row.Consumable_Default_Qty,
            male: row.Consumable_Male_Qty,
            female: row.Consumable_Female_Qty,
          },
        });
      }
    }
    
    // 3. --- PROCESS EACH SERVICE GROUP ---
    const report = {
      totalServices: serviceGroups.size,
      successfulImports: 0,
      failedImports: 0,
      newCategories: new Set<string>(),
      newSubCategories: new Set<string>(),
      errors: [] as { serviceName: string; serviceCode: string; message: string }[],
    };

    const productCache = new Map<string, any>();

    for (const [serviceCode, group] of serviceGroups.entries()) {
      const { details } = group;
      const audience = details.Audience==="Unisex" ?"Unisex":details.Audience.toLowerCase();
      try {
        // --- Find or Create Category ---
        const category = await ServiceCategory.findOneAndUpdate(
          { name: details.CategoryName, targetAudience: audience },
          { $setOnInsert: { name: details.CategoryName, targetAudience: audience } },
          { upsert: true, new: true, runValidators: true }
        );
        if (category.isNew) report.newCategories.add(category.name);

        // --- Find or Create SubCategory ---
        const subCategory = await ServiceSubCategory.findOneAndUpdate(
          { name: details.SubCategoryName, mainCategory: category._id },
          { $setOnInsert: { name: details.SubCategoryName, mainCategory: category._id } },
          { upsert: true, new: true, runValidators: true }
        );
        if (subCategory.isNew) report.newSubCategories.add(subCategory.name);
        
        // --- Resolve Consumable Products ---
        const resolvedConsumables = [];
        for (const con of group.consumables) {
          let product = productCache.get(con.sku);
          if (!product) {
            product = await Product.findOne({ sku: con.sku }).lean();
            if (!product) throw new Error(`Consumable product with SKU "${con.sku}" not found.`);
            productCache.set(con.sku, product);
          }
          resolvedConsumables.push({
            product: product._id,
            unit: con.unit || product.unit,
            quantity: con.quantity,
          });
        }
        
        // --- Create or Update ServiceItem ---
        const serviceData = {
          name: details.ServiceName,
          subCategory: subCategory._id,
          duration: details.Duration,
          price: details.Price,
          membershipRate: details.MembershipRate,
          consumables: resolvedConsumables,
            serviceCode: details.ServiceCode,

        };

      await ServiceItem.findOneAndUpdate(
          { serviceCode: details.ServiceCode }, // Use ServiceCode as the unique key
          { $set: serviceData },
          { upsert: true, new: true, runValidators: true }
        );

        report.successfulImports++;
      } catch (error: any) {
        report.failedImports++;
        report.errors.push({
          serviceName: details.ServiceName,
          serviceCode,
          message: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Service import process completed.',
      report: {
        ...report,
        newCategories: Array.from(report.newCategories),
        newSubCategories: Array.from(report.newSubCategories),
      },
    });

  } catch (error: any) {
    console.error("API Error during service import:", error);
    return NextResponse.json({ success: false, message: 'Server-side error during import.' }, { status: 500 });
  }
}