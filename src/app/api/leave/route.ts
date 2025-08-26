import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import LeaveRequest from '../../../models/LeaveRequest';
import Staff from '../../../models/staff'; // Use the correct path to your staff model
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';

/**
 * @description GET all leave requests for a tenant
 */
export async function GET(request: NextRequest) {
    const tenantIdOrResponse = await getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) return tenantIdOrResponse;
    const tenantId = tenantIdOrResponse;

    await dbConnect();
    try {
        const leaveRequests = await LeaveRequest.find({ tenantId })
            // ✅ INTEGRATION POINT: 'populate' fetches details from the 'Staff' model.
            // We explicitly ask for 'staffIdNumber' here.
            .populate('staff', 'name staffIdNumber image position')
            .sort({ createdAt: -1 })
            .lean();
        return NextResponse.json({ success: true, data: leaveRequests });
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch leave requests' }, { status: 500 });
    }
}

/**
 * @description POST (create) a new leave request for a tenant
 */
export async function POST(request: NextRequest) {
    const tenantIdOrResponse = await getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) return tenantIdOrResponse;
    const tenantId = tenantIdOrResponse;

    await dbConnect();
    try {
        const body = await request.json();
        const newLeaveRequest = new LeaveRequest({ ...body, tenantId });
        await newLeaveRequest.save();

        // ✅ INTEGRATION POINT: We populate the response so the frontend immediately
        // has the staff name and staffIdNumber without needing to refetch.
        const populatedRequest = await LeaveRequest.findById(newLeaveRequest._id)
            .populate('staff', 'name staffIdNumber image position')
            .lean();

        return NextResponse.json({ success: true, data: populatedRequest }, { status: 201 });
    } catch (error: any) {
        if (error.name === 'ValidationError') {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
        console.error('Error creating leave request:', error);
        return NextResponse.json({ success: false, error: 'Failed to create leave request' }, { status: 500 });
    }
}

/**
 * @description PUT (update) a leave request's status
 */
export async function PUT(request: NextRequest) {
    const tenantIdOrResponse = await getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) return tenantIdOrResponse;
    const tenantId = tenantIdOrResponse;

    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ success: false, error: 'Valid Leave Request ID is required' }, { status: 400 });
    }

    await dbConnect();
    try {
        const { status } = await request.json();
        if (!['Approved', 'Rejected'].includes(status)) {
             return NextResponse.json({ success: false, error: 'Invalid status provided.' }, { status: 400 });
        }

        // ✅ INTEGRATION POINT: The updated record is also populated before being
        // sent back, ensuring the UI has the most current data.
        const updatedRequest = await LeaveRequest.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: { status } },
            { new: true }
        ).populate('staff', 'name staffIdNumber image position');

        if (!updatedRequest) {
            return NextResponse.json({ success: false, error: 'Leave Request not found.' }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: updatedRequest });
    } catch (error) {
        console.error('Error updating leave request:', error);
        return NextResponse.json({ success: false, error: 'Failed to update leave request' }, { status: 500 });
    }
}

/**
 * @description DELETE a leave request by its ID
 */
export async function DELETE(request: NextRequest) {
    const tenantIdOrResponse = await getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) return tenantIdOrResponse;
    const tenantId = tenantIdOrResponse;

    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ success: false, error: 'Valid Leave Request ID is required' }, { status: 400 });
    }

    await dbConnect();
    try {
        const deleted = await LeaveRequest.findOneAndDelete({ _id: id, tenantId });
        if (!deleted) {
            return NextResponse.json({ success: false, error: 'Leave Request not found.' }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: { message: 'Leave Request deleted successfully' } });
    } catch (error) {
        console.error('Error deleting leave request:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete leave request' }, { status: 500 });
    }
}