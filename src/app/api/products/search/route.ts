import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ProductModel from '@/models/Product';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * WHAT: This API endpoint searches for products by name.
 * WHY: The Purchase Order modal needs a way to find products dynamically
 * as the user types into the product search field.
 *
 * Example URL: /api/products/search?q=shampoo
 */
export async function GET(req: NextRequest) {
  // Security: Ensure user is logged in. Anyone who can create a PO should be able to search.
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q'); // Get the search query 'q' from the URL

    if (!query) {
      return NextResponse.json([], { status: 200 }); // Return empty array if no query
    }

    await connectToDatabase();

    // Use MongoDB's $regex operator to perform a case-insensitive "contains" search.
    const products = await ProductModel.find({
      name: { $regex: query, $options: 'i' } 
    })
    .limit(10) // Limit to 10 results to avoid overwhelming the user
    .select('name sku price'); // Only select the fields we need

    return NextResponse.json(products);

  } catch (error) {
    console.error("Product search failed:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}