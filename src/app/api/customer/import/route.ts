// /app/api/customers/import/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import Customer from '@/models/customermodel';
import { createSearchHash } from '@/lib/crypto';

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
          name: row.Name,
          phoneNumber: row.PhoneNumber,
          email: row.Email || undefined,
          gender: row.Gender || undefined,
          dob: row.DOB ? new Date(row.DOB) : undefined,
          survey: row.Survey || undefined,
          phoneHash: phoneHash,
          isMembership: isMember,
          membershipBarcode: isMember ? barcode : undefined,
          membershipPurchaseDate: isMember ? new Date() : undefined,
        };
        // --- END OF FIX ---

        if (existingCustomer) {
          Object.assign(existingCustomer, customerData);
          await existingCustomer.save();
        } else {
          await Customer.create(customerData);
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
