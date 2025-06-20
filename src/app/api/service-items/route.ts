// app/api/service-items/route.ts
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import ServiceItem from '@/models/ServiceItem';

export async function GET(req: NextRequest) {
  await dbConnect();
  try {
    // Fetch all service items with populated subcategory information
    const serviceItems = await ServiceItem.find({})
      .populate({
        path: 'subCategory',
        populate: {
          path: 'mainCategory',
          model: 'ServiceCategory'
        }
      })
      .populate('consumables.product', 'name sku unit')
      .sort({ name: 1 });

    // Format for frontend dropdown
    const formattedServices = serviceItems.map(item => ({
      _id: item._id,
      id: item._id.toString(),
      name: item.name,
      price: item.price,
      duration: item.duration, // This is duration in minutes
      durationMinutes: item.duration, // Alias for consistency
      subCategory: item.subCategory,
      consumables: item.consumables
    }));

    return NextResponse.json({ 
      success: true, 
      services: formattedServices,
      data: formattedServices 
    });
  } catch (error: any) {
    console.error('ServiceItem API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Server Error' 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await dbConnect();
  try {
    const body = await req.json();
    const serviceItem = await ServiceItem.create(body);
    return NextResponse.json({ success: true, data: serviceItem }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}