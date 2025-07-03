// src/app/api/service-items/route.ts (Corrected)
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import ServiceItem from '@/models/ServiceItem';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  await dbConnect();
  try {
    const subCategoryId = req.nextUrl.searchParams.get('subCategoryId');
    const gender = req.nextUrl.searchParams.get('gender');

    // 1. Initialize an empty query object
    const query: any = {};

    // 2. If a subCategoryId is provided, add it to the query
    if (subCategoryId) {
      if (!mongoose.Types.ObjectId.isValid(subCategoryId)) {
        return NextResponse.json({ success: false, error: 'Invalid Sub-Category ID' }, { status: 400 });
      }
      query.subCategory = new mongoose.Types.ObjectId(subCategoryId);
    }

    console.log(gender,'gender');
    

    // 3. Execute the find with the built query and populate necessary fields
    let serviceItems = await ServiceItem.find(query)
      .populate({
        path: 'subCategory',
        populate: {
          path: 'mainCategory',
          model: 'ServiceCategory',
          select: 'targetAudience'
        }
      })
      .populate('consumables.product', 'name sku unit')
      .sort({ name: 1 });

    // 4. Filter by gender if provided
    if (gender && (gender === 'male' || gender === 'female')) {
      serviceItems = serviceItems.filter(item => {
        // The targetAudience is on the main category, which we populated
        const targetAudience = item.subCategory?.mainCategory?.targetAudience;

        console.log(targetAudience, 'targetAudience');
        
        // Return the service if its audience is 'Unisex' or matches the requested gender
        return targetAudience === 'Unisex' || targetAudience?.toLowerCase() === gender;
      });
    }
console.log(serviceItems, 'serviceItems');

    // Format the results for the frontend
    const formattedServices = serviceItems.map(item => {
      const serviceObject = item.toObject(); // Convert Mongoose document to plain object
      return {
        ...serviceObject,
        _id: item._id.toString(),
        id: item._id.toString(),
        audience: item.subCategory?.mainCategory?.targetAudience,
      };
    });

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