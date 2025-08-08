// /app/api/customers/import/route.ts - MULTI-TENANT VERSION

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import Customer from '@/models/customermodel';
import { encrypt } from '@/lib/crypto';
import { createBlindIndex, generateNgrams } from '@/lib/search-indexing';
import { getTenantIdOrBail } from '@/lib/tenant'; // 1. Import the tenant helper

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

  // 2. Get the Tenant ID right at the start or fail.
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  try {
    const rows: CustomerImportRow[] = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, message: 'No customer data provided.' }, { status: 400 });
    }

    await connectToDatabase();

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
        if (!normalizedPhoneNumber) {
            throw new Error('Invalid phone number format.');
        }
        
        const phoneHash = createBlindIndex(normalizedPhoneNumber);
        const phoneSearchIndexes = generateNgrams(normalizedPhoneNumber).map(ngram => createBlindIndex(ngram));
        const isMember = row.IsMembership === 'TRUE' || row.IsMembership === true;
        const barcode = row.MembershipBarcode?.trim().toUpperCase();

        if (isMember && !barcode) {
            throw new Error('MembershipBarcode is required if IsMembership is TRUE.');
        }
        
        // 3. Add tenantId to the customer payload.
        const customerPayload = {
          name: encrypt(row.Name.trim()),
          phoneNumber: encrypt(normalizedPhoneNumber),
          email: row.Email ? encrypt(row.Email.trim()) : undefined,
          phoneHash,
          searchableName: row.Name.trim().toLowerCase(),
          last4PhoneNumber: normalizedPhoneNumber.slice(-4),
          phoneSearchIndex: phoneSearchIndexes,
          dob: row.DOB ? new Date(row.DOB) : undefined,
          gender: row.Gender || undefined,
          survey: row.Survey || undefined,
          isMembership: isMember,
          membershipBarcode: isMember ? barcode : undefined,
          membershipPurchaseDate: isMember ? new Date() : undefined,
          tenantId: tenantId, // Enforce the tenantId
        };
        
        // 4. Scope the check for an existing customer to the current tenant.
        const existingCustomer = await Customer.findOne({ phoneHash, tenantId });

        if (existingCustomer) {
          // UPDATE LOGIC
          if (barcode) {
              // 5. Scope the barcode conflict check to the current tenant.
              const barcodeExists = await Customer.findOne({ 
                membershipBarcode: barcode, 
                _id: { $ne: existingCustomer._id },
                tenantId 
              });
              if (barcodeExists) {
                  throw new Error(`MembershipBarcode "${barcode}" is already in use by another customer.`);
              }
          }
          // 6. Scope the update operation to the current tenant.
          await Customer.findOneAndUpdate({ _id: existingCustomer._id, tenantId }, { $set: customerPayload });
        } else {
          // CREATE LOGIC
          if (barcode) {
              // 5. Scope the barcode conflict check to the current tenant.
              const barcodeExists = await Customer.findOne({ membershipBarcode: barcode, tenantId });
              if (barcodeExists) {
                  throw new Error(`MembershipBarcode "${barcode}" is already in use by another customer.`);
              }
          }
          // The customerPayload already includes the tenantId, so create is safe.
          await Customer.create(customerPayload);
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