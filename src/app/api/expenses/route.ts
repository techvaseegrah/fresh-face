// src/app/api/expenses/route.ts

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Expense from '@/models/Expense';
import { v2 as cloudinary } from 'cloudinary';

// --- CONFIGURE CLOUDINARY ---
// The SDK will automatically use the CLOUDINARY_URL environment variable
// or the individual variables (CLOUD_NAME, API_KEY, API_SECRET).
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});


// --- GET: Fetch all expenses (Unchanged) ---
export async function GET() {
  try {
    await dbConnect();
    const expenses = await Expense.find({}).sort({ date: -1 });
    return NextResponse.json({ success: true, data: expenses });
  } catch (error) {
    console.error("GET Error:", error); 
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

// --- POST: Add a new expense (Updated for Cloudinary) ---
export async function POST(request: Request) {
  try {
    await dbConnect();
    
    const formData = await request.formData();
    
    // Extract fields from formData
    const type = formData.get('type') as string;
    const description = formData.get('description') as string;
    const amount = parseFloat(formData.get('amount') as string);
    const date = new Date(formData.get('date') as string);
    const frequency = formData.get('frequency') as 'Regular' | 'Once';
    const paymentMethod = formData.get('paymentMethod') as string;
    const file: File | null = formData.get('billFile') as File | null;

    let billUrl: string | undefined = undefined;

    // --- NEW: CLOUDINARY FILE HANDLING ---
    if (file) {
      // Convert file to a buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Upload buffer to Cloudinary using a promise-wrapped stream
      const uploadResult: any = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "expense_bills", // Organize uploads in a specific folder
            resource_type: "auto"    // Automatically detect file type (image, pdf, etc.)
          },
          (error, result) => {
            if (error) {
              console.error("Cloudinary Upload Error:", error);
              return reject(error);
            }
            resolve(result);
          }
        );
        uploadStream.end(buffer);
      });
      
      // Get the secure URL from the upload result
      billUrl = uploadResult?.secure_url;

      if (!billUrl) {
        throw new Error("File upload to Cloudinary failed. No URL returned.");
      }
    }

    const expenseData = {
        type,
        description,
        amount,
        date,
        frequency,
        paymentMethod,
        billUrl // This will be the Cloudinary URL or undefined
    };

    const expense = await Expense.create(expenseData);
    
    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (error) {
    console.error("POST Error:", error); 
    
    if (error instanceof mongoose.Error.ValidationError) {
      let messages = Object.values(error.errors).map((val) => val.message);
      return NextResponse.json({ success: false, error: messages.join(', ') }, { status: 400 });
    }

    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}