// app/api/dashboard/revenue/route.ts - MULTI-TENANT REFACTORED VERSION

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Invoice from '@/models/invoice';
import Appointment from '@/models/Appointment';
import mongoose from 'mongoose';
import { getTenantIdOrBail } from '@/lib/tenant';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// ===================================================================================
//  GET: Handler to fetch monthly revenue and appointment data for the current tenant
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

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // --- MT: Add tenantId to the $match stage of both aggregations ---
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

    // Get revenue data and appointment counts in parallel
    const [revenueData, appointmentData] = await Promise.all([
      // Revenue aggregation
      Invoice.aggregate([
        {
          $match: {
            tenantId: tenantObjectId, // Crucial tenant scope
            createdAt: { $gte: sixMonthsAgo },
            paymentStatus: 'Paid'
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            revenue: { $sum: '$grandTotal' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]),
      // Appointment aggregation
      Appointment.aggregate([
        {
          $match: {
            tenantId: tenantObjectId, // Crucial tenant scope
            createdAt: { $gte: sixMonthsAgo }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            appointments: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ])
    ]);
    
    // --- Data merging logic (no changes needed) ---
    // This logic is complex but correct. We'll pre-fill all months for a complete chart.
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const finalData = [];
    const currentDate = new Date(sixMonthsAgo);

    for (let i = 0; i < 6; i++) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1; // 1-based month

        const revDataItem = revenueData.find(item => item._id.year === year && item._id.month === month);
        const aptDataItem = appointmentData.find(item => item._id.year === year && item._id.month === month);

        finalData.push({
            month: `${monthNames[month - 1]} ${year}`,
            revenue: revDataItem ? revDataItem.revenue : 0,
            appointments: aptDataItem ? aptDataItem.appointments : 0,
        });

        currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return NextResponse.json({ success: true, revenue: finalData });
    
  } catch (error) {
    console.error('Error fetching revenue data:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}