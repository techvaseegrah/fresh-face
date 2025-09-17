import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import connectToDatabase from '@/lib/mongodb';
import Invoice from '@/models/invoice';
import mongoose from 'mongoose';
// Staff model is no longer needed for population in this specific query
// import Staff from '@/models/staff'; 

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;

  try {
    const { id: customerId } = params;
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return NextResponse.json({ message: 'Invalid customer ID.' }, { status: 400 });
    }

    await connectToDatabase();

    // Step 1: Fetch the raw data. We remove .populate() because it's ineffective when stylistId is null.
    const importedInvoices = await Invoice.find({
      tenantId,
      customerId,
      isImported: true,
    })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean(); // .lean() is great for performance here!

    // --- Step 2: Manually transform the data to fit the front-end's expectation ---
    const formattedInvoices = importedInvoices.map(invoice => {
      // For imported invoices where stylistId is null...
      if (invoice.isImported && !invoice.stylistId) {
        // ...find the first line item that has a staffName.
        const firstLineItemWithStaff = invoice.lineItems.find(item => item.staffName);
        if (firstLineItemWithStaff) {
          // ...and create the nested object the front-end is looking for.
          invoice.stylistId = { name: firstLineItemWithStaff.staffName };
        }
      }
      return invoice;
    });

    // Step 3: Return the transformed data.
    return NextResponse.json(formattedInvoices);

  } catch (error) {
    console.error('Error fetching imported invoices:', error);
    return NextResponse.json({ message: 'Server error.' }, { status: 500 });
  }
}