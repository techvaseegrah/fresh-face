// app/api/customer/search/route.ts - UPDATED VERSION
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/Appointment';
import ServiceItem from '@/models/ServiceItem';
import Stylist from '@/models/Stylist';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import mongoose from 'mongoose';

interface LeanCustomer {
  _id: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  phoneNumber: string;
  isMembership?: boolean;
  loyaltyPoints?: number;
}

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
      const customer = await Customer.findOne({ phoneNumber: query.trim() }).lean<LeanCustomer>();
      if (!customer) {
        return NextResponse.json({ success: true, customer: null });
      }

      const [appointmentHistory, loyaltyData] = await Promise.all([
        // Get ALL appointments for history display
        Appointment.find({ customerId: customer._id })
          .sort({ date: -1 })
          .limit(20)
          .populate({ path: 'stylistId', model: Stylist, select: 'name' })
          .populate({ path: 'serviceIds', model: ServiceItem, select: 'name' })
          .lean(),

        LoyaltyTransaction.aggregate([
          { $match: { customerId: customer._id } },
          {
            $group: {
              _id: null,
              totalPoints: {
                $sum: {
                  $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }]
                }
              }
            }
          }
        ])
      ]);

      const calculatedLoyaltyPoints = loyaltyData.length > 0 ? loyaltyData[0].totalPoints : 0;

      // Calculate total spent ONLY from paid appointments
      const totalSpent = appointmentHistory
        .filter(apt => (apt as any).status === 'Paid')
        .reduce((sum, apt) => sum + ((apt as any).finalAmount || (apt as any).amount || 0), 0);

      const customerDetails = {
        ...customer,
        _id: customer._id.toString(),
        isMember: customer.isMembership || false,
        membershipDetails: customer.isMembership ? {
          planName: 'Member',
          status: 'Active'
        } : null,
        loyaltyPoints: calculatedLoyaltyPoints,
        lastVisit: appointmentHistory.length > 0 ? (appointmentHistory[0] as any).date : null,
        totalSpent: totalSpent, // Add total spent field
        appointmentHistory: appointmentHistory.map(apt => ({
          _id: (apt as any)._id.toString(),
          date: (apt as any).date,
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
      if (query.trim().length < 2) {
        return NextResponse.json({ success: true, customers: [] });
      }
      const searchRegex = new RegExp(query, 'i');
      const customers = await Customer.find({
        $or: [{ name: { $regex: searchRegex } }, { phoneNumber: { $regex: searchRegex } }],
        isActive: true
      }).select('name phoneNumber email isMembership').limit(10).lean();

      return NextResponse.json({ success: true, customers });
    }
  } catch (error: any) {
    console.error("API Error searching customers:", error);
    return NextResponse.json({ success: false, message: "An internal server error occurred." }, { status: 500 });
  }
}