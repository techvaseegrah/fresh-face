// /app/api/customer/search-by-barcode/route.ts - MULTI-TENANT VERSION

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/Appointment';
import ServiceItem from '@/models/ServiceItem';
import Staff from '@/models/staff'; // Corrected from Stylist for consistency
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import mongoose from 'mongoose';
import { getTenantIdOrBail } from '@/lib/tenant'; // 1. Import tenant helper
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { decrypt } from '@/lib/crypto'; // Import decrypt function

export async function GET(req: Request) {
  // 2. Add Permission and Tenant checks
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_READ)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

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
    
    // 3. Scope the main customer find to the current tenant
    const customer = await Customer.findOne({ 
        membershipBarcode: barcode, 
        isActive: true,
        tenantId // <-- CRITICAL: Tenant scope added
    });
    
    if (!customer) {
      return NextResponse.json({
        success: false,
        message: 'No active customer found with this barcode for this tenant'
      }, { status: 404 });
    }
    
    // 4. Scope all related data lookups to the same tenant
    const [appointmentHistory, loyaltyData] = await Promise.all([
      Appointment.find({ customerId: customer._id, tenantId }) // <-- Tenant scope added
        .sort({ appointmentDateTime: -1 })
        .limit(20)
        .populate({ path: 'stylistId', model: Staff, select: 'name' })
        .populate({ path: 'serviceIds', model: ServiceItem, select: 'name' })
        .lean(),
      LoyaltyTransaction.aggregate([
        { $match: { customerId: customer._id, tenantId: new mongoose.Types.ObjectId(tenantId) } }, // <-- Tenant scope added
        { $group: { _id: null, totalPoints: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }] } } } }
      ])
    ]);

    const calculatedLoyaltyPoints = loyaltyData.length > 0 ? loyaltyData[0].totalPoints : 0;
    
    const totalSpent = appointmentHistory
      .filter(apt => (apt as any).status === 'Paid')
      .reduce((sum, apt) => sum + ((apt as any).finalAmount || (apt as any).amount || 0), 0);

    // 5. Decrypt sensitive customer data before sending
    const customerDetails = {
      _id: customer._id.toString(),
      name: decrypt(customer.name),
      email: customer.email ? decrypt(customer.email) : undefined,
      phoneNumber: decrypt(customer.phoneNumber),
      isMember: customer.isMembership || false,
      membershipDetails: customer.isMembership ? { planName: 'Member', status: 'Active' } : null,
      membershipBarcode: customer.membershipBarcode,
      gender: customer.gender || 'other',
      loyaltyPoints: calculatedLoyaltyPoints,
      lastVisit: appointmentHistory.length > 0 ? (appointmentHistory[0] as any).appointmentDateTime : null,
      totalSpent: totalSpent,
      appointmentHistory: appointmentHistory.map(apt => ({
        _id: (apt as any)._id.toString(),
        date: (apt as any).appointmentDateTime,
        services: ((apt as any).serviceIds || []).map((s: any) => s.name),
        totalAmount: (apt as any).finalAmount || (apt as any).amount || 0,
        stylistName: (apt as any).stylistId?.name || 'N/A',
        status: (apt as any).status || 'Unknown'
      }))
    };
    
    return NextResponse.json({
      success: true,
      customer: customerDetails
    });
    
  } catch (error) {
    console.error('Error searching customer by barcode:', error);
    return NextResponse.json({
      success: false,
      message: 'An internal server error occurred.'
    }, { status: 500 });
  }
}