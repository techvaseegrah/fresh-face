// src/app/api/reports/staff-sales-report/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Invoice from '@/models/invoice'; // Your Invoice model
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

// --- Type Definitions (Unchanged) ---
interface SaleDetail { name: string; quantity: number; price: number; }
interface DailyBreakdown { service: SaleDetail[]; product: SaleDetail[]; giftCard: SaleDetail[]; package: SaleDetail[]; membership: SaleDetail[]; }

// --- Timezone-Safe Date Formatter (Unchanged) ---
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
    
    // --- THIS IS THE NEW LOGIC TO HANDLE OLD, INCOMPLETE INVOICE DATA ---
    const aggregationPipeline = [
      // 1. Match invoices within the date range, for the correct tenant, and that are paid
      { 
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          createdAt: { $gte: startDate, $lte: endDate },
          paymentStatus: 'Paid',
        }
      },
      // 2. Deconstruct the lineItems array to process each item individually
      { 
        $unwind: '$lineItems' 
      },
      // 3. *** THE CRUCIAL FIX ***
      //    Create a new field `effectiveStaffId`.
      //    It checks if `lineItems.staffId` exists. If it does, use it.
      //    If it's MISSING (for your old data), it falls back to the main `stylistId` of the invoice.
      {
        $addFields: {
          'effectiveStaffId': {
            $ifNull: ['$lineItems.staffId', '$stylistId']
          }
        }
      },
      // 4. Filter out any sales that still don't have a staff ID after our fix
      {
        $match: {
          'effectiveStaffId': { $exists: true, $ne: null }
        }
      },
      // 5. Group by our new, reliable `effectiveStaffId` field
      { 
        $group: {
          _id: '$effectiveStaffId', // Group sales by the staff member
          service: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'service'] }, { $toDouble: '$lineItems.finalPrice' }, 0] } },
          product: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'product'] }, { $toDouble: '$lineItems.finalPrice' }, 0] } },
          giftCard: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'gift_card'] }, { $toDouble: '$lineItems.finalPrice' }, 0] } },
          package: { $sum: { $cond: [{ $eq: ['$lineItems.itemType', 'package'] }, { $toDouble: '$lineItems.finalPrice' }, 0] } },
          membership: { $sum: { $cond: [{ $and: [ { $eq: ['$lineItems.itemType', 'fee'] }, { $regexMatch: { input: '$lineItems.name', regex: /membership/i } } ] }, { $toDouble: '$lineItems.finalPrice' }, 0] } },
          // Collect all items for the daily breakdown view
          dailyBreakdownSource: { 
            $push: {
              date: "$createdAt",
              name: '$lineItems.name',
              quantity: '$lineItems.quantity',
              price: { $toDouble: '$lineItems.finalPrice' },
              type: '$lineItems.itemType'
            }
          }
        }
      },
      // 6. Look up staff details (this part is unchanged)
      { 
        $lookup: {
          from: 'staffs',
          localField: '_id',
          foreignField: '_id',
          as: 'staffInfo'
        }
      },
      // 7. Deconstruct the staffInfo array
      { 
        $unwind: {
          path: '$staffInfo',
          preserveNullAndEmptyArrays: true // Keep staff record even if lookup fails
        }
      },
      // 8. Project the final shape of the data
      { 
        $project: {
          _id: 0,
          staffId: '$_id',
          staffIdNumber: '$staffInfo.staffIdNumber',
          name: { $ifNull: ['$staffInfo.name', 'Unknown Staff'] }, // Handle cases where staff might be deleted
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

    // This part for processing the daily breakdown remains the same and is correct.
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