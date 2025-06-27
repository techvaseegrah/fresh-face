// src/app/api/service-items/route.ts (Corrected)
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import ServiceItem from '@/models/ServiceItem';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  await dbConnect();
  try {
    const subCategoryId = req.nextUrl.searchParams.get('subCategoryId');

    // 1. Initialize an empty query object
    const query: any = {};

    // 2. If a subCategoryId is provided, add it to the query
    if (subCategoryId) {
      if (!mongoose.Types.ObjectId.isValid(subCategoryId)) {
        return NextResponse.json({ success: false, error: 'Invalid Sub-Category ID' }, { status: 400 });
      }
      query.subCategory = new mongoose.Types.ObjectId(subCategoryId);
    }
    // If no subCategoryId is provided, the query object remains empty {}, 
    // which tells `find` to fetch all documents.

    // 3. Execute the find with the built query
    const serviceItems = await ServiceItem.find(query)
      .populate({
        path: 'subCategory',
        populate: {
          path: 'mainCategory',
          model: 'ServiceCategory'
        }
      })
      .populate('consumables.product', 'name sku unit')
      .sort({ name: 1 });

    // Format the results for the frontend
    const formattedServices = serviceItems.map(item => ({
      _id: item._id,
      id: item._id.toString(),
      name: item.name,
      price: item.price,
      duration: item.duration,
      membershipRate: item.membershipRate,
      subCategory: item.subCategory,
      consumables: item.consumables
    }));

    return NextResponse.json({
      success: true,
      services: formattedServices, // Used by appointment forms
      data: formattedServices      // Used by service manager
    });
  } catch (error: any) {
    console.error('ServiceItem API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Server Error'
    }, { status: 500 });
  }
}

// POST function remains unchanged
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