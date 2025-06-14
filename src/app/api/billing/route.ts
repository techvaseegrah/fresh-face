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
import Staff from '@/models/staff'; // <-- IMPORTANT: Import the Staff model
import mongoose from 'mongoose';

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
//  API ENDPOINT: POST /api/billing (CORRECTED)
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

    // ============================ THE FIX: PART 1 of 3 ============================
    // Find the stylist AND populate the linked staffInfo to get the name
    const stylistWithStaffInfo = await Stylist.findById(stylistId)
      .populate({
        path: 'staffInfo',
        model: 'Staff',
        select: 'name' // We only need the name
      })
      .session(session);
    
    // Add validation to ensure the population worked
    if (!stylistWithStaffInfo || !stylistWithStaffInfo.staffInfo || !stylistWithStaffInfo.staffInfo.name) {
      throw new Error(`Could not find a valid name for stylist ID: ${stylistId}. The linked staff record may be missing.`);
    }

    // ============================ THE FIX: PART 2 of 3 ============================
    // Extract the name string from the populated data
    const stylistName = stylistWithStaffInfo.staffInfo.name;
    // ===============================================================================

    // --- 2. Calculate subtotals ---
    const serviceTotal = items.filter((i: BillItemPayload) => i.itemType === 'service').reduce((sum: number, i: BillItemPayload) => sum + i.finalPrice, 0);
    const productTotal = items.filter((i: BillItemPayload) => i.itemType === 'product').reduce((sum: number, i: BillItemPayload) => sum + i.finalPrice, 0);
    
    // --- 3. Create the Invoice ---
    const [newInvoice] = await Invoice.create([{
      customerId,
      appointmentId,
      stylistId,
      // ============================ THE FIX: PART 3 of 3 ============================
      stylistName: stylistName, // Use the fetched name string here
      // ===============================================================================
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

    await session.commitTransaction();

    return NextResponse.json({
      success: true,
      message: "Billing complete, invoice created, and points awarded!",
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