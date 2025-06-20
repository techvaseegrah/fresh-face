// app/api/customer/[id]/toggle-membership/route.ts
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectToDatabase();
    
    const { id } = params;
    const { isMembership } = await req.json();

    const customer = await Customer.findByIdAndUpdate(
      id,
      { 
        isMembership: isMembership,
        membershipPurchaseDate: isMembership ? new Date() : null
      },
      { new: true }
    );

    if (!customer) {
      return NextResponse.json({ success: false, message: "Customer not found." }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Membership ${isMembership ? 'granted' : 'removed'} successfully!`,
      customer: {
        ...customer.toObject(),
        isMember: customer.isMembership
      }
    });

  } catch (error: any) {
    console.error("API Error toggling membership:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}