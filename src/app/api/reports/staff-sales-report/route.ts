// /api/reports/staff-sales-report/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Invoice from '@/models/invoice';
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';
import Appointment from '@/models/Appointment';

export const dynamic = 'force-dynamic';

interface SaleDetail { name: string; quantity: number; price: number; }
interface DailyBreakdown { service: SaleDetail[]; product: SaleDetail[]; giftCard: SaleDetail[]; package: SaleDetail[]; membership: SaleDetail[]; }

const toTenantLocalDateString = (date: Date): string => {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Kolkata' }).format(date);
};

export async function GET(request: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) return tenantId;
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ success: false, message: 'Start and end date are required.' }, { status: 400 });
    }

    const startDate = new Date(startDateParam);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(endDateParam);
    endDate.setUTCHours(23, 59, 59, 999);
    
    // --- AGGREGATION 1: Main sales and per-item data (Unchanged) ---
    const mainSalesPipeline = [
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), paymentStatus: 'Paid' } },
      { $lookup: { from: 'appointments', localField: 'appointmentId', foreignField: '_id', as: 'appointmentInfo' } },
      { $unwind: '$appointmentInfo' },
      { $match: { 'appointmentInfo.appointmentDateTime': { $gte: startDate, $lte: endDate } } },
      { $unwind: '$lineItems' },
      { $addFields: { 'effectiveStaffId': { $ifNull: ['$lineItems.staffId', '$stylistId'] } } },
      { $match: { 'effectiveStaffId': { $exists: true, $ne: null } } },
      { 
        $group: {
          _id: '$effectiveStaffId',
          uniqueInvoices: { $addToSet: '$_id' },
          service: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'service'] }, { $toDouble: '$lineItems.finalPrice' }, 0] } },
          product: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'product'] }, { $toDouble: '$lineItems.finalPrice' }, 0] } },
          giftCard: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'gift_card'] }, { $toDouble: '$lineItems.finalPrice' }, 0] } },
          package: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'package'] }, { $toDouble: '$lineItems.finalPrice' }, 0] } },
          membership: { $sum: { $cond: [{ $and: [ { $eq: ['$lineItems.itemType', 'fee'] }, { $regexMatch: { input: '$lineItems.name', regex: /membership/i } } ] }, { $toDouble: '$lineItems.finalPrice' }, 0] } },
          serviceCount: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'service'] }, '$lineItems.quantity', 0] } },
          productCount: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'product'] }, '$lineItems.quantity', 0] } },
          membershipCount: { $sum: { $cond: [{ $and: [ { $eq: ['$lineItems.itemType', 'fee'] }, { $regexMatch: { input: '$lineItems.name', regex: /membership/i } } ] }, '$lineItems.quantity', 0] } },
          totalLineItemDiscount: { $sum: { $ifNull: [ { $toDouble: '$lineItems.discount' }, 0 ] } },
          dailyBreakdownSource: { 
            $push: {
              date: "$appointmentInfo.appointmentDateTime", name: '$lineItems.name', quantity: '$lineItems.quantity',
              price: { $toDouble: '$lineItems.finalPrice' }, type: '$lineItems.itemType'
            }
          }
        }
      },
      { $lookup: { from: 'staffs', localField: '_id', foreignField: '_id', as: 'staffInfo' } },
      { $unwind: { path: '$staffInfo', preserveNullAndEmptyArrays: true } },
      { 
        $project: {
          _id: 0, staffId: '$_id', staffIdNumber: '$staffInfo.staffIdNumber',
          name: { $ifNull: ['$staffInfo.name', 'Unknown Staff'] },
          billCount: { $size: '$uniqueInvoices' }, serviceCount: '$serviceCount', productCount: '$productCount',
          membershipCount: '$membershipCount', totalDiscount: '$totalLineItemDiscount',
          service: '$service', product: '$product', giftCard: '$giftCard', package: '$package', membership: '$membership',
          totalSales: { $add: ['$service', '$product', '$giftCard', '$package', '$membership'] },
          dailyBreakdownSource: '$dailyBreakdownSource'
        }
      }
    ];

    // --- AGGREGATION 2: CORRECTED LOGIC TO DISTRIBUTE MANUAL DISCOUNT TO SERVICE STAFF ---
    const manualDiscountsPipeline = [
      // 1. Find invoices with a manual discount in the date range
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), paymentStatus: 'Paid', 'manualDiscount.appliedAmount': { $gt: 0 } }},
      { $lookup: { from: 'appointments', localField: 'appointmentId', foreignField: '_id', as: 'appointmentInfo' }},
      { $unwind: '$appointmentInfo' },
      { $match: { 'appointmentInfo.appointmentDateTime': { $gte: startDate, $lte: endDate } }},
      // 2. Unwind items to find all staff involved and their contribution value
      { $unwind: '$lineItems' },
      { $addFields: { 'effectiveStaffId': { $ifNull: ['$lineItems.staffId', '$stylistId'] } }},
      { $match: { 'effectiveStaffId': { $exists: true, $ne: null } }},
      // 3. Group by invoice and staff to get the value of work done by each staff on that invoice
      { $group: {
          _id: { invoiceId: '$_id', staffId: '$effectiveStaffId' },
          valueByStaff: { $sum: { $toDouble: '$lineItems.finalPrice' } },
          manualDiscountAmount: { $first: '$manualDiscount.appliedAmount' },
          invoiceSubtotal: { $first: '$subtotal' }
      }},
      // 4. Group again by just the invoice to collect all staff contributions for that invoice
      { $group: {
          _id: '$_id.invoiceId',
          staffContributions: { $push: { staffId: '$_id.staffId', value: '$valueByStaff' } },
          manualDiscountAmount: { $first: '$manualDiscountAmount' },
          invoiceSubtotal: { $first: '$invoiceSubtotal' }
      }},
      // 5. Unwind the contributions to calculate each staff's pro-rata share
      { $unwind: '$staffContributions' },
      // 6. Calculate the distributed discount amount for each staff member
      { $project: {
          _id: 0,
          staffId: '$staffContributions.staffId',
          distributedDiscount: {
            $cond: [
              { $eq: ['$invoiceSubtotal', 0] }, 0, // Avoid division by zero
              { $multiply: [ '$manualDiscountAmount', { $divide: ['$staffContributions.value', '$invoiceSubtotal'] }] }
            ]
          }
      }},
      // 7. Final group by staff to sum all their shares from all invoices
      { $group: {
          _id: '$staffId',
          totalManualDiscount: { $sum: '$distributedDiscount' }
      }},
      { $project: { _id: 0, staffId: '$_id', totalManualDiscount: '$totalManualDiscount' }}
    ];

    const staffSales = await Invoice.aggregate(mainSalesPipeline);
    const manualDiscountsByStaff = await Invoice.aggregate(manualDiscountsPipeline);
    
    // --- MERGE THE RESULTS ---
    const salesMap = new Map(staffSales.map(s => [s.staffId.toString(), s]));

    for (const discount of manualDiscountsByStaff) {
      const staffId = discount.staffId.toString();
      if (salesMap.has(staffId)) {
        const staffData = salesMap.get(staffId)!;
        staffData.totalDiscount += discount.totalManualDiscount; // Add the manual discount share
      }
    }
    
    let combinedReportData = Array.from(salesMap.values());

    const reportData = combinedReportData.map(staff => {
        const dailyBreakdown: Record<string, DailyBreakdown> = {};
        if (staff.dailyBreakdownSource) {
            staff.dailyBreakdownSource.forEach((item: any) => {
                const itemDate = toTenantLocalDateString(new Date(item.date));
                if (!dailyBreakdown[itemDate]) {
                    dailyBreakdown[itemDate] = { service: [], product: [], giftCard: [], package: [], membership: [] };
                }
                const saleDetail = { name: item.name, quantity: item.quantity, price: item.price };
                
                if(item.type === 'service') dailyBreakdown[itemDate].service.push(saleDetail);
                else if(item.type === 'product') dailyBreakdown[itemDate].product.push(saleDetail);
                else if(item.type === 'gift_card') dailyBreakdown[itemDate].giftCard.push(saleDetail);
                else if(item.type === 'package') dailyBreakdown[itemDate].package.push(saleDetail);
                else if(item.type === 'fee' && item.name.toLowerCase().includes('membership')) dailyBreakdown[itemDate].membership.push(saleDetail);
            });
            delete staff.dailyBreakdownSource;
        }
        return { ...staff, dailyBreakdown };
    }).sort((a,b) => b.totalSales - a.totalSales);
    
    return NextResponse.json({ success: true, data: reportData });

  } catch (error: any) {
    console.error("API Error fetching staff-wise sales report:", error);
    return NextResponse.json({ success: false, message: error.message || 'An internal server error occurred' }, { status: 500 });
  }
}