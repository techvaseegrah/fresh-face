// /app/api/appointment/[id]/route.ts - FINAL CORRECTED VERSION

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import ServiceItem from '@/models/ServiceItem';
import { getServerSession } from 'next-auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import { decrypt } from '@/lib/crypto';

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

        const appointment = await Appointment.findOne({ _id: id, tenantId })
            .populate([
                { path: 'customerId' },
                { path: 'stylistId', select: 'name' },
                { path: 'serviceIds', select: 'name price duration membershipRate' }
            ])
            .lean();

        if (!appointment) {
            return NextResponse.json({ success: false, message: "Appointment not found." }, { status: 404 });
        }

        if (appointment.customerId) {
            if (appointment.customerId.name) {
                try {
                    appointment.customerId.name = decrypt(appointment.customerId.name);
                } catch (e) {
                    console.error(`Failed to decrypt name for appointment ${id}:`, e);
                    appointment.customerId.name = 'Decryption Error';
                }
            }
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
//  PUT: Handler to update an existing appointment (✅ CORRECTED FOR DUPLICATE SERVICES)
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

        const currentAppointment = await Appointment.findOne({ _id: id, tenantId });

        if (!currentAppointment) {
            return NextResponse.json({ success: false, message: "Appointment not found." }, { status: 404 });
        }
        
        const oldStatus = currentAppointment.status;
        const newStatus = updateData.status;

        // ✅ START: Corrected Service Validation and Calculation Logic
        if (updateData.serviceIds && Array.isArray(updateData.serviceIds)) {
            const allServiceIdsWithDuplicates = updateData.serviceIds;
            const uniqueServiceIds = [...new Set(allServiceIdsWithDuplicates)];

            const foundServicesFromDB = await ServiceItem.find({
                _id: { $in: uniqueServiceIds }, 
                tenantId: tenantId
            }).lean();

            if (foundServicesFromDB.length !== uniqueServiceIds.length) {
                return NextResponse.json({ success: false, message: "One or more services are invalid for this salon." }, { status: 400 });
            }

            const serviceDetailsMap = new Map(foundServicesFromDB.map(service => [service._id.toString(), service]));
            const fullServiceDetailsList = allServiceIdsWithDuplicates.map(serviceId => serviceDetailsMap.get(serviceId)!);

            // Now use the full list for calculations
            updateData.estimatedDuration = fullServiceDetailsList.reduce((total, service) => total + service.duration, 0);
            
            const tempAppointment = new Appointment({ 
                ...currentAppointment.toObject(), 
                serviceIds: allServiceIdsWithDuplicates, 
                customerId: updateData.customerId || currentAppointment.customerId, 
                tenantId: tenantId 
            });

            const { grandTotal, membershipSavings } = await tempAppointment.calculateTotal();
            updateData.finalAmount = grandTotal;
            updateData.amount = grandTotal + membershipSavings; // also update the base amount
            updateData.membershipDiscount = membershipSavings;
        }
        // ✅ END: Corrected Service Validation and Calculation Logic

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

        const updatedAppointmentDoc = await Appointment.findOneAndUpdate(
            { _id: id, tenantId },
            updateData,
            { new: true, runValidators: true }
        ).populate([
            { path: 'customerId' },
            { path: 'stylistId', select: 'name' },
            { path: 'serviceIds', select: 'name price duration membershipRate' }
        ]);

        if (!updatedAppointmentDoc) {
             return NextResponse.json({ success: false, message: "Appointment not found or update failed." }, { status: 404 });
        }
        
        const finalAppointment = updatedAppointmentDoc.toObject();

        if (finalAppointment.customerId) {
            if (finalAppointment.customerId.name) {
                try {
                    finalAppointment.customerId.name = decrypt(finalAppointment.customerId.name);
                } catch (e) {
                    console.error(`Failed to decrypt name for updated appointment ${id}:`, e);
                    finalAppointment.customerId.name = 'Decryption Error';
                }
            }
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
            appointment: finalAppointment
        });

    } catch (error: any) {
        console.error("API Error updating appointment:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
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