// app/api/dashboard/upcoming-appointments/route.ts - MULTI-TENANT REFACTORED VERSION

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import { getTenantIdOrBail } from '@/lib/tenant';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// Import all referenced models to ensure they are available for population
import '@/models/customermodel';
import '@/models/Stylist';
import '@/models/ServiceItem';

// ===================================================================================
//  GET: Handler to fetch today's upcoming appointments for the current tenant
// ===================================================================================
export async function GET(req: NextRequest) {
  try {
    // --- MT: Get tenantId and check permissions first ---
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.DASHBOARD_READ)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Timezone-aware logic (your existing logic is good)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // --- MT: Add tenantId to the find query ---
    const appointments = await Appointment.find({
      tenantId: tenantId, // The crucial tenant scope
      appointmentDateTime: { $gte: startOfDay, $lt: endOfDay },
      status: { $nin: ['Cancelled', 'No-Show', 'Paid', 'Checked-Out'] } // Only show appointments that are still relevant for "upcoming"
    })
    .populate('customerId', 'name')
    .populate('stylistId', 'name')
    .populate('serviceIds', 'name')
    .sort({ appointmentDateTime: 1 })
    .limit(10)
    .lean();

    // Data formatting logic (no changes needed)
    const formattedAppointments = appointments.map(apt => {
      const appointmentTime = new Date(apt.appointmentDateTime);
      const serviceNames = apt.serviceIds.map((service: any) => service.name).join(', ');

      return {
        id: apt._id.toString(),
        customerName: (apt.customerId as any)?.name || 'Unknown Customer',
        service: serviceNames || 'No service specified',
        time: appointmentTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
        stylist: (apt.stylistId as any)?.name || 'Not assigned',
        status: apt.status
      };
    });

    return NextResponse.json({ success: true, appointments: formattedAppointments });

  } catch (error) {
    console.error('Error fetching upcoming appointments:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}