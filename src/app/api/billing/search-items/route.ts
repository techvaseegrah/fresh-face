// app/api/billing/search-items/route.ts - INCLUDE MEMBERSHIP RATES
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

    const [services, products] = await Promise.all([
      ServiceItem.find({ name: { $regex: searchRegex } })
        .select('name price membershipRate') // Include membership rate
        .limit(10)
        .lean(),
      
      Product.find({ name: { $regex: searchRegex } })
        .select('name price')
        .limit(10)
        .lean()
    ]);

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
        name: product.name,
        price: product.price,
        type: 'product' as const
      }))
    ];

    return NextResponse.json({ success: true, items });

  } catch (error: any) {
    console.error("API Error searching items:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}