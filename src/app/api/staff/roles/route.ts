// src/app/api/staff/roles/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import Role from '@/models/role'; // Assuming your role model is named 'Role'

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    // Security Check: We only require the user to be logged in.
    // Any authenticated member of the organization can see the list of roles.
    if (!session?.user) {
        return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    try {
        await dbConnect();

        // Find all active roles for the current tenant and select only the necessary fields.
        const roles = await Role.find({ 
            tenantId, 
            isActive: true 
        }).select('displayName _id').lean();

        return NextResponse.json({ roles });

    } catch (error: any) {
        console.error("STAFF-FETCH-ROLES API ERROR:", error);
        return NextResponse.json({ message: 'Server Error', error: error.message }, { status: 500 });
    }
}