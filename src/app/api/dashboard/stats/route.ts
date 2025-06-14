// app/api/dashboard/stats/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/appointment';
import Customer from '@/models/customermodel';
import CustomerMembership from '@/models/customerMembership';
import Invoice from '@/models/invoice';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Parallel queries for better performance
    const [
      todayAppointments,
      totalCustomers,
      monthlyInvoices,
      activeMembers,
      pendingAppointments,
      completedToday,
      newCustomersThisMonth
    ] = await Promise.all([
      // Today's appointments
      Appointment.countDocuments({
        date: { $gte: startOfDay, $lt: endOfDay }
      }),
      
      // Total customers
      Customer.countDocuments({ isActive: true }),
      
      // Monthly revenue
      Invoice.aggregate([
        {
          $match: {
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
      
      // Active memberships
      CustomerMembership.countDocuments({
        status: 'Active',
        endDate: { $gte: today }
      }),
      
      // Pending appointments
      Appointment.countDocuments({
        date: { $gte: startOfDay },
        status: 'Scheduled'
      }),
      
      // Completed today
      Appointment.countDocuments({
        date: { $gte: startOfDay, $lt: endOfDay },
        status: { $in: ['Completed', 'Paid'] }
      }),
      
      // New customers this month
      Customer.countDocuments({
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
      })
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
      newCustomersThisMonth,
      avgSessionValue
    };

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}