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

    // ✨ --- THIS IS THE FIX --- ✨
    // This pipeline now correctly calculates the discount share by only considering services.
    const manualDiscountsPipeline = [
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), paymentStatus: 'Paid', 'manualDiscount.appliedAmount': { $gt: 0 } }},
      { $lookup: { from: 'appointments', localField: 'appointmentId', foreignField: '_id', as: 'appointmentInfo' }},
      { $unwind: '$appointmentInfo' },
      { $match: { 'appointmentInfo.appointmentDateTime': { $gte: startDate, $lte: endDate } }},
      { $unwind: '$lineItems' },
      { $addFields: { 'effectiveStaffId': { $ifNull: ['$lineItems.staffId', '$stylistId'] } }},
      { $match: { 'effectiveStaffId': { $exists: true, $ne: null } }},
      {
        $group: {
            _id: '$_id',
            manualDiscountAmount: { $first: '$manualDiscount.appliedAmount' },
            items: { $push: { staffId: '$effectiveStaffId', itemType: '$lineItems.itemType', price: { $toDouble: '$lineItems.finalPrice' } } }
        }
      },
      {
        $addFields: {
            totalServiceValue: {
                $reduce: {
                    input: '$items',
                    initialValue: 0,
                    in: { $add: [ '$$value', { $cond: [{ $eq: ['$$this.itemType', 'service'] }, '$$this.price', 0] } ] }
                }
            }
        }
      },
      { $unwind: '$items' },
      {
        $project: {
            _id: 0,
            staffId: '$items.staffId',
            distributedDiscount: {
                $cond: [
                    { $and: [ { $eq: ['$items.itemType', 'service'] }, { $gt: ['$totalServiceValue', 0] }] },
                    { $multiply: [ '$manualDiscountAmount', { $divide: ['$items.price', '$totalServiceValue'] }] },
                    0
                ]
            }
        }
      },
      {
        $group: {
            _id: '$staffId',
            totalManualDiscount: { $sum: '$distributedDiscount' }
        }
      },
      { $project: { _id: 0, staffId: '$_id', totalManualDiscount: '$totalManualDiscount' }}
    ];

    const staffSales = await Invoice.aggregate(mainSalesPipeline);
    const manualDiscountsByStaff = await Invoice.aggregate(manualDiscountsPipeline);
    
    const salesMap = new Map(staffSales.map(s => [s.staffId.toString(), s]));

    for (const discount of manualDiscountsByStaff) {
      const staffId = discount.staffId.toString();
      if (salesMap.has(staffId) && discount.totalManualDiscount > 0) {
        const staffData = salesMap.get(staffId)!;
        const manualDiscountShare = discount.totalManualDiscount;
        
        staffData.totalDiscount += manualDiscountShare;
        staffData.service -= manualDiscountShare;
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
        
        const finalTotalSales = (staff.totalSales || 0) - (staff.totalDiscount || 0);
        
        return { ...staff, totalSales: finalTotalSales, dailyBreakdown };
    }).sort((a,b) => b.totalSales - a.totalSales);
    
    return NextResponse.json({ success: true, data: reportData });

  } catch (error: any) {
    console.error("API Error fetching staff-wise sales report:", error);
    return NextResponse.json({ success: false, message: error.message || 'An internal server error occurred' }, { status: 500 });
  }
}