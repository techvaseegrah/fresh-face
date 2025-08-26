import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { getTenantIdOrBail } from '@/lib/tenant';
import { decrypt } from '@/lib/crypto';

// Import required models
import Appointment from '@/models/Appointment';
import Customer from '@/models/customermodel';
import ServiceItem from '@/models/ServiceItem';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role.name !== 'staff') {
        return NextResponse.json({ success: false, message: 'Unauthorized Access' }, { status: 401 });
    }

    const tenantIdOrResponse = getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) {
        return tenantIdOrResponse;
    }
    const tenantId = tenantIdOrResponse;
    const staffObjectId = session.user.id;

    try {
        await dbConnect();

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Build the query object
        const matchQuery: any = {
            stylistId: new mongoose.Types.ObjectId(staffObjectId),
            tenantId: new mongoose.Types.ObjectId(tenantId),
        };

        // Add status filtering
        if (status && status !== 'all') {
            matchQuery.status = status;
        }

        // Add date range filtering
        if (startDate || endDate) {
            matchQuery.appointmentDateTime = {};
            if (startDate) {
                const startOfDay = new Date(startDate);
                startOfDay.setUTCHours(0, 0, 0, 0);
                matchQuery.appointmentDateTime.$gte = startOfDay;
            }
            if (endDate) {
                const endOfDay = new Date(endDate);
                endOfDay.setUTCHours(23, 59, 59, 999);
                matchQuery.appointmentDateTime.$lte = endOfDay;
            }
        }

        const appointments = await Appointment.find(matchQuery)
            .populate({ path: 'customerId', select: 'name' })
            .populate({ path: 'serviceIds', select: 'name duration' })
            .sort({ appointmentDateTime: -1 }) // Show most recent first
            .lean();

        // Decrypt customer names and format the response
        const formattedAppointments = appointments.map((apt: any) => { // <-- FIX: Added ': any' here
            let decryptedCustomerName = 'Decryption Error';
            if (apt.customerId?.name) {
                try {
                    decryptedCustomerName = decrypt(apt.customerId.name);
                } catch (e) {
                    console.error(`Failed to decrypt customer name for appointment ${apt._id}`);
                }
            }
            return {
                _id: apt._id.toString(),
                status: apt.status,
                customerName: decryptedCustomerName,
                services: apt.serviceIds.map((s: any) => s.name).join(', '),
                totalDuration: apt.serviceIds.reduce((sum: number, s: any) => sum + s.duration, 0),
                date: new Date(apt.appointmentDateTime).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }),
                time: new Date(apt.appointmentDateTime).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                }),
            };
        });

        return NextResponse.json({ success: true, appointments: formattedAppointments });

    } catch (error: any) {
        console.error(`Error fetching appointments for staff ${staffObjectId}:`, error);
        return NextResponse.json({ success: false, message: 'Failed to load appointments.' }, { status: 500 });
    }
}