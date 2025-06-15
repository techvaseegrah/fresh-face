import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import ServiceCategory from '@/models/ServiceCategory';
import ServiceSubCategory from '@/models/ServiceSubCategory';

interface IParams { params: { id: string } }

// PUT (update) a service category
export async function PUT(req: NextRequest, { params }: IParams) {
  await dbConnect();
  try {
    const body = await req.json();
    const category = await ServiceCategory.findByIdAndUpdate(params.id, body, { new: true, runValidators: true });
    if (!category) return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: category });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

// DELETE a service category
export async function DELETE(req: NextRequest, { params }: IParams) {
  await dbConnect();
  try {
    const subCategoryCount = await ServiceSubCategory.countDocuments({ mainCategory: params.id });
    if (subCategoryCount > 0) {
      return NextResponse.json({ success: false, error: `Cannot delete. Used by ${subCategoryCount} sub-categor(y)ies.` }, { status: 400 });
    }
    const deletedCategory = await ServiceCategory.findByIdAndDelete(params.id);
    if (!deletedCategory) return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: {} });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}