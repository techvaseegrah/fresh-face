// app/api/services/route.ts

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Service from '@/models/service'; // Make sure this path is correct

export async function GET(req: Request) {
  try {
    await connectToDatabase();

    // Find all services that are marked as active
    const services = await Service.find({ isActive: true }).sort({ name: 1 });

    return NextResponse.json({ success: true, services });

  } catch (error: any) {
    console.error("API Error fetching services:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}