// app/api/dashboard/activities/route.ts - MULTI-TENANT REFACTORED VERSION

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import Customer from '@/models/customermodel';
import Invoice from '@/models/invoice';
import { getTenantIdOrBail } from '@/lib/tenant';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// ===================================================================================
//  GET: Handler to fetch a feed of recent activities for the current tenant
// ===================================================================================
export async function GET(req: NextRequest) {
  try {
    // --- MT: Get tenantId and check permissions first ---
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    const session = await getServerSession(authOptions);
    // Assuming a general dashboard read permission
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.DASHBOARD_READ)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const activities = [];
    const queryLimit = 5; // Fetch a few more items than needed to ensure a full list

    // Fetch recent data from all sources in parallel
    const [
        recentAppointments,
        recentCustomers,
        recentPayments
    ] = await Promise.all([
        // --- MT: Scope Appointment query by tenantId ---
        Appointment.find({ tenantId })
          .populate('customerId', 'name')
          .populate('stylistId','name')
          .sort({ createdAt: -1 })
          .limit(queryLimit)
          .lean(),

        // --- MT: Scope Customer query by tenantId ---
        Customer.find({ tenantId })
          .sort({ createdAt: -1 })
          .limit(queryLimit)
          .lean(),

        // --- MT: Scope Invoice query by tenantId ---
        Invoice.find({ tenantId, paymentStatus: 'Paid' })
          .populate('customerId', 'name')
          .sort({ createdAt: -1 })
          .limit(queryLimit)
          .lean()
    ]);

    // Process and format each activity type
    recentAppointments.forEach(appointment => {
      activities.push({
        id: appointment._id.toString(),
        type: 'appointment',
        title: 'New Appointment Booked',
        description: `For ${appointment.customerId?.name || 'Customer'} with ${appointment.stylistId?.name || 'Stylist'}`,
        time: appointment.createdAt // Keep as Date object for sorting
      });
    });

    recentCustomers.forEach(customer => {
      activities.push({
        id: customer._id.toString(),
        type: 'customer',
        title: 'New Customer Registered',
        description: customer.name,
        time: customer.createdAt // Keep as Date object for sorting
      });
    });

    recentPayments.forEach(payment => {
      activities.push({
        id: payment._id.toString(),
        type: 'payment',
        title: 'Payment Received',
        description: `From ${payment.customerId?.name || 'Customer'}`,
        time: payment.createdAt, // Keep as Date object for sorting
        amount: payment.grandTotal
      });
    });

    // Sort all combined activities by time, descending
    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    // Slice to the final desired length and format the time for the frontend
    const formattedActivities = activities.slice(0, 10).map(activity => ({
        ...activity,
        time: new Date(activity.time).toISOString(), // Use ISO string for consistency
    }));

    return NextResponse.json({ success: true, activities: formattedActivities });

  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}