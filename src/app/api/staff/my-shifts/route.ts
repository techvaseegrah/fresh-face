// /api/staff/my-shifts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Shift from '@/models/Shift';
import { getTenantIdOrBail } from '@/lib/tenant'; // Import the tenant helper

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    // Ensure the user is authenticated.
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get the tenant ID from the header or return an error response.
    const tenantIdOrBail = getTenantIdOrBail(request);
    if (tenantIdOrBail instanceof NextResponse) {
        return tenantIdOrBail;
    }
    const tenantId = tenantIdOrBail; // Now it's a string

    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        if (!startDateParam || !endDateParam) {
            return NextResponse.json({ success: false, error: 'Start and end dates are required.' }, { status: 400 });
        }

        const shifts = await Shift.find({
            employeeId: session.user.id,
            tenantId: tenantId, // Use the tenantId from the header for the query
            date: { $gte: new Date(startDateParam), $lte: new Date(endDateParam) }
        }).sort({ date: 'asc' }).lean();

        return NextResponse.json({ success: true, data: shifts });

    } catch (error) {
         return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}