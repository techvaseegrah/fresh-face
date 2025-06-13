import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/appointment';
import Service from '@/models/service';
import Stylist from '@/models/stylist';
import CustomerMembership from '@/models/customerMembership';
import MembershipPlan from '@/models/membershipPlan';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import mongoose from 'mongoose';

// ===================================================================================
//  TYPE DEFINITIONS
// ===================================================================================
interface LeanCustomer {
  _id: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  phoneNumber: string;
}

// ===================================================================================
//  API ENDPOINT
// ===================================================================================
export async function GET(req: Request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');
    const fetchDetails = searchParams.get('details') === 'true';

    if (!query) {
      return NextResponse.json({ success: false, message: 'A search query is required.' }, { status: 400 });
    }

    // --- BRANCH 1: Fetch Full Details for the Side Panel ---
    if (fetchDetails) {
      const customer = await Customer.findOne({ phoneNumber: query.trim() }).lean<LeanCustomer>();
      if (!customer) {
        return NextResponse.json({ success: true, customer: null });
      }

      // --- Fetch all related customer data in parallel for performance ---
      const [activeMembership, appointmentHistory, loyaltyData] = await Promise.all([
        // Query 1: Find the customer's active membership plan
        CustomerMembership.findOne({
          customerId: customer._id,
          status: 'Active',
          endDate: { $gte: new Date() } // Ensure membership is not expired
        }).populate({
            path: 'membershipPlanId',
            model: MembershipPlan,
            select: 'name status'
        }),

        // Query 2: Find the 10 most recent paid appointments
        Appointment.find({ customerId: customer._id, status: 'Paid' })
          .sort({ date: -1 })
          .limit(10)
          .populate({ path: 'stylistId', model: Stylist, select: 'name' })
          .populate({ path: 'serviceIds', model: Service, select: 'name' })
          .lean(),
          
        // Query 3: Calculate the total loyalty points from the transaction log
        LoyaltyTransaction.aggregate([
          { $match: { customerId: customer._id } },
          {
            $group: {
              _id: null, // Group all transactions for the customer into one result
              totalPoints: {
                $sum: {
                  // Add points for 'Credit', subtract points for 'Debit'
                  $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }]
                }
              }
            }
          }
        ])
      ]);

      // Extract the calculated points from the aggregation result
      const calculatedLoyaltyPoints = loyaltyData.length > 0 ? loyaltyData[0].totalPoints : 0;

      // --- Construct the final, detailed customer object for the frontend ---
      const customerDetails = {
        ...customer,
        isMember: !!activeMembership,
        membershipDetails: activeMembership ? { 
          planName: (activeMembership.membershipPlanId as any)?.name || 'Unknown Plan',
          status: (activeMembership as any).status 
        } : null,
        loyaltyPoints: calculatedLoyaltyPoints,
        lastVisit: appointmentHistory.length > 0 ? (appointmentHistory[0] as any).date : null,
        appointmentHistory: appointmentHistory.map(apt => ({
          _id: (apt as any)._id.toString(),
          date: (apt as any).date,
          services: ((apt as any).serviceIds || []).map((s: any) => s.name),
          totalAmount: (apt as any).amount || 0,
          stylistName: (apt as any).stylistId?.name || 'N/A',
        }))
      };

      return NextResponse.json({ success: true, customer: customerDetails });

    } 
    // --- BRANCH 2: General Live Search for the Dropdown ---
    else {
      if (query.trim().length < 2) {
        return NextResponse.json({ success: true, customers: [] });
      }
      const searchRegex = new RegExp(query, 'i');
      const customers = await Customer.find({
        $or: [{ name: { $regex: searchRegex } }, { phoneNumber: { $regex: searchRegex } }]
      }).select('name phoneNumber email').limit(10).lean();
      
      return NextResponse.json({ success: true, customers });
    }
  } catch (error: any) {
    console.error("API Error searching customers:", error);
    return NextResponse.json({ success: false, message: "An internal server error occurred." }, { status: 500 });
  }
}