// /app/api/incentives/weekly-summary/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Invoice from '@/models/invoice';
import { getTenantIdOrBail } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        await dbConnect();
        const tenantId = getTenantIdOrBail(request as any);
        if (tenantId instanceof NextResponse) return tenantId;

        const { searchParams } = new URL(request.url);
        const staffId = searchParams.get('staffId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!staffId || !startDate || !endDate) {
            return NextResponse.json({ message: 'Staff ID, Start Date, and End Date are required.' }, { status: 400 });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        // Fetch all relevant data for the week in one go
        const sales = await DailySale.find({
            tenantId,
            staff: staffId,
            date: { $gte: start, $lte: end }
        }).lean();

        const invoices = await Invoice.find({
            tenantId,
            "lineItems.staffId": staffId,
            createdAt: { $gte: start, $lte: end }
        }).lean();

        // Initialize accumulators
        let totalGrossServiceSale = 0;
        let totalProductSale = 0;
        let totalPackageSale = 0;
        let totalGiftCardSale = 0;
        let totalReviewsWithName = 0;
        let totalReviewsWithPhoto = 0;
        let totalCustomerCount = 0;
        let totalDiscountShare = 0;

        // Calculate total share of discounts for the week
        for (const invoice of invoices) {
            const manualDiscountAmount = invoice.manualDiscount?.appliedAmount || 0;
            if (manualDiscountAmount <= 0) continue;

            let totalServiceValueOnInvoice = 0;
            let staffServiceValueOnInvoice = 0;

            for (const item of (invoice.lineItems || [])) {
                if (item.itemType === 'service') {
                    totalServiceValueOnInvoice += item.finalPrice;
                    if (item.staffId?.toString() === staffId) {
                        staffServiceValueOnInvoice += item.finalPrice;
                    }
                }
            }

            if (totalServiceValueOnInvoice > 0 && staffServiceValueOnInvoice > 0) {
                const staffShareOfDiscount = (manualDiscountAmount * staffServiceValueOnInvoice) / totalServiceValueOnInvoice;
                totalDiscountShare += staffShareOfDiscount;
            }
        }

        // Aggregate sales data from DailySale records
        for (const sale of sales) {
            totalGrossServiceSale += sale.serviceSale || 0;
            totalProductSale += sale.productSale || 0;
            totalPackageSale += sale.packageSale || 0;
            totalGiftCardSale += sale.giftCardSale || 0;
            totalReviewsWithName += sale.reviewsWithName || 0;
            totalReviewsWithPhoto += sale.reviewsWithPhoto || 0;
            totalCustomerCount += sale.customerCount || 0;
        }
        
        const totalNetServiceSale = totalGrossServiceSale - totalDiscountShare;

        const summary = {
            totalNetServiceSale,
            totalProductSale,
            totalPackageSale,
            totalGiftCardSale,
            totalReviewsWithName,
            totalReviewsWithPhoto,
            totalCustomerCount,
        };

        return NextResponse.json({ success: true, data: summary });

    } catch (error: any) {
        console.error("API GET /api/incentives/weekly-summary Error:", error);
        return NextResponse.json({ message: 'An internal server error occurred', error: error.message }, { status: 500 });
    }
}