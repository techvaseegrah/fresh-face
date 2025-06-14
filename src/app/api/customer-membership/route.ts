// app/api/customer-membership/route.ts

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import CustomerMembership from '@/models/customerMembership';
import MembershipPlan from '@/models/membershipPlan'; // Import if needed for duration
import mongoose from 'mongoose';

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { customerId, membershipPlanId } = await req.json();

    if (!mongoose.Types.ObjectId.isValid(customerId) || !mongoose.Types.ObjectId.isValid(membershipPlanId)) {
      return NextResponse.json({ success: false, message: 'Invalid customer or plan ID.' }, { status: 400 });
    }

    // Optional: Check if the customer already has an active membership
    const existingMembership = await CustomerMembership.findOne({
      customerId: customerId,
      status: 'Active',
      endDate: { $gte: new Date() }
    });

    if (existingMembership) {
      return NextResponse.json({ success: false, message: 'Customer already has an active membership.' }, { status: 409 }); // 409 Conflict
    }

    // Fetch the plan to get its duration
    const plan = await MembershipPlan.findById(membershipPlanId);
    if (!plan) {
      return NextResponse.json({ success: false, message: 'Membership plan not found.' }, { status: 404 });
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + plan.durationDays);

<<<<<<< HEAD
    const newMembership = await CustomerMembership.create({
      customerId,
      membershipPlanId,
      startDate,
      endDate,
      status: 'Active',
      pricePaid: plan.price // Assuming the price is paid upfront
    });

    // ===> THIS IS THE CRITICAL FIX <===
    // You MUST return a valid JSON response upon success.
    return NextResponse.json({
      success: true,
      message: 'Membership added successfully.',
      membership: newMembership
    });

  } catch (error: any) {
    console.error("API Error creating customer membership:", error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to add membership.' }, { status: 500 });
  }
}
=======
    // Create the new CustomerMembership document
    const newCustomerMembership = new CustomerMembership({
      customerId: customer._id,
      membershipPlanId: plan._id,
      startDate,
      endDate,
      status: 'Active', // New memberships are typically active immediately
      pricePaid: plan.price, // Price paid is the plan's current price
      // originalInvoiceId: can be left undefined if not part of a larger bill in this flow
    });

    await newCustomerMembership.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Prepare the response, potentially populating plan details for confirmation
    const populatedMembership = await CustomerMembership.findById(newCustomerMembership._id)
                                    .populate({ path: 'membershipPlanId', select: 'name price durationDays benefits' })
                                    .populate({ path: 'customerId', select: 'name email' });


    return NextResponse.json({
      success: true,
      message: "Membership added successfully to customer.",
      membership: populatedMembership // Send back the created membership details
    }, { status: 201 });

  } catch (error: any) {
    await session.abortTransaction(); // Ensure transaction is aborted on any error
    session.endSession();
    console.error("Error in POST /api/customer-memberships:", error);
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((err: any) => err.message);
        return NextResponse.json({ success: false, message: "Validation failed.", errors: messages }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: error.message || "Failed to add membership." }, { status: 500 });
  }
}

// You might also want a GET endpoint here later to fetch all memberships for a customer
// export async function GET(req: Request) {
//   const { searchParams } = new URL(req.url);
//   const customerId = searchParams.get('customerId');
//   if (!customerId) { /* ... handle error ... */ }
//   const memberships = await CustomerMembership.find({ customerId }).populate('membershipPlanId');
//   return NextResponse.json({ success: true, memberships });
// }
>>>>>>> 348341dfda08046bf9480d53c01e6c154bb7e9ef
