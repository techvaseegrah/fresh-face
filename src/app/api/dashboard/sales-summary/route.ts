// /app/api/dashboard/sales-summary/route.ts

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import Customer from '@/models/customermodel';
import Invoice from '@/models/invoice';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.DASHBOARD_READ)) { 
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, message: 'Start date and end date are required.' }, { status: 400 });
    }

    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);

    const matchStage = { $match: { createdAt: { $gte: start, $lte: end } } };

    const [invoiceReport, cancelledAppointments] = await Promise.all([
      Invoice.aggregate([
        matchStage,
        // --- STAGE 1: Pre-calculate values for each invoice BEFORE grouping ---
        {
          $addFields: {
            // Calculate true Service Gross from 'service' line items ONLY
            calculatedServiceGross: {
              $sum: {
                $map: {
                  input: { $filter: { input: "$lineItems", as: "item", cond: { $eq: ["$$item.itemType", "service"] } } },
                  as: "serviceItem",
                  in: "$$serviceItem.unitPrice"
                }
              }
            },
            // --- NEW: Calculate revenue from 'fee' items (Memberships) ---
            calculatedMembershipRevenue: {
              $sum: {
                $map: {
                  input: { $filter: { input: "$lineItems", as: "item", cond: { $eq: ["$$item.itemType", "fee"] } } },
                  as: "feeItem",
                  in: "$$feeItem.finalPrice" // Use finalPrice as this is pure revenue
                }
              }
            },
            calculatedTotalDiscount: {
              $add: [
                { $ifNull: ["$membershipDiscount", 0] },
                { $ifNull: ["$manualDiscount.appliedAmount", 0] }
              ]
            }
          }
        },
        // --- STAGE 2: Group and sum the pre-calculated values ---
        {
          $group: {
            _id: null,
            serviceBills: { $sum: { $cond: [{ $gt: ['$serviceTotal', 0] }, 1, 0] } },
            productBills: { $sum: { $cond: [{ $gt: ['$productTotal', 0] }, 1, 0] } },
            totalBills: { $sum: 1 },
            
            serviceGross: { $sum: "$calculatedServiceGross" },
            totalDiscount: { $sum: "$calculatedTotalDiscount" },
            membershipRevenue: { $sum: "$calculatedMembershipRevenue" },
            
            productGross: { $sum: '$productTotal' },
            grandTotalSum: { $sum: '$grandTotal' },
            cashTotal: { $sum: '$paymentDetails.cash' },
            cardTotal: { $sum: '$paymentDetails.card' },
            upiTotal: { $sum: '$paymentDetails.upi' },
            otherTotal: { $sum: '$paymentDetails.other' },
            uniqueCustomerIds: { $addToSet: '$customerId' }
          }
        },
        // --- STAGE 3: Project the final, correctly calculated fields ---
        {
          $project: {
            _id: 0,
            serviceBills: 1, productBills: 1, totalBills: 1,
            totalDiscount: 1, cashTotal: 1, cardTotal: 1, upiTotal: 1, otherTotal: 1, uniqueCustomerIds: 1,
            
            serviceGross: 1,
            productGross: 1,
            membershipRevenue: 1,
            grandTotalSum: 1,
            
            serviceNet: { $subtract: ["$serviceGross", "$totalDiscount"] },
            productNet: "$productGross",

            averageSale: { $cond: [{ $eq: ['$totalBills', 0] }, 0, { $divide: ['$grandTotalSum', '$totalBills'] }] },
          }
        }
      ]),
      Appointment.countDocuments({
        appointmentDateTime: { $gte: start, $lte: end },
        status: 'Cancelled'
      })
    ]);

    const stats = invoiceReport[0] || {};
    
    let genderData = { men: 0, women: 0 };
    if (stats.uniqueCustomerIds && stats.uniqueCustomerIds.length > 0) {
        const customers = await Customer.find({ _id: { $in: stats.uniqueCustomerIds } }).select('gender').lean();
        genderData = customers.reduce((acc, customer) => {
            if (customer.gender === 'male') acc.men++;
            if (customer.gender === 'female') acc.women++;
            return acc;
        }, { men: 0, women: 0 });
    }

    const finalReport = {
      serviceBills: stats.serviceBills || 0, productBills: stats.productBills || 0,
      serviceNet: stats.serviceNet || 0, serviceGross: stats.serviceGross || 0,
      productNet: stats.productNet || 0, productGross: stats.productGross || 0,
      men: genderData.men, women: genderData.women, noOfBills: stats.totalBills || 0,
      noOfCancelledBills: cancelledAppointments || 0, totalDiscount: stats.totalDiscount || 0,
      membershipRevenue: stats.membershipRevenue || 0,
      averageSale: stats.averageSale || 0,
      payments: { Cash: stats.cashTotal || 0, Card: stats.cardTotal || 0, Ewallet: (stats.upiTotal || 0) + (stats.otherTotal || 0) },
      ewalletBreakdown: { UPI: stats.upiTotal || 0, Other: stats.otherTotal || 0 }
    };
    
    return NextResponse.json({ success: true, data: finalReport });
  } catch (error: any) {
    console.error("API Error fetching sales summary:", error);
    return NextResponse.json({ success: false, message: "An internal server error occurred." }, { status: 500 });
  }
}