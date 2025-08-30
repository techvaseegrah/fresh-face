import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Tenant from '@/models/Tenant';
import User from '@/models/user';
import Role from '@/models/role';
// ✅ Import other models you'll need for a complete deletion
import Customer from '@/models/customermodel';
import Appointment from '@/models/Appointment';
import Product from '@/models/Product';
import Service from '@/models/ServiceCategory';
// ... import any other tenant-specific models

import mongoose from 'mongoose';

interface RouteParams {
  params: {
    tenantId: string;
  };
}

/**
 * Handles updating a specific tenant's details.
 * METHOD: PUT
 * URL: /api/admin/tenants/[tenantId]
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
    const { tenantId } = params;
    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
        await connectToDatabase();
        // ✅ 1. DESTRUCTURE THE NEW FIELDS FROM THE REQUEST BODY
        const { name, address, phone, gstin, admin, password } = await req.json();

        if (!name || !admin || !admin.name || !admin.email) {
            return NextResponse.json({ message: 'Missing required tenant or admin details for update.' }, { status: 400 });
        }
        
        const tenant = await Tenant.findById(tenantId).session(dbSession);
        if (!tenant) {
            throw new Error('Tenant not found.');
        }
        
        // ✅ 2. UPDATE ALL TENANT FIELDS
        tenant.name = name;
        tenant.subdomain = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        // Only update these fields if they are provided in the request
        if (address !== undefined) tenant.address = address;
        if (phone !== undefined) tenant.phone = phone;
        if (gstin !== undefined) tenant.gstin = gstin;
        
        // --- Admin user update logic remains the same ---
        const adminUser = await User.findOne({ tenantId: tenant._id }).session(dbSession);
        if (adminUser) {
            adminUser.name = admin.name;
            adminUser.email = admin.email.toLowerCase();
            
            if (password) {
                // IMPORTANT: In a real app, hash this password with bcrypt
                adminUser.password = password;
            }
            await adminUser.save({ session: dbSession });
        }

        await tenant.save({ session: dbSession });
        await dbSession.commitTransaction();

        return NextResponse.json({ message: 'Tenant updated successfully.' }, { status: 200 });

    } catch (error: any) {
        await dbSession.abortTransaction();
        console.error(`Failed to update tenant ${tenantId}:`, error);
        return NextResponse.json({ message: error.message || 'Internal server error.' }, { status: 500 });
    } finally {
        dbSession.endSession();
    }
}


/**
 * Handles deleting a specific tenant and all its associated data.
 * METHOD: DELETE
 * URL: /api/admin/tenants/[tenantId]
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { tenantId } = params;
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    await connectToDatabase();

    const tenantToDelete = await Tenant.findById(tenantId).session(dbSession);
    if (!tenantToDelete) {
      return NextResponse.json({ message: 'Tenant not found.' }, { status: 404 });
    }

    // ✅ IMPORTANT: Delete ALL data associated with this tenant to avoid orphaned documents.
    // This is crucial for maintaining a clean database.
    await User.deleteMany({ tenantId: tenantId }).session(dbSession);
    await Role.deleteMany({ tenantId: tenantId }).session(dbSession);
    await Customer.deleteMany({ tenantId: tenantId }).session(dbSession);
    await Appointment.deleteMany({ tenantId: tenantId }).session(dbSession);
    await Product.deleteMany({ tenantId: tenantId }).session(dbSession);
    await Service.deleteMany({ tenantId: tenantId }).session(dbSession);
    // ... add `deleteMany` for every other model that has a `tenantId` field ...

    // Finally, delete the tenant document itself
    await Tenant.findByIdAndDelete(tenantId).session(dbSession);
    
    await dbSession.commitTransaction();

    return NextResponse.json({ message: `Tenant "${tenantToDelete.name}" was deleted successfully.` }, { status: 200 });

  } catch (error: any) {
    await dbSession.abortTransaction();
    console.error(`Failed to delete tenant ${tenantId}:`, error);
    return NextResponse.json({ message: 'Internal server error during deletion.' }, { status: 500 });
  } finally {
    dbSession.endSession();
  }
}