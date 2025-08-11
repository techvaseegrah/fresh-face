// /app/api/appointment/[id]/route.ts - FINAL CORRECTED VERSION

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import ServiceItem from '@/models/ServiceItem';
import { getServerSession } from 'next-auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import { decrypt } from '@/lib/crypto'; // <-- FIX: Import the decrypt function

// ===================================================================================
//  GET: Handler to fetch a single appointment by its ID (with decryption)
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

        // Securely find the appointment and populate related data
        const appointment = await Appointment.findOne({ _id: id, tenantId })
            .populate([
                { path: 'customerId' }, // <-- FIX: Populate the full customer object to decrypt it
                { path: 'stylistId', select: 'name' },
                { path: 'serviceIds', select: 'name price duration membershipRate' }
            ])
            .lean(); // <-- FIX: Use .lean() for a plain JS object, which is easier and faster to modify

        if (!appointment) {
            return NextResponse.json({ success: false, message: "Appointment not found." }, { status: 404 });
        }

        // <-- FIX: Decrypt customer fields before sending the response
        if (appointment.customerId) {
            // Decrypt name with error handling
            if (appointment.customerId.name) {
                try {
                    appointment.customerId.name = decrypt(appointment.customerId.name);
                } catch (e) {
                    console.error(`Failed to decrypt name for appointment ${id}:`, e);
                    appointment.customerId.name = 'Decryption Error';
                }
            }
            // Decrypt phone number with error handling
            if (appointment.customerId.phoneNumber) {
                 try {
                    appointment.customerId.phoneNumber = decrypt(appointment.customerId.phoneNumber);
                } catch (e) {
                    console.error(`Failed to decrypt phone for appointment ${id}:`, e);
                    appointment.customerId.phoneNumber = '';
                }
            }
        }

        return NextResponse.json({ success: true, appointment });

    } catch (error: any) {
        console.error("API Error fetching appointment:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

// ===================================================================================
//  PUT: Handler to update an existing appointment (with decryption)
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

        // (Logic to find currentAppointment and calculate updateData remains the same)
        const currentAppointment = await Appointment.findOne({ _id: id, tenantId });

        if (!currentAppointment) {
            return NextResponse.json({ success: false, message: "Appointment not found." }, { status: 404 });
        }
        
        // ... (your existing logic for status changes and cost recalculation)
        const oldStatus = currentAppointment.status;
        const newStatus = updateData.status;

        if (updateData.serviceIds) {
            const services = await ServiceItem.find({_id: { $in: updateData.serviceIds }, tenantId: tenantId}).select('duration price membershipRate');
            if (services.length !== updateData.serviceIds.length) {
                return NextResponse.json({ success: false, message: "One or more services are invalid for this salon." }, { status: 400 });
            }
            updateData.estimatedDuration = services.reduce((total, service) => total + service.duration, 0);
            const tempAppointment = new Appointment({ ...currentAppointment.toObject(), serviceIds: updateData.serviceIds, customerId: updateData.customerId || currentAppointment.customerId, tenantId: tenantId });
            const { grandTotal, membershipSavings } = await tempAppointment.calculateTotal();
            updateData.finalAmount = grandTotal;
            updateData.membershipDiscount = membershipSavings;
        }

        if (newStatus && newStatus !== oldStatus) {
            const currentTime = new Date();
            if(newStatus === 'Checked-In') updateData.checkInTime = currentTime;
            if(newStatus === 'Checked-Out') {
                updateData.checkOutTime = currentTime;
                if (currentAppointment.checkInTime) {
                    updateData.actualDuration = Math.round((currentTime.getTime() - currentAppointment.checkInTime.getTime()) / (1000 * 60));
                }
            }
        }

        // The core update operation, scoped by ID and tenantId
        const updatedAppointmentDoc = await Appointment.findOneAndUpdate(
            { _id: id, tenantId },
            updateData,
            { new: true, runValidators: true }
        ).populate([
            { path: 'customerId' }, // <-- FIX: Populate the full customer object
            { path: 'stylistId', select: 'name' },
            { path: 'serviceIds', select: 'name price duration membershipRate' }
        ]);

        if (!updatedAppointmentDoc) {
             return NextResponse.json({ success: false, message: "Appointment not found or update failed." }, { status: 404 });
        }
        
        // <-- FIX: Convert to plain object to modify it
        const finalAppointment = updatedAppointmentDoc.toObject();

        // <-- FIX: Decrypt customer fields before sending the response
        if (finalAppointment.customerId) {
            // Decrypt name
            if (finalAppointment.customerId.name) {
                try {
                    finalAppointment.customerId.name = decrypt(finalAppointment.customerId.name);
                } catch (e) {
                    console.error(`Failed to decrypt name for updated appointment ${id}:`, e);
                    finalAppointment.customerId.name = 'Decryption Error';
                }
            }
            // Decrypt phone number
            if (finalAppointment.customerId.phoneNumber) {
                try {
                    finalAppointment.customerId.phoneNumber = decrypt(finalAppointment.customerId.phoneNumber);
                } catch (e) {
                    console.error(`Failed to decrypt phone for updated appointment ${id}:`, e);
                    finalAppointment.customerId.phoneNumber = '';
                }
            }
        }

        return NextResponse.json({
            success: true,
            appointment: finalAppointment // <-- FIX: Send the decrypted object
        });

    } catch (error: any) {
        console.error("API Error updating appointment:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

// ===================================================================================
//  DELETE: Handler to delete an existing appointment (No changes needed)
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

        const deletedAppointment = await Appointment.findOneAndDelete({ _id: id, tenantId });

        if (!deletedAppointment) {
            return NextResponse.json({ success: false, message: "Appointment not found." }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Appointment deleted successfully.' });

    } catch (error: any) {
        console.error("API Error deleting appointment:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}