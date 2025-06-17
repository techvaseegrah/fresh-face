// /src/app/api/billing/route.ts

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Invoice from '@/models/invoice';
import Appointment from '@/models/appointment';
import Stylist from '@/models/stylist';
import Customer from '@/models/customermodel';
import CustomerMembership from '@/models/customerMembership';
import MembershipPlan from '@/models/membershipPlan';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import Product from '@/models/product';
import Staff from '@/models/staff'; 
import mongoose from 'mongoose';
// ======================= NEW CODE: IMPORT TARGET MODEL =======================
import TargetData from '@/models/TargetSheet'; 
// ===========================================================================

// ===================================================================================
//  INTERFACES (keep as is)
// ===================================================================================
interface BillItemPayload {
  itemType: 'service' | 'product' | 'membership';
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  finalPrice: number;
}
interface BillingRequestBody {
  customerId: string;
  appointmentId: string;
  items: BillItemPayload[];
  paymentMethod: string;
  notes?: string;
  grandTotal: number;
  purchasedMembershipPlanId?: string;
  stylistId: string;
}

// ===================================================================================
//  API ENDPOINT: POST /api/billing (CORRECTED AND INTEGRATED)
// ===================================================================================
export async function POST(req: Request) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const body = await req.json() as BillingRequestBody;
    const {
      customerId, appointmentId, items, grandTotal,
      paymentMethod, notes, purchasedMembershipPlanId, stylistId
    } = body;

    // --- 1. Validate Input ---
    if (!customerId || !stylistId || !appointmentId || !items) {
      throw new Error("Missing required billing fields.");
    }
    
    await connectToDatabase();

    // Find the stylist AND populate the linked staffInfo to get the name
    const stylistWithStaffInfo = await Stylist.findById(stylistId)
      .populate({
        path: 'staffInfo',
        model: 'Staff',
        select: 'name' 
      })
      .session(session);
    
    if (!stylistWithStaffInfo || !stylistWithStaffInfo.staffInfo || !stylistWithStaffInfo.staffInfo.name) {
      throw new Error(`Could not find a valid name for stylist ID: ${stylistId}. The linked staff record may be missing.`);
    }

    const stylistName = stylistWithStaffInfo.staffInfo.name;

    // --- 2. Calculate subtotals ---
    const serviceTotal = items.filter((i: BillItemPayload) => i.itemType === 'service').reduce((sum: number, i: BillItemPayload) => sum + i.finalPrice, 0);
    const productTotal = items.filter((i: BillItemPayload) => i.itemType === 'product').reduce((sum: number, i: BillItemPayload) => sum + i.finalPrice, 0);
    
    // --- 3. Create the Invoice ---
    const [newInvoice] = await Invoice.create([{
      customerId,
      appointmentId,
      stylistId,
      stylistName: stylistName,
      lineItems: items,
      subTotal: grandTotal,
      serviceTotal,
      productTotal,
      grandTotal,
      paymentMethod,
      paymentStatus: 'Paid',
      notes,
    }], { session });

    // --- 4. Create New Membership if Purchased ---
    if (purchasedMembershipPlanId) {
      const planItem = items.find((i: BillItemPayload) => i.itemType === 'membership');
      const purchasedPlanDoc = await MembershipPlan.findById(purchasedMembershipPlanId).session(session);
      if (planItem && purchasedPlanDoc) {
        const [newMembership] = await CustomerMembership.create([{
          customerId: customerId,
          membershipPlanId: purchasedPlanDoc._id,
          startDate: new Date(),
          endDate: new Date(new Date().setDate(new Date().getDate() + purchasedPlanDoc.durationDays)),
          status: 'Active',
          pricePaid: purchasedPlanDoc.price,
          originalInvoiceId: newInvoice._id,
        }], { session });
        await Invoice.updateOne({ _id: newInvoice._id }, { purchasedMembershipId: newMembership._id }, { session });
      }
    }
    
    // --- 5. Update Appointment Status ---
    await Appointment.updateOne({ _id: appointmentId }, { status: 'Paid', invoiceId: newInvoice._id, amount: grandTotal }, { session });

    // --- 6. Release the Stylist ---
    await Stylist.updateOne({ _id: stylistId }, { availabilityStatus: 'Available', currentAppointmentId: null }, { session });
    
    // --- 7. Award and Log Loyalty Points ---
    const serviceCount = items.filter((i: BillItemPayload) => i.itemType === 'service').length;
    const pointsToAward = serviceCount;
    if (pointsToAward > 0) {
      await LoyaltyTransaction.create([{
        customerId: customerId,
        points: pointsToAward,
        type: 'Credit',
        reason: `Earned from ${pointsToAward} service(s) on Invoice`,
        relatedAppointmentId: appointmentId
      }], { session });
    }

    // ======================= NEW LOGIC: UPDATE PERFORMANCE TRACKER =======================
    // --- 8. Find and update the latest target sheet ---
    const latestTargetSheet = await TargetData.findOne().sort({ createdAt: -1 }).session(session);

    if (latestTargetSheet) {
      const currentAchieved = latestTargetSheet.summary.achieved;
      const newAchievedService = (currentAchieved.service || 0) + serviceTotal;
      const newAchievedRetail = (currentAchieved.retail || 0) + productTotal;
      const newAchievedNetSales = (currentAchieved.netSales || 0) + grandTotal;
      const newAchievedBills = (currentAchieved.bills || 0) + 1;
      const newAchievedAbv = newAchievedBills > 0 ? (newAchievedNetSales / newAchievedBills) : 0;
      
      const updatedAchievedMetrics = {
        ...currentAchieved,
        service: newAchievedService,
        retail: newAchievedRetail,
        netSales: newAchievedNetSales,
        bills: newAchievedBills,
        abv: newAchievedAbv,
      };
      
      await TargetData.updateOne(
        { _id: latestTargetSheet._id },
        { $set: { "summary.achieved": updatedAchievedMetrics } },
        { session }
      );
      console.log('Performance tracker updated with new bill data.');
    } else {
      console.warn('Billing completed, but no active target sheet was found to update.');
    }
    // =====================================================================================

    await session.commitTransaction();

    return NextResponse.json({
      success: true,
      message: "Billing complete, tracker updated, and points awarded!",
      invoiceId: newInvoice._id.toString(),
      pointsToAward: pointsToAward,
    }, { status: 201 });

  } catch (error: any) {
    await session.abortTransaction();
    console.error("Billing API Error:", error);
    return NextResponse.json({ success: false, message: error.message || "An unexpected error occurred." }, { status: 500 });
  } finally {
    await session.endSession();
  }
}