// /src/app/api/target/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
// FIX: Import the model AND the new plain data interface
import TargetData, { TargetSheetData } from '@/models/TargetSheet'; 
import type { SummaryMetrics } from '@/app/api/types/target'; 

// GET Handler: Fetches the latest data from MongoDB
export async function GET(request: Request) {
  try {
    await dbConnect();

    const targetData = await TargetData.findOne().sort({ createdAt: -1 }).lean();

    if (targetData) {
      return NextResponse.json(targetData);
    }

    // FIX: Use the imported 'TargetSheetData' type for our default object.
    // This type perfectly matches the object's shape and has no Mongoose methods.
    const defaultData: TargetSheetData = {
      summary: {
        target: { service: 400000, retail: 20000, netSales: 420000, bills: 500, abv: 840, callbacks: 180, appointmentsFromCallbacks: 20 },
        achieved: { service: 0, retail: 0, netSales: 0, bills: 0, abv: 0, callbacks: 0, appointmentsFromCallbacks: 0 },
        headingTo: { service: 0, retail: 0, netSales: 0, bills: 0, abv: 0, callbacks: 0, appointmentsFromCallbacks: 0, serviceInPercentage: 0, retailInPercentage: 0, netSalesInPercentage: 0, billsInPercentage: 0, abvInPercentage: 0, callbacksInPercentage: 0, appointmentsInPercentage: 0 }
      },
      dailyRecords: []
    };
    
    // Mongoose's .create() method is happy to accept a plain object that matches the schema.
    const newDocument = await TargetData.create(defaultData);
    
    // Return the newly created document as a plain object for the client.
    return NextResponse.json(newDocument.toObject());
    
  } catch (error) {
    console.error("GET Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// PUT Handler: Updates the 'target' data in MongoDB
export async function PUT(request: Request) {
  try {
    await dbConnect();
    const newMonthlyTargets: Partial<SummaryMetrics> = await request.json();
    
    const currentData = await TargetData.findOne().sort({ createdAt: -1 }).lean();

    if (!currentData) {
        return NextResponse.json({ message: "No data found to update." }, { status: 404 });
    }

    const updatedTarget = {
        ...currentData.summary.target,
        ...newMonthlyTargets,
    };
    
    updatedTarget.netSales = (updatedTarget.service || 0) + (updatedTarget.retail || 0);

    await TargetData.updateOne(
        { _id: currentData._id }, 
        { $set: { "summary.target": updatedTarget } }
    );

    console.log("Updated monthly targets in DB:", updatedTarget);

    return NextResponse.json({ message: "Monthly targets updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("PUT Error:", error);
    return NextResponse.json({ message: "Failed to update monthly targets" }, { status: 400 });
  }
}