// src/app/api/admin/tenants/route.ts

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Tenant from '@/models/Tenant';
// Note: You would add session/permission checks here to secure this endpoint
// For now, we are just creating the functionality.

export async function GET() {
  try {
    await connectToDatabase();

    // Find all tenants and sort them by creation date
    const tenants = await Tenant.find({}).sort({ createdAt: 'desc' }).lean();

    return NextResponse.json(tenants);

  } catch (error: any) {
    console.error('Failed to fetch tenants:', error);
    return new NextResponse(
      JSON.stringify({ message: 'Failed to fetch tenants' }),
      { status: 500 }
    );
  }
}