import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';

// --- Import all required models for this query ---
import CustomerPackage from '@/models/CustomerPackage';
import Service from '@/models/ServiceItem';   // For populating service names
import Product from '@/models/Product'; // For populating product names
// --------------------------------------------------

interface Params {
  params: { id: string };
}

/**
 * @method GET
 * @description Retrieves all packages belonging to a specific customer, enriched with service/product names.
 * @permission read:customers (or a similar permission for viewing customer details)
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        const tenantId = session.user.tenantId;
        const customerId = params.id;

        if (!mongoose.Types.ObjectId.isValid(customerId)) {
            return NextResponse.json({ message: 'Invalid customer ID format' }, { status: 400 });
        }

        await dbConnect();

        // 1. Fetch all packages for the customer
        const customerPackages = await CustomerPackage.find({ customerId, tenantId })
            .sort({ purchaseDate: -1 })
            .lean();

        if (!customerPackages || customerPackages.length === 0) {
            return NextResponse.json([], { status: 200 });
        }
        
        // 2. Collect all unique service and product IDs from the packages
        // --- FIX: Use a Set of strings to store the IDs ---
        const serviceIds = new Set<string>();
        const productIds = new Set<string>();

        customerPackages.forEach(pkg => {
            pkg.remainingItems.forEach(item => {
                if (item.itemType === 'service') {
                    // --- FIX: Add the string representation of the ObjectId ---
                    serviceIds.add(item.itemId.toString());
                } else if (item.itemType === 'product') {
                    // --- FIX: Add the string representation of the ObjectId ---
                    productIds.add(item.itemId.toString());
                }
            });
        });

        // 3. Fetch the names for these services and products in two efficient queries
        // Mongoose is smart enough to handle an array of strings for an ObjectId $in query
        const services = await Service.find({ _id: { $in: Array.from(serviceIds) } }, 'name').lean();
        const products = await Product.find({ _id: { $in: Array.from(productIds) } }, 'name').lean();
        
        // 4. Create mapping for quick lookups
        const serviceNameMap = new Map(services.map(s => [s._id.toString(), s.name]));
        const productNameMap = new Map(products.map(p => [p._id.toString(), p.name]));
        
        // 5. Enrich the package data with the names
        const enrichedPackages = customerPackages.map(pkg => {
            const enrichedItems = pkg.remainingItems.map(item => {
                let itemName = 'Unknown Item';
                if (item.itemType === 'service') {
                    itemName = serviceNameMap.get(item.itemId.toString()) || 'Deleted Service';
                } else if (item.itemType === 'product') {
                    itemName = productNameMap.get(item.itemId.toString()) || 'Deleted Product';
                }
                return { ...item, itemName }; // Add the 'itemName' property
            });
            return { ...pkg, remainingItems: enrichedItems };
        });

        return NextResponse.json(enrichedPackages, { status: 200 });

    } catch (error: any) {
        console.error(`Error fetching packages for customer ${params.id}:`, error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}