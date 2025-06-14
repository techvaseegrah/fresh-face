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