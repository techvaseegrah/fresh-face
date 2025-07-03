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
    
    const normalizedPhone = String(query).replace(/\D/g, '');

    // --- FETCH FULL DETAILS FOR SIDE PANEL ---
    if (fetchDetails) {
      const phoneHash = createSearchHash(normalizedPhone);
      const customer = await Customer.findOne({ phoneHash }); 

      if (!customer) {
        return NextResponse.json({ success: true, customer: null });
      }

      // This part remains the same as it correctly fetches details after finding the customer
      const [appointmentHistory, loyaltyData] = await Promise.all([
        Appointment.find({ customerId: customer._id }).sort({ date: -1 }).limit(20)
            .populate({ path: 'stylistId', model: Stylist, select: 'name' })
            .populate({ path: 'serviceIds', model: ServiceItem, select: 'name' }).lean(),
        LoyaltyTransaction.aggregate([
          { $match: { customerId: customer._id } },
          { $group: { _id: null, totalPoints: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }] } } } }
        ])
      ]);

      const calculatedLoyaltyPoints = loyaltyData.length > 0 ? loyaltyData[0].totalPoints : 0;
      
      const totalSpent = appointmentHistory.filter(apt => (apt as any).status === 'Paid').reduce((sum, apt) => sum + ((apt as any).finalAmount || (apt as any).amount || 0), 0);

      const customerDetails = {
        _id: customer._id.toString(), name: customer.name, email: customer.email, phoneNumber: customer.phoneNumber,
        isMember: customer.isMembership || false,
        membershipDetails: customer.isMembership ? { planName: 'Member', status: 'Active' } : null,
        gender: customer.gender || 'other', loyaltyPoints: calculatedLoyaltyPoints,
        lastVisit: appointmentHistory.length > 0 ? (appointmentHistory[0] as any).appointmentDateTime : null,
        totalSpent: totalSpent,
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
    // --- GENERAL SEARCH FOR DROPDOWN ---
    else {
      if (query.trim().length < 3) {
        return NextResponse.json({ success: true, customers: [] });
      }

      // ** THE FIX: Search by exact phone hash. A regex search on a hash is not possible. **
      const phoneHash = createSearchHash(normalizedPhone);
      const customers = await Customer.find({
        phoneHash: phoneHash,
        isActive: true
      })
      .select('name phoneNumber email isMembership gender') // Added gender
      .limit(10);
      
      // The post-find hook decrypts the fields automatically
      return NextResponse.json({ success: true, customers });
    }
  } catch (error: any) {
    console.error("API Error searching customers:", error);
    return NextResponse.json({ success: false, message: "An internal server error occurred." }, { status: 500 });
  }
}