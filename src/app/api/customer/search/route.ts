<<<<<<< HEAD
// /app/api/customer/search/route.ts - MULTI-TENANT VERSION
=======
// /app/api/customer/search/route.ts - FINAL CORRECTED VERSION
>>>>>>> df642c83af3692f0da766243fb53ac637920f256

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/Appointment';
import ServiceItem from '@/models/ServiceItem';
<<<<<<< HEAD
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

=======
// --- FIX: IMPORT THE CORRECT STAFF MODEL ---
import Staff from '@/models/staff'; // You might need to adjust the path, e.g., '@/models/staffmodel'
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import { createBlindIndex } from '@/lib/search-indexing';

export async function GET(req: Request) {
>>>>>>> df642c83af3692f0da766243fb53ac637920f256
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');
    const fetchDetails = searchParams.get('details') === 'true';

    if (!query) {
      return NextResponse.json({ success: false, message: 'A search query is required.' }, { status: 400 });
    }
    
<<<<<<< HEAD
    // --- FETCH FULL DETAILS (MULTI-TENANT) ---
=======
    // --- FETCH FULL DETAILS FOR SIDE PANEL (CORRECTED) ---
>>>>>>> df642c83af3692f0da766243fb53ac637920f256
    if (fetchDetails) {
      const normalizedPhone = String(query).replace(/\D/g, '');
      const phoneHash = createBlindIndex(normalizedPhone); 
      
<<<<<<< HEAD
      // 3. Scope the customer find to the current tenant
      const customer = await Customer.findOne({ phoneHash, tenantId }); 
=======
      const customer = await Customer.findOne({ phoneHash }); 
>>>>>>> df642c83af3692f0da766243fb53ac637920f256

      if (!customer) {
        return NextResponse.json({ success: true, customer: null });
      }
      
<<<<<<< HEAD
      // 4. Scope all related data lookups to the same tenant
      const [appointmentHistory, loyaltyData] = await Promise.all([
        Appointment.find({ customerId: customer._id, tenantId })
            .sort({ appointmentDateTime: -1 })
            .limit(20)
=======
      const [appointmentHistory, loyaltyData] = await Promise.all([
        Appointment.find({ customerId: customer._id })
            .sort({ appointmentDateTime: -1 })
            .limit(20)
            // --- THE FIX IS HERE: Use the 'Staff' model for population ---
>>>>>>> df642c83af3692f0da766243fb53ac637920f256
            .populate({ path: 'stylistId', model: Staff, select: 'name' }) 
            .populate({ path: 'serviceIds', model: ServiceItem, select: 'name' })
            .lean(),
        LoyaltyTransaction.aggregate([
<<<<<<< HEAD
          { $match: { customerId: customer._id, tenantId: new mongoose.Types.ObjectId(tenantId) } },
=======
          { $match: { customerId: customer._id } },
>>>>>>> df642c83af3692f0da766243fb53ac637920f256
          { $group: { _id: null, totalPoints: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }] } } } }
        ])
      ]);
      const calculatedLoyaltyPoints = loyaltyData.length > 0 ? loyaltyData[0].totalPoints : 0;
      
<<<<<<< HEAD
      const customerDetails = {
        _id: customer._id.toString(),
        name: decrypt(customer.name), // Decrypting fields for the response
        email: customer.email ? decrypt(customer.email) : undefined,
        phoneNumber: decrypt(customer.phoneNumber),
        isMember: customer.isMembership || false,
        membershipBarcode: customer.membershipBarcode,
=======
      // The rest of the code is now correct because .populate() will return the staff object
      const customerDetails = {
        _id: customer._id.toString(),
        name: customer.name, // Assuming your Customer model hook decrypts this
        email: customer.email,
        phoneNumber: customer.phoneNumber,
        isMember: customer.isMembership || false,
>>>>>>> df642c83af3692f0da766243fb53ac637920f256
        membershipDetails: customer.isMembership ? { planName: 'Member', status: 'Active' } : null,
        gender: customer.gender || 'other',
        loyaltyPoints: calculatedLoyaltyPoints,
        lastVisit: appointmentHistory.length > 0 ? (appointmentHistory[0] as any).appointmentDateTime : null,
        appointmentHistory: appointmentHistory.map(apt => ({
          _id: (apt as any)._id.toString(),
          date: (apt as any).appointmentDateTime,
          services: ((apt as any).serviceIds || []).map((s: any) => s.name),
          totalAmount: (apt as any).finalAmount || (apt as any).amount || 0,
<<<<<<< HEAD
=======
          // This will now correctly find the 'name' property on the populated Staff object
>>>>>>> df642c83af3692f0da766243fb53ac637920f256
          stylistName: (apt as any).stylistId?.name || 'N/A', 
          status: (apt as any).status || 'Unknown'
        }))
      };
      return NextResponse.json({ success: true, customer: customerDetails });
    }
<<<<<<< HEAD
    // --- GENERAL SEARCH FOR DROPDOWN (MULTI-TENANT) ---
=======
    // --- GENERAL SEARCH FOR DROPDOWN (This part is already correct) ---
>>>>>>> df642c83af3692f0da766243fb53ac637920f256
    else {
      if (query.trim().length < 2) {
        return NextResponse.json({ success: true, customers: [] });
      }

      const searchStr = query.trim();
<<<<<<< HEAD
      // 5. Add tenantId to the base find conditions
      let findConditions: any = { isActive: true, tenantId };
=======
      let findConditions: any = { isActive: true };
>>>>>>> df642c83af3692f0da766243fb53ac637920f256
      const isNumeric = /^\d+$/.test(searchStr);

      if (isNumeric) {
        const searchHash = createBlindIndex(searchStr);
        findConditions.phoneSearchIndex = searchHash;
      } else {
        findConditions.searchableName = { $regex: searchStr, $options: 'i' };
      }
      
<<<<<<< HEAD
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
      
=======
      const customers = await Customer.find(findConditions)
        .select('name phoneNumber email isMembership gender')
        .limit(10);
      
>>>>>>> df642c83af3692f0da766243fb53ac637920f256
      return NextResponse.json({ success: true, customers });
    }
  } catch (error: any) {
    console.error("API Error searching customers:", error);
    return NextResponse.json({ success: false, message: "An internal server error occurred." }, { status: 500 });
  }
}