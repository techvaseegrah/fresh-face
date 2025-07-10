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
      date, // This `date` comes in as a string, e.g., "2025-07-09"
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
    
    // ====================================================================
    // THE FIX IS HERE: Parse the date string manually to avoid timezone issues.
    // ====================================================================
    // OLD, BUGGY CODE:
    // const targetDate = new Date(date);
    // targetDate.setHours(0, 0, 0, 0);

    // NEW, CORRECTED CODE:
    const [year, month, day] = date.split('-').map(Number);
    // We create a UTC date to ensure it's timezone-agnostic. 
    // MongoDB stores dates in UTC, so this is the most reliable way.
    // The `month - 1` is important because months are 0-indexed in JavaScript (0=Jan, 1=Feb, etc.)
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    
    // The rest of your logic remains the same
    const updatedRecord = await DailySale.findOneAndUpdate(
      { 
        staff: staffId, 
        date: targetDate // Use the correctly parsed UTC date
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