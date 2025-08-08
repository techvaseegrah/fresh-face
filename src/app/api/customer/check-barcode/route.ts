// app/api/customer/check-barcode/route.ts

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import { getTenantIdOrBail } from '@/lib/tenant'; // 1. Import the tenant helper

export async function GET(req: Request) {
  // 2. Get the Tenant ID from the request or fail
  const tenantId = getTenantIdOrBail(req as any);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(req.url);
    const barcode = searchParams.get('barcode');
    
    if (!barcode) {
      return NextResponse.json({
        success: false,
        message: 'Barcode is required'
      }, { status: 400 });
    }
    
    // 3. Perform the query directly, scoped by tenantId
    // This checks for the barcode's existence ONLY within the current tenant.
    const customer = await Customer.findOne({ 
        membershipBarcode: barcode, 
        tenantId: tenantId 
    }).lean();
    
    return NextResponse.json({
      success: true,
      exists: !!customer // Convert the found document (or null) to a boolean
    });
    
  } catch (error) {
    console.error('Error checking barcode:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to check barcode availability'
    }, { status: 500 });
  }
}