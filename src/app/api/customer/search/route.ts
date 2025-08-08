// /app/api/customer/search/route.ts - MULTI-TENANT VERSION

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/Appointment';
import ServiceItem from '@/models/ServiceItem';
import Staff from '@/models/staff';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import { createBlindIndex } from '@/lib/search-indexing';
import { getTenantIdOrBail } from '@/lib/tenant'; // 1. Import the tenant helper
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import mongoose from 'mongoose';
import { decrypt } from '@/lib/crypto'; // Import decrypt

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
    const query = searchParams.get('query');
    const fetchDetails = searchParams.get('details') === 'true';

    if (!query) {
      return NextResponse.json({ success: false, message: 'A search query is required.' }, { status: 400 });
    }
    
    // --- FETCH FULL DETAILS (MULTI-TENANT) ---
    if (fetchDetails) {
      const normalizedPhone = String(query).replace(/\D/g, '');
      const phoneHash = createBlindIndex(normalizedPhone); 
      
      // 3. Scope the customer find to the current tenant
      const customer = await Customer.findOne({ phoneHash, tenantId }); 

      if (!customer) {
        return NextResponse.json({ success: true, customer: null });
      }
      
      // 4. Scope all related data lookups to the same tenant
      const [appointmentHistory, loyaltyData] = await Promise.all([
        Appointment.find({ customerId: customer._id, tenantId })
            .sort({ appointmentDateTime: -1 })
            .limit(20)
            .populate({ path: 'stylistId', model: Staff, select: 'name' }) 
            .populate({ path: 'serviceIds', model: ServiceItem, select: 'name' })
            .lean(),
        LoyaltyTransaction.aggregate([
          { $match: { customerId: customer._id, tenantId: new mongoose.Types.ObjectId(tenantId) } },
          { $group: { _id: null, totalPoints: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }] } } } }
        ])
      ]);
      const calculatedLoyaltyPoints = loyaltyData.length > 0 ? loyaltyData[0].totalPoints : 0;
      
      const customerDetails = {
        _id: customer._id.toString(),
        name: decrypt(customer.name), // Decrypting fields for the response
        email: customer.email ? decrypt(customer.email) : undefined,
        phoneNumber: decrypt(customer.phoneNumber),
        isMember: customer.isMembership || false,
        membershipBarcode: customer.membershipBarcode,
        membershipDetails: customer.isMembership ? { planName: 'Member', status: 'Active' } : null,
        gender: customer.gender || 'other',
        loyaltyPoints: calculatedLoyaltyPoints,
        lastVisit: appointmentHistory.length > 0 ? (appointmentHistory[0] as any).appointmentDateTime : null,
        appointmentHistory: appointmentHistory.map(apt => ({
          _id: (apt as any)._id.toString(),
          date: (apt as any).appointmentDateTime,
          services: ((apt as any).serviceIds || []).map((s: any) => s.name),
          totalAmount: (apt as any).finalAmount || (apt as any).amount || 0,
          stylistName: (apt as any).stylistId?.name || 'N/A', 
          status: (apt as any).status || 'Unknown'
        }))
      };
      return NextResponse.json({ success: true, customer: customerDetails });
    }
    // --- GENERAL SEARCH FOR DROPDOWN (MULTI-TENANT) ---
    else {
      if (query.trim().length < 2) {
        return NextResponse.json({ success: true, customers: [] });
      }

      const searchStr = query.trim();
      // 5. Add tenantId to the base find conditions
      let findConditions: any = { isActive: true, tenantId };
      const isNumeric = /^\d+$/.test(searchStr);

      if (isNumeric) {
        const searchHash = createBlindIndex(searchStr);
        findConditions.phoneSearchIndex = searchHash;
      } else {
        findConditions.searchableName = { $regex: searchStr, $options: 'i' };
      }
      
      const customersFromDb = await Customer.find(findConditions)
        .select('name phoneNumber email isMembership gender')
        .limit(10);
      
      // Decrypt the fields before sending to the client
      const customers = customersFromDb.map(customer => ({
          ...customer.toObject(),
          _id: customer._id.toString(),
          name: decrypt(customer.name),
          phoneNumber: decrypt(customer.phoneNumber),
          email: customer.email ? decrypt(customer.email) : undefined,
      }));
      
      return NextResponse.json({ success: true, customers });
    }
  } catch (error: any) {
    console.error("API Error searching customers:", error);
    return NextResponse.json({ success: false, message: "An internal server error occurred." }, { status: 500 });
  }
}