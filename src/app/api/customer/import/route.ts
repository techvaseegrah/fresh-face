// /app/api/customers/import/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import Customer from '@/models/customermodel';
import { createSearchHash, encrypt } from '@/lib/crypto';

interface CustomerImportRow {
  Name: string;
  PhoneNumber: string;
  Email?: string;
  Gender?: 'male' | 'female' | 'other';
  DOB?: string;
  Survey?: string;
  IsMembership?: 'TRUE' | 'FALSE' | boolean;
  MembershipBarcode?: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_CREATE)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows: CustomerImportRow[] = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, message: 'No customer data provided.' }, { status: 400 });
    }

    await dbConnect();

    const report = {
      totalRows: rows.length,
      successfulImports: 0,
      failedImports: 0,
      errors: [] as { row: number; message: string; data: CustomerImportRow }[],
    };

    for (const [index, row] of rows.entries()) {
      try {
        if (!row.Name || !row.PhoneNumber) {
          throw new Error('Missing required fields: Name and PhoneNumber are required.');
        }

        const normalizedPhoneNumber = String(row.PhoneNumber).replace(/\D/g, '');
        const phoneHash = createSearchHash(normalizedPhoneNumber);

        const existingCustomer = await Customer.findOne({ phoneHash });

        const isMember = row.IsMembership === 'TRUE' || row.IsMembership === true;
        const barcode = row.MembershipBarcode?.trim().toUpperCase();

        if (isMember && !barcode) {
            throw new Error('MembershipBarcode is required if IsMembership is TRUE.');
        }

        if (barcode) {
            const barcodeExists = await Customer.findOne({ membershipBarcode: barcode, _id: { $ne: existingCustomer?._id } });
            if (barcodeExists) {
                throw new Error(`MembershipBarcode "${barcode}" is already in use by another customer.`);
            }
        }

        // --- FIX: Explicitly handle optional fields ---
        // If a field from the Excel/CSV is empty, set it to `undefined` so Mongoose omits it.
        const customerData: any = {
          name: encrypt(row.Name),
          phoneNumber: encrypt(row.PhoneNumber),
          email: row.Email,
          dob: row.DOB ? new Date(row.DOB) : undefined,
          survey: row.Survey || undefined,
          phoneHash: phoneHash,
          searchableName: row.Name,
          last4PhoneNumber: normalizedPhoneNumber.slice(-4),
          isMembership: isMember,
          membershipBarcode: isMember ? barcode : undefined,
          membershipPurchaseDate: isMember ? new Date() : undefined,
        };
        // --- END OF FIX ---

              if (existingCustomer) {
          // When updating an existing customer
          existingCustomer.name = encrypt(row.Name);
          existingCustomer.phoneNumber = encrypt(row.PhoneNumber);
          existingCustomer.email = row.Email ? encrypt(row.Email) : undefined;
          // ... assign other fields from customerData ...
          Object.assign(existingCustomer, customerData); // This is not ideal after manual assignment. Let's rewrite it.

          // A cleaner way to update:
          const updateData = { ...customerData }; // Copy the data
          // Overwrite the encrypted fields in the update data
          updateData.name = encrypt(row.Name);
          updateData.phoneNumber = encrypt(row.PhoneNumber);
          updateData.email = row.Email ? encrypt(row.Email) : undefined;
          
          Object.assign(existingCustomer, updateData);
          await existingCustomer.save();

        } else {
          // When creating a new customer
          const createData = { ...customerData }; // Copy the data
          // Encrypt fields for the new customer
          createData.name = encrypt(row.Name);
          createData.phoneNumber = encrypt(row.PhoneNumber);
          createData.email = row.Email ? encrypt(row.Email) : undefined;

          await Customer.create(createData);
        }


        report.successfulImports++;
      } catch (error: any) {
        report.failedImports++;
        report.errors.push({
          row: index + 2,
          message: error.message || 'An unknown error occurred.',
          data: row,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Customer import process completed.',
      report,
    });

  } catch (error: any) {
    console.error("API Error during customer import:", error);
    return NextResponse.json({ success: false, message: 'Server-side error during import.' }, { status: 500 });
  }
}
