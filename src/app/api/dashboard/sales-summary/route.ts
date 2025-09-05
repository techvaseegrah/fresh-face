// /app/api/dashboard/sales-summary/route.ts - MULTI-TENANT REFACTORED AND CORRECTED VERSION

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
 *  - This endpoint is protected and requires DASHBOARD_READ permission.
 *  - It is multi-tenant aware and scopes all data to the authenticated user's tenant.
 *  - It calculates key metrics like revenue, discounts, payment breakdowns, and customer demographics.
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
    // For optimal performance, ensure a compound index exists on the invoices collection:
    // db.invoices.createIndex({ tenantId: 1, createdAt: 1 })
    const [invoiceReport, cancelledAppointments] = await Promise.all([
      Invoice.aggregate([
        // STAGE 1: Filter documents to the specified tenant and date range.
        {
          $match: { 
            tenantId: tenantObjectId,
            createdAt: { $gte: start, $lte: end } 
          } 
        },
        // STAGE 2: Pre-calculate values for each invoice before grouping.
        {
          $addFields: {
            // BUG FIX: Correctly calculate Service Gross by multiplying unitPrice by quantity.
            calculatedServiceGross: {
              $sum: {
                $map: {
                  input: { $filter: { input: "$lineItems", as: "item", cond: { $eq: ["$$item.itemType", "service"] } } },
                  as: "serviceItem",
                  in: { 
                    $multiply: [
                      { $ifNull: ["$$serviceItem.unitPrice", 0] }, 
                      { $ifNull: ["$$serviceItem.quantity", 1] }
                    ] 
                  }
                }
              }
            },
            calculatedMembershipRevenue: {
              $sum: {
                $map: {
                  input: { $filter: { input: "$lineItems", as: "item", cond: { $eq: ["$$item.itemType", "fee"] } } },
                  as: "feeItem",
                  in: "$$feeItem.finalPrice"
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
        // STAGE 3: Group all matching invoices into a single summary document.
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
            cashTotal: { $sum: { $ifNull: ['$paymentDetails.cash', 0] } },
            cardTotal: { $sum: { $ifNull: ['$paymentDetails.card', 0] } },
            upiTotal: { $sum: { $ifNull: ['$paymentDetails.upi', 0] } },
            otherTotal: { $sum: { $ifNull: ['$paymentDetails.other', 0] } },
            uniqueCustomerIds: { $addToSet: '$customerId' }
          }
        },
        // STAGE 4: Project the final fields and calculate derived values.
        {
          $project: {
            _id: 0,
            serviceBills: 1,
            productBills: 1,
            totalBills: 1,
            totalDiscount: 1,
            cashTotal: 1,
            cardTotal: 1,
            upiTotal: 1,
            otherTotal: 1,
            uniqueCustomerIds: 1,
            serviceGross: 1,
            productGross: 1,
            membershipRevenue: 1,
            grandTotalSum: 1, // This is the sum of all final bills, i.e., Total Revenue
            serviceNet: { $subtract: ["$serviceGross", "$totalDiscount"] },
            productNet: "$productGross", // Assuming no discounts on products for now
            averageSale: { 
              $cond: [
                { $eq: ['$totalBills', 0] }, 
                0, 
                { $divide: ['$grandTotalSum', '$totalBills'] }
              ] 
            },
          }
        }
      ]),
      // Count cancelled appointments within the same tenant and date range.
      Appointment.countDocuments({
        tenantId: tenantObjectId,
        appointmentDateTime: { $gte: start, $lte: end },
        status: 'Cancelled'
      })
    ]);

    // --- Data Processing & Formatting ---
    const stats = invoiceReport.length > 0 ? invoiceReport[0] : {};
    
    let genderData = { men: 0, women: 0 };
    if (stats.uniqueCustomerIds && stats.uniqueCustomerIds.length > 0) {
        // This query is tenant-safe because customer IDs are sourced from tenant-scoped invoices.
        const customers = await Customer.find({ _id: { $in: stats.uniqueCustomerIds } }).select('gender').lean();
        genderData = customers.reduce((acc, customer) => {
            if (customer.gender === 'male') acc.men++;
            if (customer.gender === 'female') acc.women++;
            return acc;
        }, { men: 0, women: 0 });
    }

    // Construct the final JSON response payload.
    const finalReport = {
      totalRevenue: stats.grandTotalSum || 0,
      serviceBills: stats.serviceBills || 0,
      productBills: stats.productBills || 0,
      serviceNet: stats.serviceNet || 0,
      serviceGross: stats.serviceGross || 0,
      productNet: stats.productNet || 0,
      productGross: stats.productGross || 0,
      men: genderData.men,
      women: genderData.women,
      noOfBills: stats.totalBills || 0,
      noOfCancelledBills: cancelledAppointments || 0,
      totalDiscount: stats.totalDiscount || 0,
      membershipRevenue: stats.membershipRevenue || 0,
      averageSale: stats.averageSale || 0,
      payments: {
        Cash: stats.cashTotal || 0,
        Card: stats.cardTotal || 0,
        Ewallet: (stats.upiTotal || 0) + (stats.otherTotal || 0)
      },
      ewalletBreakdown: {
        UPI: stats.upiTotal || 0,
        Other: stats.otherTotal || 0
      }
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