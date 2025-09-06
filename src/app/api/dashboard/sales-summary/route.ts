// /app/api/dashboard/sales-summary/route.ts - FINAL CORRECTED VERSION

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import Customer from '@/models/customermodel';
import Invoice from '@/models/invoice';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant';

/**
 * ===================================================================================
 *  GET: Handler to fetch a detailed sales summary for a given date range.
 * ===================================================================================
 */
export async function GET(req: NextRequest) {
  try {
    // --- Authentication, Authorization & Tenant Scoping ---
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.DASHBOARD_READ)) { 
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // --- Input Validation ---
    const { searchParams } = new URL(req.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!startDateStr || !endDateStr) {
      return NextResponse.json({ success: false, message: 'Start date and end date are required.' }, { status: 400 });
    }
    
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ success: false, message: 'Invalid date format provided.' }, { status: 400 });
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

    // --- Database Queries (Parallel Execution) ---
    const [invoiceReport, cancelledAppointments] = await Promise.all([
      Invoice.aggregate([
        {
          $match: { 
            tenantId: tenantObjectId,
            createdAt: { $gte: start, $lte: end } 
          } 
        },
        {
          $addFields: {
            calculatedServiceGross: { $sum: { $map: { input: { $filter: { input: "$lineItems", as: "item", cond: { $eq: ["$$item.itemType", "service"] } } }, as: "serviceItem", in: { $multiply: [ { $ifNull: ["$$serviceItem.unitPrice", 0] }, { $ifNull: ["$$serviceItem.quantity", 1] } ] } } } },
            calculatedMembershipRevenue: { $sum: { $map: { input: { $filter: { input: "$lineItems", as: "item", cond: { $eq: ["$$item.itemType", "fee"] } } }, as: "feeItem", in: { $ifNull: ["$$feeItem.finalPrice", 0] } } } },
            calculatedPackageRevenue: { $sum: { $map: { input: { $filter: { input: "$lineItems", as: "item", cond: { $eq: ["$$item.itemType", "package"] } } }, as: "packageItem", in: { $ifNull: ["$$packageItem.finalPrice", 0] } } } },
            // Adjusted to handle both 'gift_card' and 'giftcard' for safety
            calculatedGiftCardRevenue: { $sum: { $map: { input: { $filter: { input: "$lineItems", as: "item", cond: { $in: ["$$item.itemType", ["gift_card", "giftcard"]] } } }, as: "giftCardItem", in: { $ifNull: ["$$giftCardItem.finalPrice", 0] } } } },
            calculatedTotalDiscount: { $add: [ { $ifNull: ["$membershipDiscount", 0] }, { $ifNull: ["$manualDiscount.appliedAmount", 0] } ] }
          }
        },
        {
          $group: {
            _id: null,
            serviceBills: { $sum: { $cond: [{ $gt: ['$serviceTotal', 0] }, 1, 0] } },
            productBills: { $sum: { $cond: [{ $gt: ['$productTotal', 0] }, 1, 0] } },
            totalBills: { $sum: 1 },
            serviceGross: { $sum: "$calculatedServiceGross" },
            totalDiscount: { $sum: "$calculatedTotalDiscount" },
            membershipRevenue: { $sum: "$calculatedMembershipRevenue" },
            packageRevenue: { $sum: "$calculatedPackageRevenue" },
            giftCardRevenue: { $sum: "$calculatedGiftCardRevenue" },
            productGross: { $sum: '$productTotal' },
            grandTotalSum: { $sum: '$grandTotal' },
            cashTotal: { $sum: { $ifNull: ['$paymentDetails.cash', 0] } },
            cardTotal: { $sum: { $ifNull: ['$paymentDetails.card', 0] } },
            upiTotal: { $sum: { $ifNull: ['$paymentDetails.upi', 0] } },
            otherTotal: { $sum: { $ifNull: ['$paymentDetails.other', 0] } },
            // ================== THIS IS THE CRITICAL FIX ==================
            giftCardPaymentTotal: { $sum: { $ifNull: ['$giftCardPayment.amount', 0] } },
            // ==============================================================
            uniqueCustomerIds: { $addToSet: '$customerId' }
          }
        },
        {
          $project: {
            _id: 0,
            serviceBills: 1,
            productBills: 1,
            noOfBills: "$totalBills",
            totalDiscount: 1,
            uniqueCustomerIds: 1,
            serviceGross: 1,
            productGross: 1,
            membershipRevenue: 1,
            packageRevenue: 1,
            giftCardRevenue: 1,
            serviceNet: { $subtract: ["$serviceGross", "$totalDiscount"] },
            productNet: "$productGross",
            averageSale: { $cond: [ { $eq: ['$totalBills', 0] }, 0, { $divide: ['$grandTotalSum', '$totalBills'] } ] },
            // Structure the payments object correctly for the frontend
            payments: {
              Cash: "$cashTotal",
              Card: "$cardTotal",
              Ewallet: { $add: [{ $ifNull: ["$upiTotal", 0] }, { $ifNull: ["$otherTotal", 0] }] },
              GiftCard: "$giftCardPaymentTotal" // Include the redeemed gift card amount
            },
            ewalletBreakdown: {
              UPI: { $ifNull: ["$upiTotal", 0] },
              Other: { $ifNull: ["$otherTotal", 0] }
            }
          }
        }
      ]),
      Appointment.countDocuments({
        tenantId: tenantObjectId,
        appointmentDateTime: { $gte: start, $lte: end },
        status: 'Cancelled'
      })
    ]);

    // --- Data Processing & Formatting ---
    const stats = invoiceReport.length > 0 ? invoiceReport[0] : {
        // Provide a default empty structure if no invoices are found
        serviceBills: 0, productBills: 0, noOfBills: 0, totalDiscount: 0, serviceGross: 0,
        productGross: 0, membershipRevenue: 0, packageRevenue: 0, giftCardRevenue: 0,
        serviceNet: 0, productNet: 0, averageSale: 0,
        payments: { Cash: 0, Card: 0, Ewallet: 0, GiftCard: 0 },
        ewalletBreakdown: { UPI: 0, Other: 0 },
        uniqueCustomerIds: []
    };
    
    let genderData = { men: 0, women: 0 };
    if (stats.uniqueCustomerIds && stats.uniqueCustomerIds.length > 0) {
        const customers = await Customer.find({ _id: { $in: stats.uniqueCustomerIds } }).select('gender').lean();
        genderData = customers.reduce((acc, customer) => {
            if (customer.gender === 'male') acc.men++;
            if (customer.gender === 'female') acc.women++;
            return acc;
        }, { men: 0, women: 0 });
    }

    // Combine all stats into the final report
    const finalReport = {
        ...stats,
        men: genderData.men,
        women: genderData.women,
        noOfCancelledBills: cancelledAppointments || 0,
    };
    
    return NextResponse.json({ success: true, data: finalReport });

  } catch (error: any) {
    console.error("API Error: Failed to fetch sales summary.", { 
      errorMessage: error.message, 
      stack: error.stack 
    });
    return NextResponse.json({ success: false, message: "An internal server error occurred." }, { status: 500 });
  }
}