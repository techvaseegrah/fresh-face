// src/app/api/expenses/route.ts

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Expense from '@/models/Expense';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import fs from 'fs';

// --- GET: Fetch all expenses ---
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

// --- POST: Add a new expense ---
export async function POST(request: Request) {
  try {
    await dbConnect();
    
    // Use formData to handle file uploads
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

    // --- FILE HANDLING ---
    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Create a unique filename to prevent overwrites
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const originalFilename = file.name.replace(/\s+/g, '_'); // Sanitize
      const filename = `${uniqueSuffix}-${originalFilename}`;

      const uploadDir = join(process.cwd(), 'public', 'uploads');
      
      // Ensure the upload directory exists
      if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
      }

      const path = join(uploadDir, filename);
      await writeFile(path, buffer);
      
      billUrl = `/uploads/${filename}`; // Publicly accessible URL
    }

    const expenseData = {
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