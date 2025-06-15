import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/Product';

/**
 * Handles fetching a list of products based on various query parameters.
 * This endpoint is flexible enough to support:
 * 1. Searching for an exact SKU.
 * 2. Searching for products by name.
 * 3. Listing all products belonging to a specific sub-category.
 */
export async function GET(req: NextRequest) {
  await dbConnect();
  
  const sku = req.nextUrl.searchParams.get('sku');
  const search = req.nextUrl.searchParams.get('search');
  const subCategoryId = req.nextUrl.searchParams.get('subCategoryId');

  try {
    let query: any = {}; 

    if (sku) {
      // PRIORITY 1: Search by SKU for consumables lookup
      query = { sku: { $regex: `^${sku}$`, $options: 'i' } };
    } 
    else if (search) {
      // PRIORITY 2: Search by name for a general search feature
      query = { name: { $regex: search, $options: 'i' } };
    }
    else if (subCategoryId) {
      // PRIORITY 3: List products for the ProductManager's third column
      query = { subCategory: subCategoryId };
    }
    else {
      // Fallback: Return empty array if no valid parameters are provided
      return NextResponse.json({ success: true, data: [] });
    }

    // --- THIS IS THE CRUCIAL FIX ---
    // Execute the find command and then populate the referenced data.
    const products = await Product.find(query)
      .populate('brand', 'name type') // For the 'brand' field, fetch its 'name' and 'type'
      .populate('subCategory', 'name') // For the 'subCategory' field, fetch its 'name'
      .sort({ name: 1 });
    // --- END OF FIX ---
    
    return NextResponse.json({ success: true, data: products });

  } catch (error) {
    console.error("API Error fetching products:", error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}

/**
 * Handles the creation of a new product.
 */
export async function POST(req: NextRequest) {
  await dbConnect();
  try {
    const body = await req.json();
    const product = await Product.create(body);
    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (error: any) {
    console.error("API PRODUCT CREATION ERROR:", error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to create product' }, { status: 400 });
  }
}