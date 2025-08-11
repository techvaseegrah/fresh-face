// src/app/api/admin/create-tenant/route.ts

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Tenant from '@/models/Tenant';
import User from '@/models/user';
import Role from '@/models/role';
import mongoose from 'mongoose';
import { PERMISSIONS } from '@/lib/permissions'; // Import your permissions object

// A function to generate a URL-friendly subdomain from the store name
const generateSubdomain = (name: string) => {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
};

const DEFAULT_STORE_ADMIN_PERMISSIONS = [
  // Dashboard & Own Reports
  PERMISSIONS.DASHBOARD_READ,
  PERMISSIONS.SALES_REPORT_READ,

  // Core Operations
  PERMISSIONS.APPOINTMENTS_CREATE,
  PERMISSIONS.APPOINTMENTS_READ,
  PERMISSIONS.APPOINTMENTS_UPDATE,
  PERMISSIONS.CUSTOMERS_CREATE,
  PERMISSIONS.CUSTOMERS_READ,
  PERMISSIONS.CUSTOMERS_UPDATE,

  // Shop Management
  PERMISSIONS.PRODUCTS_CREATE,
  PERMISSIONS.PRODUCTS_READ,
  PERMISSIONS.PRODUCTS_UPDATE,
  PERMISSIONS.SERVICES_CREATE,
  PERMISSIONS.SERVICES_READ,
  PERMISSIONS.SERVICES_UPDATE,
  PERMISSIONS.STYLISTS_CREATE,
  PERMISSIONS.STYLISTS_READ,
  PERMISSIONS.STYLISTS_UPDATE,

  // Staff Management
  PERMISSIONS.STAFF_LIST_READ,
  PERMISSIONS.STAFF_LIST_CREATE,
  PERMISSIONS.STAFF_LIST_UPDATE,
  PERMISSIONS.STAFF_ATTENDANCE_READ,
  PERMISSIONS.STAFF_ADVANCE_READ,
  PERMISSIONS.STAFF_PERFORMANCE_READ,
  PERMISSIONS.STAFF_TARGET_READ,
  PERMISSIONS.STAFF_INCENTIVES_READ,
  PERMISSIONS.STAFF_SALARY_READ,
  PERMISSIONS.STAFF_SWIFT_MANAGE,

  // Day End & Expenses
  PERMISSIONS.DAYEND_CREATE,
  PERMISSIONS.DAYEND_READ,
  PERMISSIONS.EXPENSES_CREATE,
  PERMISSIONS.EXPENSES_READ,
  PERMISSIONS.EXPENSES_UPDATE,

  // Procurement & Inventory
  PERMISSIONS.PROCUREMENT_CREATE,
  PERMISSIONS.PROCUREMENT_READ,
  PERMISSIONS.PROCUREMENT_UPDATE,
  PERMISSIONS.INVENTORY_CHECKER_READ,
  PERMISSIONS.ALERTS_READ,

  // Tenant-Level Administration
  PERMISSIONS.USERS_CREATE,
  PERMISSIONS.USERS_READ,
  PERMISSIONS.USERS_UPDATE,
  PERMISSIONS.ROLES_CREATE,
  PERMISSIONS.ROLES_READ,
  PERMISSIONS.ROLES_UPDATE,
  
  // --- THIS IS THE FIX ---
  // Add all the specific settings permissions a store admin should have.
  PERMISSIONS.SETTINGS_READ,
  PERMISSIONS.LOYALTY_SETTINGS_READ,
  PERMISSIONS.LOYALTY_SETTINGS_UPDATE,
  PERMISSIONS.MEMBERSHIP_SETTINGS_READ,
  PERMISSIONS.MEMBERSHIP_SETTINGS_WRITE,
  PERMISSIONS.ATTENDANCE_SETTINGS_READ,         // <<< ADDED
  PERMISSIONS.POSITION_HOURS_SETTINGS_MANAGE, // <<< ADDED
  PERMISSIONS.SETTINGS_STAFF_ID_MANAGE,       // <<< ADDED
];

export async function POST(req: NextRequest) {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    await connectToDatabase();
    const { storeName, adminEmail, adminName, adminPassword } = await req.json();

    if (!storeName || !adminEmail || !adminName || !adminPassword) {
      throw new Error("Store name, admin email, name, and password are required.");
    }

    const subdomain = generateSubdomain(storeName);
    
    const existingTenant = await Tenant.findOne({ subdomain }).lean();
    if (existingTenant) {
      throw new Error(`A store with the name "${storeName}" (subdomain: ${subdomain}) already exists.`);
    }
    const existingUser = await User.findOne({ email: adminEmail.toLowerCase() }).lean();
    if (existingUser) {
        throw new Error(`A user with the email "${adminEmail}" already exists.`);
    }

    const newTenant = new Tenant({
      name: storeName,
      subdomain: subdomain,
    });
    await newTenant.save({ session: dbSession });
    
    const adminRole = new Role({
      tenantId: newTenant._id,
      name: 'ADMINISTRATOR',
      displayName: 'Administrator',
      permissions: DEFAULT_STORE_ADMIN_PERMISSIONS,
      isSystemRole: true,
    });
    await adminRole.save({ session: dbSession });

    const newAdminUser = new User({
      tenantId: newTenant._id,
      roleId: adminRole._id,
      email: adminEmail.toLowerCase(),
      name: adminName,
      password: adminPassword,
      isActive: true,
    });
    await newAdminUser.save({ session: dbSession });

    await dbSession.commitTransaction();

    return NextResponse.json({
      success: true,
      message: 'Tenant and admin user created successfully!',
      tenant: { name: newTenant.name, subdomain: newTenant.subdomain },
      user: { email: newAdminUser.email, name: newAdminUser.name }
    }, { status: 201 });

  } catch (error: any) {
    await dbSession.abortTransaction();
    console.error('Failed to create tenant:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  } finally {
    dbSession.endSession();
  }
}