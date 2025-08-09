// app/api/dashboard/stats/route.ts - MULTI-TENANT REFACTORED VERSION

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import Customer from '@/models/customermodel';
import Invoice from '@/models/invoice';
import mongoose from 'mongoose';
import { getTenantIdOrBail } from '@/lib/tenant';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// ===================================================================================
//  GET: Handler to fetch KPI stats for the dashboard cards
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
    
    // Date ranges (your existing logic is good)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    
    // --- MT: Define tenant scope for queries ---
    const tenantScope = { tenantId: tenantId };
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

    // Parallel queries for better performance, with tenant scope added to each
    const [
      todayAppointments,
      totalCustomers,
      monthlyInvoices,
      activeMembers,
      pendingAppointments,
      completedToday,
    ] = await Promise.all([
      // Today's appointments for this tenant
      Appointment.countDocuments({
        ...tenantScope,
        appointmentDateTime: { $gte: startOfDay, $lt: endOfDay },
        status: { $nin: ['Cancelled', 'No-Show'] }
      }),
      
      // Total customers for this tenant
      Customer.countDocuments({ ...tenantScope, isActive: true }),
      
      // Monthly revenue for this tenant
      Invoice.aggregate([
        {
          $match: {
            tenantId: tenantObjectId, // Crucial tenant scope for aggregation
            createdAt: { $gte: startOfMonth, $lte: endOfMonth },
            paymentStatus: 'Paid'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$grandTotal' },
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Active members for this tenant
      Customer.countDocuments({ ...tenantScope, isMembership: true, isActive: true }),
      
      // Pending appointments FOR TODAY for this tenant
      Appointment.countDocuments({
        ...tenantScope,
        appointmentDateTime: { $gte: startOfDay, $lt: endOfDay },
        status: 'Scheduled' // Use 'Scheduled' as it's more explicit than 'Appointment'
      }),
      
      // Completed today for this tenant
      Appointment.countDocuments({
        ...tenantScope,
        appointmentDateTime: { $gte: startOfDay, $lt: endOfDay },
        status: { $in: ['Checked-Out', 'Paid'] }
      }),
    ]);

    const monthlyRevenue = monthlyInvoices[0]?.totalRevenue || 0;
    const avgSessionValue = monthlyInvoices[0]?.count > 0 
      ? monthlyRevenue / monthlyInvoices[0].count 
      : 0;

    const stats = {
      todayAppointments,
      totalCustomers,
      monthlyRevenue,
      activeMembers,
      pendingAppointments,
      completedToday,
      avgSessionValue
    };

    return NextResponse.json({ success: true, stats });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}