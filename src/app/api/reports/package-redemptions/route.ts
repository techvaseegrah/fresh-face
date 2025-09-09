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

        // --- FIX START ---
        // Ensure all models used in population are registered with Mongoose.
        // Accessing them here forces their respective files to be evaluated.
        CustomerPackage.init();
        Customer.init();
        PackageTemplate.init();
        Staff.init();
        // --- FIX END ---

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
                    // The 'Customer' model is now guaranteed to be registered
                    { path: 'customerId', model: Customer, select: 'name phoneNumber' },
                    // The 'PackageTemplate' model is now guaranteed to be registered
                    { path: 'packageTemplateId', model: PackageTemplate, select: 'name' }
                ]
            })
            // The 'Staff' model is now guaranteed to be registered
            .populate({ path: 'redeemedBy', model: Staff, select: 'name'})
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
            // ServiceItem and Product are used directly, so they don't need pre-registration.
            ServiceItem.find({ _id: { $in: serviceIds } }, 'name').lean(),
            Product.find({ _id: { $in: productIds } }, 'name').lean()
        ]);

        const serviceMap = new Map(services.map(s => [s._id.toString(), s.name]));
        const productMap = new Map(products.map(p => [p._id.toString(), p.name]));

        // Step 3: Decrypt customer data and assemble the final response
        const finalReportData = logs.map((log: any) => { // Added 'any' type to log for easier manipulation
            let customerName = 'N/A';
            let customerPhone = 'N/A';

            if (log.customerPackageId && log.customerPackageId.customerId) {
                const cust = log.customerPackageId.customerId;
                customerName = safeDecrypt(cust.name, 'customer name');
                customerPhone = safeDecrypt(cust.phoneNumber, 'customer phone');
            }
            
            const itemName = log.redeemedItemType === 'service'
                ? serviceMap.get(log.redeemedItemId.toString())
                : productMap.get(log.redeemedItemId.toString());

            // Reconstruct the object to match frontend expectations and ensure clean data
            return {
                _id: log._id,
                redeemedAt: log.createdAt, // Using createdAt as the redemption time
                redeemedQuantity: log.redeemedQuantity,
                redeemedItemType: log.redeemedItemType,
                packageName: log.customerPackageId?.packageTemplateId?.name || 'N/A',
                customerName: customerName,
                customerPhone: customerPhone,
                itemName: itemName || (log.redeemedItemType === 'service' ? 'Unknown Service' : 'Unknown Product'),
                redeemedBy: log.redeemedBy?.name || 'N/A',
            };
        });

        return NextResponse.json(finalReportData, { status: 200 });

    } catch (error) {
        console.error("Error fetching package redemptions report:", error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}