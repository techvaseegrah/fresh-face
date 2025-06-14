// app/api/stylists/route.ts
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Stylist from '@/models/stylist';

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    
    const stylists = await Stylist.find({}).sort({ name: 1 });
    return NextResponse.json({ success: true, stylists });
  } catch (error: any) {
    console.error('API Error fetching stylists:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch stylists' }, { status: 500 });
  }
}