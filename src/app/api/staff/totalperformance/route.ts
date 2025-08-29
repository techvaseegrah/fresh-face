import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { getTenantIdOrBail } from '@/lib/tenant';
// --- NEW: Import the IncentivePayout model ---
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
    // --- UPDATED: Read startDate and endDate instead of month and year ---
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const staffId = searchParams.get('staffId');

    // --- UPDATED: Validation for new date parameters ---
    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ success: false, message: 'startDate and endDate query parameters are required.' }, { status: 400 });
    }

    // --- UPDATED: Create Date objects directly from parameters ---
    // The new Date() constructor correctly parses "YYYY-MM-DD" format.
    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);
    // Set time to the end of the day to ensure all records on the endDate are included.
    endDate.setHours(23, 59, 59, 999);


    // ====================================================================
    // --- Logic for single staff details (for the side panel) ---
    // ====================================================================
    if (staffId) {
      if (!mongoose.Types.ObjectId.isValid(staffId)) {
        return NextResponse.json({ success: false, message: 'Invalid Staff ID format.' }, { status: 400 });
      }

      const objectIdTenantId = new mongoose.Types.ObjectId(tenantId);
      const objectIdStaffId = new mongoose.Types.ObjectId(staffId);

      // --- MODIFIED: Fetch daily records and payouts in parallel ---
      // This logic now works correctly with the updated startDate and endDate
      const [dailyRecords, payouts] = await Promise.all([
        DailySale.find({
          tenantId: objectIdTenantId,
          staff: objectIdStaffId,
          date: { $gte: startDate, $lte: endDate }
        }).sort({ date: -1 }).lean(),
        IncentivePayout.find({
          tenantId: objectIdTenantId,
          staff: objectIdStaffId,
        }).sort({ payoutDate: -1 }).lean()
      ]);

      // --- NEW: Calculate total amount paid out ---
      const totalPaid = payouts.reduce((sum, p) => sum + p.amount, 0);

      const details = dailyRecords.map(record => ({
        date: record.date.toISOString(),
        serviceSales: record.serviceSale || 0,
        productSales: record.productSale || 0,
        customersServed: record.customerCount || 0,
        rating: 0,
      }));

      // --- MODIFIED: Return details and the new payout data ---
      return NextResponse.json({
        success: true,
        details: details,
        payouts: {
          history: payouts,
          totalPaid: totalPaid
        }
      });
    }

    // ====================================================================
    // --- Logic for monthly summary (for the main page) ---
    // ====================================================================
    // This aggregation pipeline also works correctly with the updated startDate and endDate
    const staffPerformance = await DailySale.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate }, tenantId: new mongoose.Types.ObjectId(tenantId) } },
      { $group: { _id: '$staff', totalSales: { $sum: { $add: ['$serviceSale', '$productSale'] } }, totalServiceSales: { $sum: '$serviceSale' }, totalProductSales: { $sum: '$productSale' }, totalCustomers: { $sum: '$customerCount' } } },
      { $lookup: { from: 'staffs', localField: '_id', foreignField: '_id', as: 'staffDetails' } },
      { $unwind: { path: '$staffDetails', preserveNullAndEmptyArrays: true } },
      { $match: { 'staffDetails._id': { $exists: true } } },
      { $project: { _id: 0, staffId: '$staffDetails._id', staffIdNumber: '$staffDetails.staffIdNumber', name: '$staffDetails.name', position: '$staffDetails.position', image: '$staffDetails.image', sales: '$totalSales', totalServiceSales: '$totalServiceSales', totalProductSales: '$totalProductSales', customers: '$totalCustomers', rating: { $round: [ { $let: { vars: { salaryAsNumber: { $ifNull: ['$staffDetails.salary', 0] }, actualSales: { $ifNull: ['$totalSales', 0] } }, in: { $let: { vars: { monthlyTarget: { $max: [1, { $multiply: ['$$salaryAsNumber', MONTHLY_TARGET_MULTIPLIER] }] } }, in: { $cond: { if: { $eq: ['$$actualSales', 0] }, then: 0, else: { $min: [ 10, { $multiply: [{ $divide: ['$$actualSales', '$$monthlyTarget'] }, 5] } ] } } } } } } }, 1 ] } } },
      { $sort: { name: 1 } }
    ]);

    // --- NEW CHANGE [1/2]: Calculate the total payouts for the summary card ---
    const totalPayoutsAggregation = await IncentivePayout.aggregate([
        { 
            $match: { 
                tenantId: new mongoose.Types.ObjectId(tenantId),
                payoutDate: { $gte: startDate, $lte: endDate }
            }
        },
        { 
            $group: { 
                _id: null, 
                total: { $sum: '$amount' }
            }
        }
    ]);
    
    const totalPayouts = totalPayoutsAggregation.length > 0 ? totalPayoutsAggregation[0].total : 0;


    const summary = staffPerformance.reduce((acc, staff) => { acc.revenueGenerated += staff.sales; acc.totalCustomers += staff.customers; if (staff.rating > 0) { acc.totalRatingPoints += staff.rating; acc.validRatingsCount += 1; } return acc; }, { revenueGenerated: 0, totalCustomers: 0, totalRatingPoints: 0, validRatingsCount: 0 });
    const overallAverageRating = summary.validRatingsCount > 0 ? (summary.totalRatingPoints / summary.validRatingsCount) : 0;

    // --- NEW CHANGE [2/2]: Add totalPayouts to the summary object in the response ---
    return NextResponse.json({ 
        success: true, 
        summary: { 
            averageRating: parseFloat(overallAverageRating.toFixed(1)), 
            totalCustomers: summary.totalCustomers, 
            revenueGenerated: summary.revenueGenerated, 
            avgServiceQuality: parseFloat(overallAverageRating.toFixed(1)),
            totalPayouts: totalPayouts // <-- This is the new field
        }, 
        staffPerformance: staffPerformance 
    });
  } catch (error: any) {
    console.error("API GET /performance Error:", error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred', error: error.message }, { status: 500 });
  }
}