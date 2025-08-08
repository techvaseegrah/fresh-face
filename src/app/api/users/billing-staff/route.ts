// app/api/users/billing-staff/route.ts - TENANT-AWARE VERSION

import { NextRequest, NextResponse } from 'next/server'; // <-- 1. Import NextRequest
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/user';
import role from '@/models/role';
import { getTenantIdOrBail } from '@/lib/tenant'; // <-- 2. Import the tenant helper

// This export remains correct. It ensures the data is always fresh.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) { // <-- 3. Add `req` parameter
  try {
    // 4. Get the tenant ID from the request or bail out with an error
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) {
      return tenantId; // Return the error response if tenant ID is missing
    }

    await connectToDatabase();
    
    // 5. Scope the 'role' query by tenantId
    // This ensures we only find roles belonging to the current salon.
    const roles = await role.find({ 
      name: { $in: ['MANAGER', 'RECEPTIONIST'] },
      tenantId: tenantId, // <-- ADDED: Filter roles by the current tenant
    }).select('_id');
    
    if (roles.length === 0) {
      // This is a valid state if no such roles exist for this tenant.
      return NextResponse.json({
        success: true,
        staff: []
      }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    
    const roleIds = roles.map(role => role._id);
    
    // 6. Scope the 'User' query by tenantId
    // This is the most critical step. It ensures we only fetch users from the current salon.
    const staff = await User.find({
      roleId: { $in: roleIds },
      isActive: true,
      tenantId: tenantId, // <-- ADDED: Filter users by the current tenant
    })
    .select('name email roleId')
    .populate({ path: 'roleId', model: role, select: 'name' }) // Be explicit with the model for populate
    .sort({ name: 1 });
    
    // The successful response. The logic here remains the same.
    return NextResponse.json({
      success: true,
      staff: staff.map(user => ({
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        // Using optional chaining `?.` is safer in case roleId is somehow null
        role: (user.roleId as any)?.name 
      }))
    }, 
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
    
  } catch (error) {
    console.error('Error fetching billing staff:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch staff members'
    }, { status: 500 });
  }
}