// src/app/api/reports/package-sales/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import { safeDecrypt } from '@/lib/crypto';
import { PERMISSIONS } from '@/lib/permissions';

// --- START: MODEL IMPORTS ---
import CustomerPackage from '@/models/CustomerPackage';
import '@/models/customermodel';
import '@/models/staff';
import '@/models/PackageTemplate';
// --- END: MODEL IMPORTS ---

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
            query.purchaseDate = { $gte: fromDate, $lte: toDate };
        }

        const soldPackages = await CustomerPackage.find(query)
            // ▼▼▼ THE FIX IS HERE: Using the correct 'phoneNumber' field from your model ▼▼▼
            .populate('customerId', 'name phoneNumber') 
            // ▲▲▲ END OF FIX ▲▲▲
            .populate('soldBy', 'name')
            .populate('packageTemplateId', 'name')
            .sort({ purchaseDate: -1 })
            .lean();

        const decryptedSoldPackages = soldPackages.map(pkg => {
            let customerName = 'N/A';
            let customerPhone = 'N/A';

            if (pkg.customerId && typeof pkg.customerId === 'object') {
                // Assert the correct type based on your schema
                const cust = pkg.customerId as { name: string; phoneNumber: string };
                customerName = safeDecrypt(cust.name, 'customer name');
                // ▼▼▼ THE FIX IS HERE: Accessing the correct 'phoneNumber' property ▼▼▼
                customerPhone = safeDecrypt(cust.phoneNumber, 'customer phone');
                // ▲▲▲ END OF FIX ▲▲▲
            }
            
            return {
                ...pkg,
                customerId: {
                    name: customerName,
                    // Use the correct property name 'phone' that the frontend expects
                    phone: customerPhone,
                }
            };
        });

        return NextResponse.json(decryptedSoldPackages, { status: 200 });

    } catch (error) {
        console.error("Error fetching package sales report:", error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}