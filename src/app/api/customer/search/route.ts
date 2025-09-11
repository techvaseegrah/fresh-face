// /app/api/customer/search/route.ts - MULTI-TENANT & INVOICE-AWARE VERSION

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/Appointment';
import ServiceItem from '@/models/ServiceItem';
import Staff from '@/models/staff';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import Invoice from '@/models/invoice'; // ✨ 1. IMPORT INVOICE MODEL
import { createBlindIndex } from '@/lib/search-indexing';
import { getTenantIdOrBail } from '@/lib/tenant';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import mongoose from 'mongoose';
import { decrypt } from '@/lib/crypto';

export async function GET(req: Request) {
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
    
    // --- FETCH FULL DETAILS ---
    if (fetchDetails) {
      const normalizedPhone = String(query).replace(/\D/g, '');
      const phoneHash = createBlindIndex(normalizedPhone); 
      
      const customer = await Customer.findOne({ phoneHash, tenantId }).lean(); 

      if (!customer) {
        return NextResponse.json({ success: true, customer: null });
      }
      
      const [appointments, loyaltyData] = await Promise.all([
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
      
      // ✨ 2. MODIFIED aappointmentHistory MAPPING
      const appointmentHistory = await Promise.all(
        appointments.map(async (apt: any) => {
          // Find the invoice linked to this appointment
          const invoice = await Invoice.findOne({ appointmentId: apt._id, tenantId }).select('invoiceNumber paymentDetails').lean();

          // Helper to get payment mode
          const getPaymentMode = (details: any) => {
            if (!details) return 'N/A';
            const modes = [];
            if (details.cash > 0) modes.push('Cash');
            if (details.card > 0) modes.push('Card');
            if (details.upi > 0) modes.push('UPI');
            if (details.other > 0) modes.push('Other');
            return modes.length > 0 ? modes.join(', ') : 'Pending';
          };

          return {
            _id: apt._id.toString(),
            date: apt.appointmentDateTime,
            services: (apt.serviceIds || []).map((s: any) => s.name),
            totalAmount: apt.finalAmount || apt.amount || 0,
            stylistName: apt.stylistId?.name || 'N/A', 
            status: apt.status || 'Unknown',
            // ✨ 3. ADD INVOICE DETAILS
            invoiceNumber: invoice?.invoiceNumber ?? 'N/A',
            paymentMode: getPaymentMode(invoice?.paymentDetails),
          };
        })
      );

      const customerDetails = {
        _id: customer._id.toString(),
        name: decrypt(customer.name),
        email: customer.email ? decrypt(customer.email) : undefined,
        phoneNumber: decrypt(customer.phoneNumber),
        isMember: customer.isMembership || false,
        membershipBarcode: customer.membershipBarcode,
        membershipDetails: customer.isMembership ? { planName: 'Member', status: 'Active' } : null,
        gender: customer.gender || 'other',
        loyaltyPoints: calculatedLoyaltyPoints,
        lastVisit: appointments.length > 0 ? (appointments[0] as any).appointmentDateTime : null,
        appointmentHistory: appointmentHistory // Use the newly formatted history
      };

      return NextResponse.json({ success: true, customer: customerDetails });
    }
    // --- GENERAL SEARCH FOR DROPDOWN ---
    else {
      if (query.trim().length < 2) {
        return NextResponse.json({ success: true, customers: [] });
      }

      const searchStr = query.trim();
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
        .limit(10)
        .lean(); // Use .lean() for performance when you don't need mongoose methods
      
      const customers = customersFromDb.map(customer => ({
          ...customer,
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