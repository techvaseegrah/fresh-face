import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import { getTenantIdOrBail } from '@/lib/tenant';
import { decrypt } from '@/lib/crypto';
import { createBlindIndex } from '@/lib/search-indexing';

// ===================================================================================
//  GET: Handler to find a customer by phone number
// ===================================================================================
export async function GET(req: NextRequest) {
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    try {
        await connectToDatabase();
        const { searchParams } = new URL(req.url);
        const phone = searchParams.get('phone');

        if (!phone || phone.length !== 10) {
            return NextResponse.json({ success: false, message: 'A 10-digit phone number is required.' }, { status: 400 });
        }

        const phoneHashToFind = createBlindIndex(phone);
        const customer = await Customer.findOne({ phoneHash: phoneHashToFind, tenantId }).lean();

        if (!customer) {
            return NextResponse.json({ success: false, message: 'Customer not found.' }, { status: 404 });
        }
        
        const decryptedCustomer = {
            _id: customer._id,
            name: decrypt(customer.name),
            phoneNumber: decrypt(customer.phoneNumber),
            email: customer.email ? decrypt(customer.email) : '',
            gender: customer.gender,
            // Format DOB for the HTML date input field
            dob: customer.dob ? new Date(customer.dob).toISOString().split('T')[0] : '',
        };

        return NextResponse.json({ success: true, customer: decryptedCustomer });

    } catch (error: any) {
        console.error("API Error finding customer:", error);
        return NextResponse.json({ success: false, message: "An error occurred while searching for the customer." }, { status: 500 });
    }
}