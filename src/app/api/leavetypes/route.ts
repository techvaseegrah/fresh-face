import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import LeaveType from '../../../models/LeaveType'; // Use the correct LeaveType model
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';

/**
 * @description GET all leave types for a tenant
 */
export async function GET(request: NextRequest) {
    const tenantIdOrResponse = await getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) return tenantIdOrResponse;
    const tenantId = tenantIdOrResponse;

    await dbConnect();
    try {
        const leaveTypes = await LeaveType.find({ tenantId }).sort({ name: 1 }).lean();
        return NextResponse.json({ success: true, data: leaveTypes });
    } catch (error) {
        console.error('Error fetching leave types:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch leave types' }, { status: 500 });
    }
}

/**
 * @description POST (create) a new leave type for a tenant
 */
export async function POST(request: NextRequest) {
    const tenantIdOrResponse = await getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) return tenantIdOrResponse;
    const tenantId = tenantIdOrResponse;

    await dbConnect();
    try {
        const { name } = await request.json();
        if (!name) {
            return NextResponse.json({ success: false, error: 'Leave type name is required' }, { status: 400 });
        }

        const newLeaveType = new LeaveType({ name, tenantId });
        await newLeaveType.save();

        return NextResponse.json({ success: true, data: newLeaveType }, { status: 201 });
    } catch (error: any) {
        if (error.code === 11000) { // Handle duplicate name error from the schema index
            return NextResponse.json({ success: false, error: 'A leave type with this name already exists.' }, { status: 409 });
        }
        console.error('Error creating leave type:', error);
        return NextResponse.json({ success: false, error: 'Failed to create leave type' }, { status: 500 });
    }
}

/**
 * @description DELETE a leave type by its ID
 */
export async function DELETE(request: NextRequest) {
    const tenantIdOrResponse = await getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) return tenantIdOrResponse;
    const tenantId = tenantIdOrResponse;

    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ success: false, error: 'Valid Leave Type ID is required' }, { status: 400 });
    }

    await dbConnect();
    try {
        // Ensure the leave type belongs to the correct tenant before deleting
        const deleted = await LeaveType.findOneAndDelete({ _id: id, tenantId });
        if (!deleted) {
            return NextResponse.json({ success: false, error: 'Leave Type not found.' }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: { message: 'Leave Type deleted successfully.' } });
    } catch (error) {
        console.error('Error deleting leave type:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete leave type' }, { status: 500 });
    }
}