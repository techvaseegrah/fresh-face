import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';

export async function POST(request: Request) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const { 
      staffId, 
      date, 
      serviceSale = 0,
      productSale = 0,
      customerCount = 0,
      totalRating = 0,
      reviewsWithName = 0,
      reviewsWithPhoto = 0
    } = body;

    if (!staffId || !date) {
      return NextResponse.json({ message: 'Staff ID and date are required.' }, { status: 400 });
    }

    const staffExists = await Staff.findById(staffId);
    if (!staffExists) {
        return NextResponse.json({ message: 'Staff not found.' }, { status: 404 });
    }
    
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const updatedRecord = await DailySale.findOneAndUpdate(
      { 
        staff: staffId, 
        date: targetDate 
      },
      { 
        $inc: { 
          serviceSale: serviceSale, 
          productSale: productSale, 
          customerCount: customerCount,
          totalRating: totalRating,
          reviewsWithName: reviewsWithName,
          reviewsWithPhoto: reviewsWithPhoto,
          reviewCount: (reviewsWithName || 0) + (reviewsWithPhoto || 0)
        } 
      },
      { 
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    return NextResponse.json({ message: 'Daily data updated successfully', data: updatedRecord }, { status: 200 });

  } catch (error: any) {
    console.error("API POST /api/incentives Error:", error);
    if (error.name === 'ValidationError') {
        return NextResponse.json({ message: 'Validation Error', error: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'An internal server error occurred', error: error.message }, { status: 500 });
  }
}