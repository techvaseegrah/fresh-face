import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';

// --- Import all required models for this transaction ---
import CustomerPackage from '@/models/CustomerPackage';
import PackageTemplate from '@/models/PackageTemplate';
import Customer from '@/models/customermodel';
import Staff from '@/models/staff'; // Ensure Staff model is imported for validation if needed
// --------------------------------------------------------

// ▼▼▼ INTERFACE UPDATED ▼▼▼
// The frontend must now send the purchasePrice
interface SellPackageRequestBody {
  customerId: string;
  packageTemplateId: string;
  purchasePrice: number; // Price is now a required field for the sale
  purchaseDate?: string; // Optional, defaults to now
}
// ▲▲▲ END OF UPDATE ▲▲▲

/**
 * @method POST
 * @description Sells a package to a customer, creating a CustomerPackage instance.
 * @permission manage:pos (or a similar permission for making sales)
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        // A sale must be performed by a logged-in user (staff)
        if (!session?.user?.tenantId || !session?.user?.id) {
            return NextResponse.json({ message: 'Unauthorized: You must be logged in to perform a sale.' }, { status: 401 });
        }
        const tenantId = session.user.tenantId;
        const soldByStaffId = session.user.id; // Get the logged-in staff member's ID

        const body: SellPackageRequestBody = await request.json();
        // ▼▼▼ DESTRUCTURING UPDATED ▼▼▼
        const { customerId, packageTemplateId, purchasePrice, purchaseDate } = body;
        // ▲▲▲ END OF UPDATE ▲▲▲

        // --- Server-side Validation ---
        // ▼▼▼ VALIDATION UPDATED ▼▼▼
        if (
            !customerId || !packageTemplateId ||
            !mongoose.Types.ObjectId.isValid(customerId) || !mongoose.Types.ObjectId.isValid(packageTemplateId) ||
            typeof purchasePrice !== 'number' || purchasePrice < 0
        ) {
            return NextResponse.json({ message: 'Validation Error: Invalid customerId, packageTemplateId, or purchasePrice provided.' }, { status: 400 });
        }
        // ▲▲▲ END OF UPDATE ▲▲▲

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
        
        // ▼▼▼ NEW CUSTOMER PACKAGE CREATION UPDATED ▼▼▼
        // Now includes the two new required fields for sales reporting
        const newCustomerPackage = new CustomerPackage({
            tenantId,
            customerId,
            packageTemplateId,
            purchaseDate: pDate,
            expiryDate,
            status: 'active',
            remainingItems,
            packageName: template.name,
            purchasePrice: purchasePrice, // Store the price of the sale
            soldBy: soldByStaffId,      // Store the ID of the staff who made the sale
        });
        // ▲▲▲ END OF UPDATE ▲▲▲
        
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