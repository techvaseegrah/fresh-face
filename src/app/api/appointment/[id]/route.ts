// app/api/appointment/[id]/route.ts - MULTI-TENANT REFACTORED VERSION

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import Stylist from '@/models/Stylist';
import ServiceItem from '@/models/ServiceItem';
import { getServerSession } from 'next-auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';

// ===================================================================================
//  GET: Handler to fetch a single appointment by its ID
// ===================================================================================
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.APPOINTMENTS_READ)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    try {
        await connectToDatabase();
        const { id } = params;

        // Securely find the appointment by its ID and the tenantId from the user's session.
        const appointment = await Appointment.findOne({ _id: id, tenantId })
            .populate([
                { path: 'customerId', select: 'name phoneNumber isMembership' },
                { path: 'stylistId', select: 'name' },
                { path: 'serviceIds', select: 'name price duration membershipRate' }
            ]);

        if (!appointment) {
            return NextResponse.json({ success: false, message: "Appointment not found." }, { status: 404 });
        }

        return NextResponse.json({ success: true, appointment });

    } catch (error: any) {
        console.error("API Error fetching appointment:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

// ===================================================================================
//  PUT: Handler to update an existing appointment
// ===================================================================================
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.APPOINTMENTS_UPDATE)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        await connectToDatabase();

        const { id } = params;
        const updateData = await req.json();

        // First, securely find the appointment to ensure it belongs to the current tenant before proceeding.
        const currentAppointment = await Appointment.findOne({ _id: id, tenantId });

        if (!currentAppointment) {
            return NextResponse.json({ success: false, message: "Appointment not found." }, { status: 404 });
        }

        const oldStatus = currentAppointment.status;
        const newStatus = updateData.status;

        // If services are being updated, recalculate duration and cost.
        if (updateData.serviceIds) {
            // Ensure the services being added also belong to the tenant.
            const services = await ServiceItem.find({
                _id: { $in: updateData.serviceIds },
                tenantId: tenantId
            }).select('duration price membershipRate');

            // Verify that all requested services were found for this tenant.
            if (services.length !== updateData.serviceIds.length) {
                return NextResponse.json({ success: false, message: "One or more services are invalid for this salon." }, { status: 400 });
            }

            updateData.estimatedDuration = services.reduce((total, service) => total + service.duration, 0);

            // Create a temporary appointment object for accurate recalculation.
            const tempAppointment = new Appointment({
                ...currentAppointment.toObject(),
                serviceIds: updateData.serviceIds,
                customerId: updateData.customerId || currentAppointment.customerId,
                tenantId: tenantId // Ensure tenantId is part of the temp object
            });
            const { grandTotal, membershipSavings } = await tempAppointment.calculateTotal();
            
            updateData.finalAmount = grandTotal;
            updateData.membershipDiscount = membershipSavings;
        }

        // Handle status-specific updates (e.g., check-in/check-out times).
        if (newStatus && newStatus !== oldStatus) {
            const currentTime = new Date();
            switch (newStatus) {
                case 'Checked-In':
                    updateData.checkInTime = currentTime;
                    break;
                case 'Checked-Out':
                    updateData.checkOutTime = currentTime;
                    if (currentAppointment.checkInTime) {
                        updateData.actualDuration = Math.round(
                            (currentTime.getTime() - currentAppointment.checkInTime.getTime()) / (1000 * 60)
                        );
                    }
                    break;
            }
        }

        // The core update operation, scoped by ID and tenantId for maximum security.
        const updatedAppointment = await Appointment.findOneAndUpdate(
            { _id: id, tenantId },
            updateData,
            { new: true, runValidators: true }
        ).populate([
            { path: 'customerId', select: 'name phoneNumber isMembership' },
            { path: 'stylistId', select: 'name' },
            { path: 'serviceIds', select: 'name price duration membershipRate' }
        ]);

        return NextResponse.json({
            success: true,
            appointment: updatedAppointment
        });

    } catch (error: any) {
        console.error("API Error updating appointment:", error);
        return NextResponse.json({
            success: false,
            message: error.message
        }, { status: 500 });
    }
}

// ===================================================================================
//  DELETE: Handler to delete an existing appointment
// ===================================================================================
export async function DELETE(req: NextRequest, { params }: { params: { id:string } }) {
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.APPOINTMENTS_DELETE)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    try {
        await connectToDatabase();
        const { id } = params;

        // Securely find and delete the appointment by its ID and the tenantId.
        const deletedAppointment = await Appointment.findOneAndDelete({ _id: id, tenantId });

        if (!deletedAppointment) {
            // This message is intentionally vague for security.
            // It could mean the appointment ID is wrong, or it belongs to another tenant.
            return NextResponse.json({ success: false, message: "Appointment not found." }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Appointment deleted successfully.' });

    } catch (error: any) {
        console.error("API Error deleting appointment:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}