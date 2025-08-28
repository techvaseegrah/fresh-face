import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Expense from '@/models/Expense';
import { v2 as cloudinary } from 'cloudinary';
import { getTenantIdOrBail } from '@/lib/tenant';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const getPublicIdFromUrl = (url: string) => {
    try {
        const parts = url.split('/');
        const publicIdWithExtension = parts.slice(parts.indexOf('expense_bills')).join('/');
        return publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.'));
    } catch (e) {
        console.error("Error parsing Cloudinary URL:", e);
        return null;
    }
};

// --- PUT: Update an existing expense for a specific tenant ---
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: 'Invalid expense ID' }, { status: 400 });
  }

  try {
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) {
        return tenantId;
    }

    await dbConnect();
    
    const formData = await request.formData();
    const updateData: { [key: string]: any } = {};

    // This generic loop correctly handles the new 'category' and 'subCategory' fields
    formData.forEach((value, key) => {
        if (key !== 'billFile' && key !== '_id') {
            if (key === 'amount') updateData[key] = parseFloat(value as string);
            else if (key === 'date') updateData[key] = new Date(value as string);
            else updateData[key] = value;
        }
    });

    const file: File | null = formData.get('billFile') as File | null;
    
    const existingExpense = await Expense.findOne({ _id: id, tenantId });
    if (!existingExpense) {
      return NextResponse.json({ success: false, error: 'Expense not found' }, { status: 404 });
    }

    if (file) {
      if (existingExpense.billUrl) {
          const publicId = getPublicIdFromUrl(existingExpense.billUrl);
          if (publicId) await cloudinary.uploader.destroy(publicId);
      }
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uploadResult: any = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: "expense_bills", resource_type: "auto" }, (err, result) => {
            if (err) reject(err);
            resolve(result);
        }).end(buffer);
      });
      updateData.billUrl = uploadResult.secure_url;
    } else if (!formData.has('billUrl') && existingExpense.billUrl) {
      const publicId = getPublicIdFromUrl(existingExpense.billUrl);
      if (publicId) await cloudinary.uploader.destroy(publicId);
      updateData.billUrl = null;
    }

    const updatedExpense = await Expense.findOneAndUpdate({ _id: id, tenantId }, updateData, {
      new: true,
      runValidators: true,
    });
    
    return NextResponse.json({ success: true, data: updatedExpense });

  } catch (error) {
    console.error("PUT Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

// --- DELETE: Remove an expense for a specific tenant ---
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ success: false, error: 'Invalid expense ID' }, { status: 400 });
    }

    try {
        const tenantId = getTenantIdOrBail(request);
        if (tenantId instanceof NextResponse) {
            return tenantId;
        }

        await dbConnect();

        const expenseToDelete = await Expense.findOne({ _id: id, tenantId });
        if (!expenseToDelete) {
            return NextResponse.json({ success: false, error: 'Expense not found' }, { status: 404 });
        }

        if (expenseToDelete.billUrl) {
            const publicId = getPublicIdFromUrl(expenseToDelete.billUrl);
            if (publicId) {
                await cloudinary.uploader.destroy(publicId).catch(e => {
                    console.error("Failed to delete Cloudinary file, continuing with DB deletion:", e);
                });
            }
        }

        await Expense.deleteOne({ _id: id, tenantId });
        return NextResponse.json({ success: true, message: 'Expense deleted successfully' });

    } catch (error) {
        console.error("DELETE Error:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}