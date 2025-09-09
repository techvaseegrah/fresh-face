// app/api/users/billing-staff/route.ts - UPDATED VERSION

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/user';
import Role from '@/models/role'; // Corrected import name to match model
import { getTenantIdOrBail } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) {
      return tenantId;
    }

    await connectToDatabase();
    
    // --- THIS IS THE KEY CHANGE ---
    // Find roles that are explicitly allowed to handle billing for this tenant.
    const roles = await Role.find({ 
      canHandleBilling: true,   // <-- QUERY BY THE NEW BOOLEAN FLAG
      tenantId: tenantId,       // <-- Still scoped by tenant
    }).select('_id');
    
    if (roles.length === 0) {
      // This is a valid state if no roles are configured for billing yet.
      return NextResponse.json({
        success: true,
        staff: []
      }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    
    const roleIds = roles.map(role => role._id);
    
    // The rest of the logic remains the same. It now correctly finds users
    // based on the roles we found above.
    const staff = await User.find({
      roleId: { $in: roleIds },
      isActive: true,
      tenantId: tenantId,
    })
    .select('name email roleId')
    .populate({ path: 'roleId', model: Role, select: 'name' })
    .sort({ name: 1 });
    
    return NextResponse.json({
      success: true,
      staff: staff.map(user => ({
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: (user.roleId as any)?.name 
      }))
    }, 
    {
      headers: { 'Cache-Control': 'no-store' },
    });
    
  } catch (error) {
    console.error('Error fetching billing staff:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch staff members'
    }, { status: 500 });
  }
}