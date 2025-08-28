import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import LeaveRequest from '../../../../models/LeaveRequest';
import { getTenantIdOrBail } from '@/lib/tenant';
import { getServerSession } from "next-auth/next";
import { authOptions } from '@/lib/auth';

/**
 * @description GET all leave requests for the currently logged-in staff member
 */
export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    // --- FIX: Use session.user.id which is defined in your types ---
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, error: 'Not Authenticated as Staff' }, { status: 401 });
    }

    const tenantIdOrResponse = await getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) return tenantIdOrResponse;
    const tenantId = tenantIdOrResponse;
    // --- FIX: Use the correct, type-safe property ---
    const staffId = session.user.id;

    await dbConnect();
    try {
        const leaveRequests = await LeaveRequest.find({ tenantId, staff: staffId })
            .sort({ createdAt: -1 })
            .lean();

        return NextResponse.json({ success: true, data: leaveRequests });
    } catch (error) {
        console.error('Error fetching staff leave requests:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch leave requests' }, { status: 500 });
    }
}

/**
 * @description POST (create) a new leave request for the currently logged-in staff member
 */
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    // --- FIX: Use session.user.id which is defined in your types ---
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, error: 'Not Authenticated as Staff' }, { status: 401 });
    }

    const tenantIdOrResponse = await getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) return tenantIdOrResponse;
    const tenantId = tenantIdOrResponse;
    // --- FIX: Use the correct, type-safe property ---
    const staffId = session.user.id;

    await dbConnect();
    try {
        const body = await request.json();
        
        const newLeaveRequest = new LeaveRequest({
            ...body,
            tenantId,
            staff: staffId, 
        });

        await newLeaveRequest.save();

        return NextResponse.json({ success: true, data: newLeaveRequest }, { status: 201 });
    } catch (error: any) {
        if (error.name === 'ValidationError') {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
        console.error('Error creating leave request by staff:', error);
        return NextResponse.json({ success: false, error: 'Failed to create leave request' }, { status: 500 });
    }
}