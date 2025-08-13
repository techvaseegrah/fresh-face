import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Tenant from '@/models/Tenant';
import User from '@/models/user';
import Role from '@/models/role';
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
        const { name, admin, password } = await req.json();

        if (!name || !admin || !admin.name || !admin.email) {
            return NextResponse.json({ message: 'Missing required fields for update.' }, { status: 400 });
        }
        
        const tenant = await Tenant.findById(tenantId).session(dbSession);
        if (!tenant) {
            throw new Error('Tenant not found.');
        }
        
        tenant.name = name;
        tenant.subdomain = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
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

    // Delete all data associated with this tenant
    await User.deleteMany({ tenantId: tenantId }).session(dbSession);
    await Role.deleteMany({ tenantId: tenantId }).session(dbSession);
    // Add other model deletions here (e.g., Products, Appointments, etc.)

    // Finally, delete the tenant document itself
    await Tenant.findByIdAndDelete(tenantId).session(dbSession);
    
    await dbSession.commitTransaction();

    return NextResponse.json({ message: `Tenant "${tenantToDelete.name}" was deleted.` }, { status: 200 });

  } catch (error: any) {
    await dbSession.abortTransaction();
    console.error(`Failed to delete tenant ${tenantId}:`, error);
    return NextResponse.json({ message: 'Internal server error during deletion.' }, { status: 500 });
  } finally {
    dbSession.endSession();
  }
}