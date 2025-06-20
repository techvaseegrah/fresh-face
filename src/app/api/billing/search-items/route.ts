// app/api/billing/search-items/route.ts
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ServiceItem from '@/models/ServiceItem';
import Product from '@/models/Product';

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ success: true, items: [] });
    }

    const searchRegex = new RegExp(query, 'i');

    // Search both services and products in parallel
    const [services, products] = await Promise.all([
      // Search services
      ServiceItem.find({
        name: { $regex: searchRegex }
      })
      .select('name price membershipRate')
      .limit(5)
      .lean(),
      
      // Search products for retail
      Product.find({
        name: { $regex: searchRegex },
        type: 'Retail' // Only retail products should be sold to customers
      })
      .populate('brand', 'name')
      .populate('subCategory', 'name')
      .select('name price sku unit')
      .limit(5)
      .lean()
    ]);

    // Format the results
    const items = [
      ...services.map(service => ({
        id: service._id.toString(),
        name: service.name,
        price: service.price,
        membershipRate: service.membershipRate,
        type: 'service' as const
      })),
      ...products.map(product => ({
        id: product._id.toString(),
        name: `${product.name} (${product.unit})`,
        price: product.price,
        type: 'product' as const,
        sku: product.sku
      }))
    ];

    return NextResponse.json({ 
      success: true, 
      items 
    });

  } catch (error: any) {
    console.error('API Error searching billing items:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to search items' 
    }, { status: 500 });
  }
}