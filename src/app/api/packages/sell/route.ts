import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';

// --- Import all required models for this transaction ---
import CustomerPackage from '@/models/CustomerPackage';
import PackageTemplate from '@/models/PackageTemplate';
import Customer from '@/models/customermodel'; // To verify customer exists
// --------------------------------------------------------

interface SellPackageRequestBody {
  customerId: string;
  packageTemplateId: string;
  purchaseDate?: string; // Optional, defaults to now
}

/**
 * @method POST
 * @description Sells a package to a customer, creating a CustomerPackage instance.
 * @permission manage:pos (or a similar permission for making sales)
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        const tenantId = session.user.tenantId;

        const body: SellPackageRequestBody = await request.json();
        const { customerId, packageTemplateId, purchaseDate } = body;

        // --- Server-side Validation ---
        if (!customerId || !packageTemplateId || !mongoose.Types.ObjectId.isValid(customerId) || !mongoose.Types.ObjectId.isValid(packageTemplateId)) {
            return NextResponse.json({ message: 'Validation Error: Invalid customerId or packageTemplateId provided.' }, { status: 400 });
        }

        await dbConnect();

        // --- Fetch dependencies and verify their existence and state ---
        const template = await PackageTemplate.findOne({ _id: packageTemplateId, tenantId, isActive: true }).lean();
        if (!template) {
            return NextResponse.json({ message: 'Active package template not found.' }, { status: 404 });
        }

        const customer = await Customer.findOne({ _id: customerId, tenantId }).lean();
        if (!customer) {
            return NextResponse.json({ message: 'Customer not found.' }, { status: 404 });
        }
        
        // --- Business Logic ---
        const pDate = purchaseDate ? new Date(purchaseDate) : new Date();
        const expiryDate = new Date(pDate);
        expiryDate.setDate(expiryDate.getDate() + template.validityInDays);

        const remainingItems = template.items.map(item => ({
            itemType: item.itemType,
            itemId: item.itemId,
            totalQuantity: item.quantity,
            remainingQuantity: item.quantity,
        }));
        
        const newCustomerPackage = new CustomerPackage({
            tenantId,
            customerId,
            packageTemplateId,
            purchaseDate: pDate,
            expiryDate,
            status: 'active',
            remainingItems,
            packageName: template.name, // Denormalize name for easy display
        });
        
        await newCustomerPackage.save();

        return NextResponse.json(newCustomerPackage, { status: 201 });
    } catch (error: any) {
        console.error("Error selling package:", error);
        if (error.name === 'ValidationError') {
            return NextResponse.json({ message: "Validation Error", details: error.errors }, { status: 400 });
        }
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}