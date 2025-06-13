// app/api/billing/search-items/route.ts

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Product from '@/models/product'; // Your Product model
import Service from '@/models/service';   // Your Service model

export async function GET(req: Request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');

    if (!query || query.trim().length < 2) {
      // Don't search for very short queries
      return NextResponse.json({ success: true, items: [] });
    }

    const searchRegex = new RegExp(query, 'i'); // Case-insensitive search

    // --- Search for products and services in parallel for performance ---
    const [products, services] = await Promise.all([
      // Find RETAIL products that are ACTIVE
      Product.find({
        name: { $regex: searchRegex },
        type: ['Retail','Professional'],
        isActive: true
      }).select('name retailPrice').limit(5),

      // Find ACTIVE services
      Service.find({
        name: { $regex: searchRegex },
        isActive: true
      }).select('name price').limit(5)
    ]);

    // --- Format the results into a consistent structure for the frontend ---
    const formattedProducts = products.map(p => ({
      id: p._id.toString(),
      name: p.name,
      price: p.retailPrice,
      type: 'product' as const // Add a 'type' property for the UI
    }));
    
    const formattedServices = services.map(s => ({
      id: s._id.toString(),
      name: s.name,
      price: s.price,
      type: 'service' as const // Add a 'type' property for the UI
    }));

    // Combine and return the results
    const combinedItems = [...formattedServices, ...formattedProducts];

    return NextResponse.json({ success: true, items: combinedItems });

  } catch (error: any) {
    console.error("API Error searching billable items:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}