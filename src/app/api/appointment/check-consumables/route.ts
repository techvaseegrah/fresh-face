// FILE: src/api/appointment/check-consumables/route.ts

import { NextRequest, NextResponse } from 'next/server'; // CHANGED: Imported NextRequest
import dbConnect from '@/lib/dbConnect';
import { getTenantIdOrBail } from '@/lib/tenant'; // CHANGED: Imported the tenant helper
import ServiceItem from '@/models/ServiceItem';
import Product from '@/models/Product';
import { Gender } from '@/types/gender';

interface CheckRequestBody {
  serviceIds: string[];
  customerGender?: 'male' | 'female' | 'other';
}

// CHANGED: The request type is now NextRequest to work with the tenant helper
export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    // CHANGED: Step 1 - Get the Tenant ID or stop execution
    // This is the most critical step. It ensures all subsequent operations
    // are for the correct tenant.
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) {
      return tenantId; // Bail out if tenantId is missing
    }

    const { serviceIds, customerGender = 'other' }: CheckRequestBody = await req.json();

    if (!serviceIds || serviceIds.length === 0) {
      return NextResponse.json({ success: true, canBook: true });
    }

    const requiredConsumables = new Map<string, { required: number, unit: string, name: string }>();

    // CHANGED: Step 2 - Add tenantId to the ServiceItem query
    const services = await ServiceItem.find({
      _id: { $in: serviceIds },
      tenantId: tenantId, // Ensures we only find services belonging to this tenant
    }).populate('consumables.product', 'name');

    // The logic for calculating consumables remains the same, as it's in-memory
    for (const service of services) {
      if (!service.consumables || service.consumables.length === 0) continue;

      for (const consumable of service.consumables) {
        if (!consumable.product?._id) continue;
        
        let quantityToUse = consumable.quantity.default || 0;
        if (customerGender === Gender.Male && typeof consumable.quantity.male === 'number') {
          quantityToUse = consumable.quantity.male;
        } else if (customerGender === Gender.Female && typeof consumable.quantity.female === 'number') {
          quantityToUse = consumable.quantity.female;
        }
        
        const productId = consumable.product._id.toString();
        const existing = requiredConsumables.get(productId);

        if (existing) {
          existing.required += quantityToUse;
        } else {
          requiredConsumables.set(productId, {
            required: quantityToUse,
            unit: consumable.unit,
            name: (consumable.product as any).name,
          });
        }
      }
    }

    if (requiredConsumables.size === 0) {
      return NextResponse.json({ success: true, canBook: true });
    }

    const productIds = Array.from(requiredConsumables.keys());
    
    // CHANGED: Step 3 - Add tenantId to the Product query
    const productsInDb = await Product.find({
      _id: { $in: productIds },
      tenantId: tenantId, // Ensures we only check stock for this tenant's products
    }).select('totalQuantity name');
    
    // The logic for checking for issues remains the same
    const issues: any[] = [];
    for (const dbProduct of productsInDb) {
      const required = requiredConsumables.get(dbProduct._id.toString());
      if (!required) continue;

      if (dbProduct.totalQuantity < required.required) {
        issues.push({
          productName: required.name,
          required: required.required,
          available: dbProduct.totalQuantity,
          unit: required.unit,
        });
      }
    }

    if (issues.length > 0) {
      return NextResponse.json({ success: true, canBook: false, issues });
    }

    return NextResponse.json({ success: true, canBook: true });

  } catch (error: any) {
    console.error("Error checking consumables:", error);
    return NextResponse.json({ success: false, message: "Error checking consumable availability." }, { status: 500 });
  }
}