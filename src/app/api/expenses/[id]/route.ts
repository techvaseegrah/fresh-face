// src/app/api/expenses/[id]/route.ts

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Expense, { IExpense } from '@/models/Expense';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Helper to extract Cloudinary public_id from URL
const getPublicIdFromUrl = (url: string) => {
    try {
        const parts = url.split('/');
        const publicIdWithExtension = parts.slice(parts.indexOf('expense_bills')).join('/');
        const publicId = publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.'));
        return publicId;
    } catch (e) {
        console.error("Error parsing Cloudinary URL:", e);
        return null;
    }
};

// --- PUT: Update an existing expense ---
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: 'Invalid expense ID' }, { status: 400 });
  }

  try {
    await dbConnect();
    
    const formData = await request.formData();
    const updateData: { [key: string]: any } = {};

    formData.forEach((value, key) => {
        if (key !== 'billFile' && key !== '_id') {
            if (key === 'amount') updateData[key] = parseFloat(value as string);
            else if (key === 'date') updateData[key] = new Date(value as string);
            else updateData[key] = value;
        }
    });

    const file: File | null = formData.get('billFile') as File | null;
    const existingExpense = await Expense.findById(id);
    if (!existingExpense) {
      return NextResponse.json({ success: false, error: 'Expense not found' }, { status: 404 });
    }

    // --- File Handling Logic ---
    if (file) { // Case 1: New file is uploaded
      // Delete old file from Cloudinary if it exists
      if (existingExpense.billUrl) {
          const publicId = getPublicIdFromUrl(existingExpense.billUrl);
          if (publicId) await cloudinary.uploader.destroy(publicId);
      }
      // Upload new file
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
      // Case 2: Bill was removed (no new file, and no existing billUrl sent back)
      const publicId = getPublicIdFromUrl(existingExpense.billUrl);
      if (publicId) await cloudinary.uploader.destroy(publicId);
      updateData.billUrl = null;
    }
    // Case 3 (no code needed): Bill is unchanged. 'billUrl' is present in formData and will be set in updateData.

    const updatedExpense = await Expense.findByIdAndUpdate(id, updateData, {
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

// --- DELETE: Remove an expense ---
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ success: false, error: 'Invalid expense ID' }, { status: 400 });
    }

    try {
        await dbConnect();
        const expenseToDelete = await Expense.findById(id);
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

        await Expense.deleteOne({ _id: id });
        return NextResponse.json({ success: true, message: 'Expense deleted successfully' });

    } catch (error) {
        console.error("DELETE Error:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}