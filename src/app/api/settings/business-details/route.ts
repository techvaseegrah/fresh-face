import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Tenant from '@/models/Tenant'; // Import your Tenant model

export async function GET(req: NextRequest) {
  try {
    // Get the full hostname (e.g., 'glamour.localhost:3000') from the request headers
    const host = req.headers.get('host');
    if (!host) {
      throw new Error('Host header is missing.');
    }

    // Extract the subdomain. This logic works for both localhost and production domains.
    // e.g., 'glamour.localhost:3000' -> 'glamour'
    // e.g., 'freshface.salonapp.com' -> 'freshface'
    const subdomain = host.split('.')[0];
    
    if (!subdomain) {
      throw new Error('Could not determine subdomain from host.');
    }

    await connectToDatabase();

    // Find the tenant by its unique subdomain instead of its ID
    const tenant = await Tenant.findOne({ subdomain: subdomain }).lean();

    if (!tenant) {
      return NextResponse.json(
        { success: false, message: `Tenant with subdomain "${subdomain}" not found.` },
        { status: 404 }
      );
    }

    // Structure the response exactly as the frontend expects
    const businessDetails = {
      name: tenant.name,
      address: tenant.address || 'No address provided', // Provide fallbacks for safety
      phone: tenant.phone || 'No phone provided',
      gstin: tenant.gstin || '',
    };

    return NextResponse.json({
      success: true,
      details: businessDetails,
    });

  } catch (error: any) {
    console.error("Failed to fetch business details:", error);
    return NextResponse.json(
      { success: false, message: error.message || 'An internal server error occurred' },
      { status: 500 }
    );
  }
}