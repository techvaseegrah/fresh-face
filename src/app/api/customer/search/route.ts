// app/api/customer/search/route.ts - CORRECTED

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/Appointment';
import ServiceItem from '@/models/ServiceItem';
import Stylist from '@/models/Stylist';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import mongoose from 'mongoose';
import { createSearchHash } from '@/lib/crypto';

export async function GET(req: Request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');
    const fetchDetails = searchParams.get('details') === 'true';

    if (!query) {
      return NextResponse.json({ success: false, message: 'A search query is required.' }, { status: 400 });
    }
    
    // --- FETCH FULL DETAILS FOR SIDE PANEL ---
    if (fetchDetails) {
      // This part remains the same, as it's for an exact lookup
      const normalizedPhone = String(query).replace(/\D/g, '');
      const phoneHash = createSearchHash(normalizedPhone);
      const customer = await Customer.findOne({ phoneHash }); 

      if (!customer) {
        return NextResponse.json({ success: true, customer: null });
      }
      
      const [appointmentHistory, loyaltyData] = await Promise.all([
        Appointment.find({ customerId: customer._id }).sort({ appointmentDateTime: -1 }).limit(20)
            .populate({ path: 'stylistId', model: Stylist, select: 'name' })
            .populate({ path: 'serviceIds', model: ServiceItem, select: 'name' }).lean(),
        LoyaltyTransaction.aggregate([
          { $match: { customerId: customer._id } },
          { $group: { _id: null, totalPoints: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }] } } } }
        ])
      ]);
      const calculatedLoyaltyPoints = loyaltyData.length > 0 ? loyaltyData[0].totalPoints : 0;
      const customerDetails = {
        _id: customer._id.toString(), name: customer.name, email: customer.email, phoneNumber: customer.phoneNumber,
        isMember: customer.isMembership || false,
        membershipDetails: customer.isMembership ? { planName: 'Member', status: 'Active' } : null,
        gender: customer.gender || 'other', loyaltyPoints: calculatedLoyaltyPoints,
        lastVisit: appointmentHistory.length > 0 ? (appointmentHistory[0] as any).appointmentDateTime : null,
        appointmentHistory: appointmentHistory.map(apt => ({
          _id: (apt as any)._id.toString(), date: (apt as any).appointmentDateTime,
          services: ((apt as any).serviceIds || []).map((s: any) => s.name),
          totalAmount: (apt as any).finalAmount || (apt as any).amount || 0,
          stylistName: (apt as any).stylistId?.name || 'N/A',
          status: (apt as any).status || 'Unknown'
        }))
      };
      return NextResponse.json({ success: true, customer: customerDetails });
    }
    // --- GENERAL SEARCH FOR DROPDOWN (UPGRADED) ---
    else {
      if (query.trim().length < 2) { // Changed to 2 for better usability
        return NextResponse.json({ success: true, customers: [] });
      }

      const searchStr = query.trim();
      const searchOrConditions = [];

      // 1. Search by partial name using the 'searchableName' field
      searchOrConditions.push({ searchableName: { $regex: searchStr, $options: 'i' } });

      // 2. Search by phone number (partial or full)
      const normalizedPhone = searchStr.replace(/\D/g, '');
      if (normalizedPhone) {
          // For full number, match the hash
          searchOrConditions.push({ phoneHash: createSearchHash(normalizedPhone) });
          // For partial number, match the last 4 digits
          searchOrConditions.push({ last4PhoneNumber: { $regex: normalizedPhone } });
      }
      
      // Find all customers that match ANY of the conditions
      const customers = await Customer.find({ 
        $or: searchOrConditions,
        isActive: true 
      })
      .select('name phoneNumber email isMembership gender') // Added gender
      .limit(10); // Limit results for a dropdown
      
      // The post-find hook decrypts the fields automatically
      return NextResponse.json({ success: true, customers });
    }
  } catch (error: any) {
    console.error("API Error searching customers:", error);
    return NextResponse.json({ success: false, message: "An internal server error occurred." }, { status: 500 });
  }
}