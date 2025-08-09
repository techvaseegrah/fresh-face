import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Expense from '@/models/Expense';
import { v2 as cloudinary } from 'cloudinary';
import { getTenantIdOrBail } from '@/lib/tenant'; // <-- NEW: Import tenant helper

// Cloudinary config remains the same
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// --- GET: Fetch all expenses for a specific tenant ---
export async function GET(request: NextRequest) { // <-- NEW: Use NextRequest
  try {
    // --- NEW: Securely get tenantId or exit ---
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) {
        return tenantId; // Return error response if tenantId is missing
    }

    await dbConnect();

    // --- UPDATED: Filter expenses by tenantId ---
    const expenses = await Expense.find({ tenantId }).sort({ date: -1 });
    
    return NextResponse.json({ success: true, data: expenses });
  } catch (error) {
    console.error("GET Error:", error); 
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

// --- POST: Add a new expense for a specific tenant ---
export async function POST(request: NextRequest) { // <-- NEW: Use NextRequest
  try {
    // --- NEW: Securely get tenantId or exit ---
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) {
        return tenantId; // Return error response if tenantId is missing
    }
    
    await dbConnect();
    
    const formData = await request.formData();
    
    // ... (formData extraction remains the same)
    const type = formData.get('type') as string;
    const description = formData.get('description') as string;
    const amount = parseFloat(formData.get('amount') as string);
    const date = new Date(formData.get('date') as string);
    const frequency = formData.get('frequency') as 'Regular' | 'Once';
    const paymentMethod = formData.get('paymentMethod') as string;
    const file: File | null = formData.get('billFile') as File | null;

    let billUrl: string | undefined = undefined;

    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uploadResult: any = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "expense_bills", resource_type: "auto" },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(buffer);
      });
      billUrl = uploadResult?.secure_url;
      if (!billUrl) {
        throw new Error("File upload to Cloudinary failed. No URL returned.");
      }
    }

    // --- UPDATED: Add tenantId to the expense data ---
    const expenseData = {
        tenantId, // <-- NEW
        type,
        description,
        amount,
        date,
        frequency,
        paymentMethod,
        billUrl
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