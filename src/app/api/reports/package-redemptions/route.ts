// src/app/api/reports/package-redemptions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import { safeDecrypt } from '@/lib/crypto';
import { PERMISSIONS } from '@/lib/permissions';
import mongoose from 'mongoose';

// --- Import all required models ---
import CustomerPackageLog from '@/models/CustomerPackageLog';
import CustomerPackage from '@/models/CustomerPackage';
import Customer from '@/models/customermodel';
import PackageTemplate from '@/models/PackageTemplate';
import Staff from '@/models/staff';
import ServiceItem from '@/models/ServiceItem';
import Product from '@/models/Product';
// --- End Model Imports ---

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        const tenantId = session.user.tenantId;

        const { searchParams } = new URL(req.url);
        const startDateStr = searchParams.get('startDate');
        const endDateStr = searchParams.get('endDate');

        await dbConnect();

        let query: any = { tenantId };
        if (startDateStr && endDateStr) {
            const fromDate = new Date(startDateStr);
            const toDate = new Date(endDateStr);
            toDate.setUTCHours(23, 59, 59, 999);
            query.createdAt = { $gte: fromDate, $lte: toDate };
        }

        // Step 1: Fetch logs and populate the nested customer and package info
        const logs = await CustomerPackageLog.find(query)
            .populate({
                path: 'customerPackageId',
                populate: [
                    { path: 'customerId', select: 'name phoneNumber' },
                    { path: 'packageTemplateId', select: 'name' }
                ]
            })
            .populate('redeemedBy', 'name')
            .sort({ createdAt: -1 })
            .lean();

        // Step 2: Efficiently fetch all redeemed item names
        const serviceIds = logs
            .filter(log => log.redeemedItemType === 'service')
            .map(log => log.redeemedItemId);
        const productIds = logs
            .filter(log => log.redeemedItemType === 'product')
            .map(log => log.redeemedItemId);

        const [services, products] = await Promise.all([
            ServiceItem.find({ _id: { $in: serviceIds } }, 'name').lean(),
            Product.find({ _id: { $in: productIds } }, 'name').lean()
        ]);

        const serviceMap = new Map(services.map(s => [s._id.toString(), s.name]));
        const productMap = new Map(products.map(p => [p._id.toString(), p.name]));

        // Step 3: Decrypt customer data and assemble the final response
        const finalReportData = logs.map(log => {
            let customerName = 'N/A';
            let customerPhone = 'N/A';

            if (log.customerPackageId && typeof log.customerPackageId === 'object' && log.customerPackageId.customerId && typeof log.customerPackageId.customerId === 'object') {
                const cust = log.customerPackageId.customerId as { name: string; phoneNumber: string };
                customerName = safeDecrypt(cust.name, 'customer name');
                customerPhone = safeDecrypt(cust.phoneNumber, 'customer phone');
            }
            
            // Look up the item name from our maps
            const itemName = log.redeemedItemType === 'service'
                ? serviceMap.get(log.redeemedItemId.toString())
                : productMap.get(log.redeemedItemId.toString());

            return {
                ...log,
                // Attach the item name in the structure the frontend expects
                serviceId: log.redeemedItemType === 'service' ? { name: itemName || 'Unknown Service' } : undefined,
                productId: log.redeemedItemType === 'product' ? { name: itemName || 'Unknown Product' } : undefined,
                // Re-assemble the customer object with decrypted data
                customerPackageId: {
                    ...log.customerPackageId,
                    customerId: {
                        name: customerName,
                        phone: customerPhone,
                    }
                }
            };
        });

        return NextResponse.json(finalReportData, { status: 200 });

    } catch (error) {
        console.error("Error fetching package redemptions report:", error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}