// app/api/products/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ProductModel from '@/models/Product';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant'; // 1. Import the tenant helper

/**
 * WHAT: This API endpoint searches for products by name *within the current tenant's scope*.
 * WHY: The Purchase Order modal needs a way to find products dynamically
 * as the user types into the product search field, ensuring data isolation.
 *
 * Example URL: /api/products/search?q=shampoo
 */
export async function GET(req: NextRequest) {
  try {
    // 2. Get tenantId first, or bail if it's not present
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) {
      return tenantId;
    }

    // Security: Ensure user is logged in.
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q'); // Get the search query 'q' from the URL

    if (!query) {
      return NextResponse.json([], { status: 200 }); // Return empty array if no query
    }

    await connectToDatabase();

    // 3. Add tenantId to the find query to scope the search
    const filter = {
      tenantId, // <-- This ensures we only search within the active tenant
      name: { $regex: query, $options: 'i' } 
    };

    // Use MongoDB's $regex operator to perform a case-insensitive "contains" search.
    const products = await ProductModel.find(filter)
      .limit(10) // Limit to 10 results to avoid overwhelming the user
      .select('name sku price'); // Only select the fields we need

    return NextResponse.json(products);

  } catch (error) {
    console.error("Product search failed:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}