// /app/api/appointment/[id]/route.ts - FINAL CORRECTED VERSION

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import ServiceItem from '@/models/ServiceItem';
import Product from '@/models/Product'; // <-- IMPORT PRODUCT MODEL
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
                { path: 'serviceIds', select: 'name price duration membershipRate' },
                // ================================================================
                // CHANGE #1: ADD THIS LINE TO POPULATE PRODUCTS
                // ================================================================
                { path: 'productIds', select: 'name price' }
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
//  PUT: Handler to update an existing appointment (✅ CORRECTED FOR PRODUCTS)
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

        // ================================================================================
        // CHANGE #2: REWRITTEN LOGIC TO RECALCULATE TOTALS FOR SERVICES AND PRODUCTS
        // ================================================================================
        const needsRecalculation = 'serviceIds' in updateData || 'productIds' in updateData;

        if (needsRecalculation) {
            const serviceIdsToCalc = updateData.serviceIds || currentAppointment.serviceIds;
            const productIdsToCalc = updateData.productIds || currentAppointment.productIds;

            // Validate services if they were provided in the update
            if ('serviceIds' in updateData && Array.isArray(updateData.serviceIds)) {
                const uniqueServiceIds = [...new Set(serviceIdsToCalc)];
                if (uniqueServiceIds.length > 0) {
                    const foundServices = await ServiceItem.countDocuments({ _id: { $in: uniqueServiceIds }, tenantId });
                    if (foundServices !== uniqueServiceIds.length) {
                        return NextResponse.json({ success: false, message: "One or more services are invalid." }, { status: 400 });
                    }
                }
                const services = await ServiceItem.find({ _id: { $in: serviceIdsToCalc } }).lean();
                updateData.estimatedDuration = services.reduce((total, service) => total + service.duration, 0);
            }

            // Validate products if they were provided in the update
            if ('productIds' in updateData && Array.isArray(updateData.productIds)) {
                const uniqueProductIds = [...new Set(productIdsToCalc)];
                 if (uniqueProductIds.length > 0) {
                    const foundProducts = await Product.countDocuments({ _id: { $in: uniqueProductIds }, tenantId });
                    if (foundProducts !== uniqueProductIds.length) {
                        return NextResponse.json({ success: false, message: "One or more products are invalid." }, { status: 400 });
                    }
                }
            }

            // Create a temporary in-memory instance to use our calculateTotal method
            const tempAppointmentForCalc = new Appointment({ 
                ...currentAppointment.toObject(), 
                serviceIds: serviceIdsToCalc, 
                productIds: productIdsToCalc,
                customerId: updateData.customerId || currentAppointment.customerId,
            });

            // This method now handles services, products, and membership discounts correctly
            const { grandTotal, membershipSavings } = await tempAppointmentForCalc.calculateTotal();
            updateData.finalAmount = grandTotal;
            updateData.amount = grandTotal + membershipSavings;
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

        const updatedAppointmentDoc = await Appointment.findOneAndUpdate(
            { _id: id, tenantId },
            updateData,
            { new: true, runValidators: true }
        ).populate([
            { path: 'customerId' },
            { path: 'stylistId', select: 'name' },
            { path: 'serviceIds', select: 'name price duration membershipRate' },
            // ================================================================
            // CHANGE #3: POPULATE PRODUCTS IN THE RESPONSE
            // ================================================================
            { path: 'productIds', select: 'name price' }
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