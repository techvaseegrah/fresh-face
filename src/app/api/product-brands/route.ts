import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Brand from '@/models/ProductBrand';

export async function GET(req: NextRequest) {
  await dbConnect();
  const type = req.nextUrl.searchParams.get('type');
  if (!type) return NextResponse.json({ success: false, error: 'Product type is required' }, { status: 400 });
  try {
    const brands = await Brand.find({ type }).sort({ name: 1 });
    return NextResponse.json({ success: true, data: brands });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await dbConnect();
  try {
    const body = await req.json();
    const brand = await Brand.create(body);
    return NextResponse.json({ success: true, data: brand }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}