// app/api/customer/[id]/membership-discounts/route.ts - MULTI-TENANT VERSION

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import { getTenantIdOrBail } from '@/lib/tenant'; // Import tenant helper
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  // 1. Check user permissions first
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_READ)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  // 2. Get Tenant ID or fail early
  const tenantId = getTenantIdOrBail(req as any); // Cast to 'any' or NextRequest if possible
  if (tenantId instanceof NextResponse) {
      return tenantId;
  }
  
  try {
    await connectToDatabase();
    
    const { id } = params;
    const { serviceIds } = await req.json();

    // 3. Scope the customer lookup to the current tenant
    // This is the critical security change.
    const customer = await Customer.findOne({ _id: id, tenantId });
    
    if (!customer) {
      // 4. Provide a more specific error message
      return NextResponse.json({ success: false, message: "Customer not found for this tenant." }, { status: 404 });
    }

    // Because the `customer` document is correctly scoped, these instance method calls are now secure.
    const discounts = await customer.getMembershipDiscount(serviceIds);
    const hasMembership = await customer.hasActiveMembership();

    return NextResponse.json({ 
      success: true, 
      discounts,
      membership: hasMembership ? customer.currentMembershipId : null
    });

  } catch (error: any) {
    console.error("API Error fetching membership discounts:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}