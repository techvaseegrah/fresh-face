// /api/performance/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Invoice from '@/models/invoice';
import Staff from '@/models/staff';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { getTenantIdOrBail } from '@/lib/tenant';
import IncentivePayout from '@/models/IncentivePayout';

const MONTHLY_TARGET_MULTIPLIER = 3.0;

export async function GET(request: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) {
        return tenantId;
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const staffId = searchParams.get('staffId');

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ success: false, message: 'startDate and endDate query parameters are required.' }, { status: 400 });
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);
    endDate.setHours(23, 59, 59, 999);
    
    const objectIdTenantId = new mongoose.Types.ObjectId(tenantId);

    // ====================================================================
    // --- Logic for single staff details (for the side panel) ---
    // ====================================================================
    if (staffId) {
      if (!mongoose.Types.ObjectId.isValid(staffId)) {
        return NextResponse.json({ success: false, message: 'Invalid Staff ID format.' }, { status: 400 });
      }
      
      const objectIdStaffId = new mongoose.Types.ObjectId(staffId);

      const staffInvoices = await Invoice.find({
          tenantId: objectIdTenantId,
          'lineItems.staffId': objectIdStaffId,
          createdAt: { $gte: startDate, $lte: endDate },
          paymentStatus: 'Paid'
      }).lean();

      const salesByDay = new Map<string, { serviceSales: number, productSales: number, packageSales: number, giftCardSales: number, customersServed: number }>();

      for (const invoice of staffInvoices) {
          const dateStr = invoice.createdAt.toISOString().split('T')[0];
          if (!salesByDay.has(dateStr)) {
              salesByDay.set(dateStr, { serviceSales: 0, productSales: 0, packageSales: 0, giftCardSales: 0, customersServed: 0 });
          }
          const dayTotals = salesByDay.get(dateStr)!;

          const customersInInvoiceForDay = new Set<string>();
          for (const item of invoice.lineItems) {
              if (item.staffId?.toString() === staffId) {
                  if (item.itemType === 'service') dayTotals.serviceSales += item.finalPrice;
                  else if (item.itemType === 'product') dayTotals.productSales += item.finalPrice;
                  else if (item.itemType === 'package') dayTotals.packageSales += item.finalPrice;
                  else if (item.itemType === 'gift_card') dayTotals.giftCardSales += item.finalPrice;
                  customersInInvoiceForDay.add(invoice.customerId.toString());
              }
          }
          dayTotals.customersServed = customersInInvoiceForDay.size;
      }
      
      const details = Array.from(salesByDay.entries()).map(([date, totals]) => ({
          date: new Date(date).toISOString(),
          ...totals,
          rating: 0,
      }));

      const payouts = await IncentivePayout.find({ tenantId: objectIdTenantId, staff: objectIdStaffId, status: 'approved' }).lean();
      const totalPaid = payouts.reduce((sum, p) => sum + p.amount, 0);

      return NextResponse.json({
        success: true,
        details: details,
        payouts: { history: payouts, totalPaid: totalPaid }
      });
    }

    // ====================================================================
    // --- Logic for monthly summary (for the main page) ---
    // ====================================================================
    // ✅ THE FIX: This is a robust aggregation pipeline that mirrors your original, working logic.
    // It safely handles cases where staff may have been deleted.
    const staffPerformance = await Invoice.aggregate([
      { 
        $match: { 
          createdAt: { $gte: startDate, $lte: endDate }, 
          tenantId: objectIdTenantId,
          paymentStatus: 'Paid' 
        } 
      },
      { $unwind: '$lineItems' },
      { $match: { 'lineItems.staffId': { $exists: true, $ne: null } } },
      { 
        $group: { 
          _id: '$lineItems.staffId', 
          totalSales: { $sum: '$lineItems.finalPrice' }, 
          totalServiceSales: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'service'] }, '$lineItems.finalPrice', 0] } },
          totalProductSales: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'product'] }, '$lineItems.finalPrice', 0] } },
          uniqueCustomers: { $addToSet: '$customerId' }
        } 
      },
      { 
        $lookup: { 
          from: 'staffs', 
          localField: '_id', 
          foreignField: '_id', 
          as: 'staffDetails' 
        } 
      },
      // This is the safer way to handle lookups
      { $unwind: { path: '$staffDetails', preserveNullAndEmptyArrays: true } },
      // This ensures we only include results for staff that still exist in the database
      { $match: { 'staffDetails._id': { $exists: true } } },
      { 
        $project: { 
          _id: 0, 
          staffId: '$staffDetails._id', 
          staffIdNumber: '$staffDetails.staffIdNumber', 
          name: '$staffDetails.name', 
          position: '$staffDetails.position', 
          image: '$staffDetails.image', 
          sales: '$totalSales', 
          totalServiceSales: '$totalServiceSales', 
          totalProductSales: '$totalProductSales', 
          customers: { $size: '$uniqueCustomers' },
           rating: { $round: [ { $let: { vars: { salaryAsNumber: { $ifNull: ['$staffDetails.salary', 0] }, actualSales: { $ifNull: ['$totalSales', 0] } }, in: { $let: { vars: { monthlyTarget: { $max: [1, { $multiply: ['$$salaryAsNumber', MONTHLY_TARGET_MULTIPLIER] }] } }, in: { $cond: { if: { $eq: ['$$actualSales', 0] }, then: 0, else: { $min: [ 10, { $multiply: [{ $divide: ['$$actualSales', '$$monthlyTarget'] }, 5] } ] } } } } } } }, 1 ] }
        } 
      },
      { $sort: { name: 1 } }
    ]);
    
    const summary = staffPerformance.reduce((acc, staff) => {
        acc.revenueGenerated += staff.sales;
        acc.totalCustomers += staff.customers;
        if (staff.rating > 0) {
            acc.totalRatingPoints += staff.rating;
            acc.validRatingsCount += 1;
        }
        return acc;
    }, { revenueGenerated: 0, totalCustomers: 0, totalRatingPoints: 0, validRatingsCount: 0 });

    const overallAverageRating = summary.validRatingsCount > 0 ? (summary.totalRatingPoints / summary.validRatingsCount) : 0;
    
    const totalPayoutsAggregation = await IncentivePayout.aggregate([
        { $match: { tenantId: objectIdTenantId, processedDate: { $gte: startDate, $lte: endDate }, status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalPayouts = totalPayoutsAggregation.length > 0 ? totalPayoutsAggregation[0].total : 0;

    return NextResponse.json({ 
        success: true, 
        summary: { 
            averageRating: parseFloat(overallAverageRating.toFixed(1)), 
            totalCustomers: summary.totalCustomers, 
            revenueGenerated: summary.revenueGenerated, 
            avgServiceQuality: parseFloat(overallAverageRating.toFixed(1)),
            totalPayouts: totalPayouts
        }, 
        staffPerformance: staffPerformance 
    });
  } catch (error: any) {
    console.error("API GET /performance Error:", error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred', error: error.message }, { status: 500 });
  }
}