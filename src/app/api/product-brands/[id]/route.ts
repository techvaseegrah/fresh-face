import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Brand from '@/models/ProductBrand';
import SubCategory from '@/models/ProductSubCategory';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  await dbConnect();
  try {
    const body = await req.json();
    const brand = await Brand.findByIdAndUpdate(params.id, body, { new: true, runValidators: true });
    if (!brand) return NextResponse.json({ success: false, error: 'Brand not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: brand });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await dbConnect();
  try {
    const subCategoryCount = await SubCategory.countDocuments({ brand: params.id });
    if (subCategoryCount > 0) {
      return NextResponse.json({ success: false, error: 'Cannot delete brand. It has associated sub-categories.' }, { status: 400 });
    }
    const deletedBrand = await Brand.findByIdAndDelete(params.id);
    if (!deletedBrand) return NextResponse.json({ success: false, error: 'Brand not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: {} });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}