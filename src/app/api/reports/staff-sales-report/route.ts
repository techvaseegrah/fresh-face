// src/app/api/reports/staff-sales-report/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Invoice from '@/models/invoice'; // Your Invoice model
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';
import Appointment from '@/models/Appointment'; // <<< ADD THIS IMPORT

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
    
    // --- THIS IS THE NEW, CORRECTED LOGIC ---
    const aggregationPipeline = [
      // 1. Match invoices by tenant and payment status first (more efficient)
      { 
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          paymentStatus: 'Paid',
        }
      },
      // 2. <<< NEW: Look up the associated appointment for each invoice
      {
        $lookup: {
          from: 'appointments', // The collection name for Appointments
          localField: 'appointmentId',
          foreignField: '_id',
          as: 'appointmentInfo'
        }
      },
      // 3. <<< NEW: Deconstruct the appointmentInfo array and remove invoices without a valid appointment
      {
        $unwind: '$appointmentInfo'
      },
      // 4. <<< NEW: Filter by the APPOINTMENT's date, not the invoice's creation date
      {
        $match: {
          'appointmentInfo.appointmentDateTime': { $gte: startDate, $lte: endDate }
        }
      },
      // 5. Deconstruct the lineItems array to process each item individually
      { 
        $unwind: '$lineItems' 
      },
      // 6. Create `effectiveStaffId` to handle old data (your existing logic, which is good)
      {
        $addFields: {
          'effectiveStaffId': {
            $ifNull: ['$lineItems.staffId', '$stylistId']
          }
        }
      },
      // 7. Filter out any sales that still don't have a staff ID
      {
        $match: {
          'effectiveStaffId': { $exists: true, $ne: null }
        }
      },
      // 8. Group by staff, calculate totals, and count unique bills
      { 
        $group: {
          _id: '$effectiveStaffId',
          uniqueInvoices: { $addToSet: '$_id' }, // For bill count
          service: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'service'] }, { $toDouble: '$lineItems.finalPrice' }, 0] } },
          product: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'product'] }, { $toDouble: '$lineItems.finalPrice' }, 0] } },
          giftCard: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'gift_card'] }, { $toDouble: '$lineItems.finalPrice' }, 0] } },
          package: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'package'] }, { $toDouble: '$lineItems.finalPrice' }, 0] } },
          membership: { $sum: { $cond: [{ $and: [ { $eq: ['$lineItems.itemType', 'fee'] }, { $regexMatch: { input: '$lineItems.name', regex: /membership/i } } ] }, { $toDouble: '$lineItems.finalPrice' }, 0] } },
          dailyBreakdownSource: { 
            $push: {
              date: "$appointmentInfo.appointmentDateTime", // Use appointment date for breakdown
              name: '$lineItems.name',
              quantity: '$lineItems.quantity',
              price: { $toDouble: '$lineItems.finalPrice' },
              type: '$lineItems.itemType'
            }
          }
        }
      },
      // 9. Look up staff details
      { 
        $lookup: {
          from: 'staffs',
          localField: '_id',
          foreignField: '_id',
          as: 'staffInfo'
        }
      },
      // 10. Deconstruct the staffInfo array
      { 
        $unwind: {
          path: '$staffInfo',
          preserveNullAndEmptyArrays: true 
        }
      },
      // 11. Project the final shape of the data
      { 
        $project: {
          _id: 0,
          staffId: '$_id',
          staffIdNumber: '$staffInfo.staffIdNumber',
          name: { $ifNull: ['$staffInfo.name', 'Unknown Staff'] },
          billCount: { $size: '$uniqueInvoices' }, // Calculate bill count
          service: '$service',
          product: '$product',
          giftCard: '$giftCard',
          package: '$package',
          membership: '$membership',
          totalSales: { $add: ['$service', '$product', '$giftCard', '$package', '$membership'] },
          dailyBreakdownSource: '$dailyBreakdownSource'
        }
      }
    ];

    const staffSales = await Invoice.aggregate(aggregationPipeline);

    // This part for processing the daily breakdown remains the same.
    const reportData = staffSales.map(staff => {
        const dailyBreakdown: Record<string, DailyBreakdown> = {};
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
        return { ...staff, dailyBreakdown };
    }).sort((a,b) => b.totalSales - a.totalSales);
    
    return NextResponse.json({ success: true, data: reportData });

  } catch (error: any) {
    console.error("API Error fetching staff-wise sales report:", error);
    return NextResponse.json({ success: false, message: error.message || 'An internal server error occurred' }, { status: 500 });
  }
}