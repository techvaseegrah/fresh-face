// src/app/api/admin/create-tenant/route.ts

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Tenant from '@/models/Tenant';
import User from '@/models/user';
import Role from '@/models/role';
import mongoose from 'mongoose';
import { PERMISSIONS } from '@/lib/permissions';

// A function to generate a URL-friendly subdomain from the store name
const generateSubdomain = (name: string) => {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
};

// --- THIS IS THE CORRECTED PERMISSIONS LIST ---
// This list includes ALL permissions except for the ones that manage other stores/tenants.
// This is what will be assigned to the "Administrator" role of any new store.
const DEFAULT_STORE_ADMIN_PERMISSIONS = [
  // User Management
  PERMISSIONS.USERS_CREATE,
  PERMISSIONS.USERS_READ,
  PERMISSIONS.USERS_UPDATE,
  PERMISSIONS.USERS_DELETE,
  PERMISSIONS.USERS_MANAGE,

  // Role Management
  PERMISSIONS.ROLES_CREATE,
  PERMISSIONS.ROLES_READ,
  PERMISSIONS.ROLES_UPDATE,
  PERMISSIONS.ROLES_DELETE,
  PERMISSIONS.ROLES_MANAGE,

  // Customer Management
  PERMISSIONS.CUSTOMERS_CREATE,
  PERMISSIONS.CUSTOMERS_READ,
  PERMISSIONS.CUSTOMERS_UPDATE,
  PERMISSIONS.CUSTOMERS_DELETE,
  PERMISSIONS.CUSTOMERS_IMPORT,
  PERMISSIONS.CUSTOMERS_EXPORT,
  PERMISSIONS.CUSTOMERS_MANAGE,

  // Appointment Management
  PERMISSIONS.APPOINTMENTS_CREATE,
  PERMISSIONS.APPOINTMENTS_READ,
  PERMISSIONS.APPOINTMENTS_UPDATE,
  PERMISSIONS.APPOINTMENTS_DELETE,
  PERMISSIONS.APPOINTMENTS_MANAGE,

  // Stylist Management
  PERMISSIONS.STYLISTS_CREATE,
  PERMISSIONS.STYLISTS_READ,
  PERMISSIONS.STYLISTS_UPDATE,
  PERMISSIONS.STYLISTS_DELETE,

  // Product Management
  PERMISSIONS.PRODUCTS_CREATE,
  PERMISSIONS.PRODUCTS_READ,
  PERMISSIONS.PRODUCTS_UPDATE,
  PERMISSIONS.PRODUCTS_DELETE,

  // Service Management
  PERMISSIONS.SERVICES_CREATE,
  PERMISSIONS.SERVICES_READ,
  PERMISSIONS.SERVICES_UPDATE,
  PERMISSIONS.SERVICES_DELETE,

  // Dashboard Access
  PERMISSIONS.DASHBOARD_READ,
  PERMISSIONS.DASHBOARD_MANAGE,

  // Day-end Closing Management
  PERMISSIONS.DAYEND_CREATE,
  PERMISSIONS.DAYEND_READ,
  PERMISSIONS.DAYEND_UPDATE,
  PERMISSIONS.DAYEND_DELETE,
  PERMISSIONS.DAYEND_MANAGE,

  // EB (Electricity Bill) Management
  PERMISSIONS.EB_UPLOAD,
  PERMISSIONS.EB_VIEW_CALCULATE,

  // Procurement Management
  PERMISSIONS.PROCUREMENT_CREATE,
  PERMISSIONS.PROCUREMENT_READ,
  PERMISSIONS.PROCUREMENT_UPDATE,
  PERMISSIONS.PROCUREMENT_DELETE,

  // Procurement Workflow
  PERMISSIONS.WORKFLOW_PO_CREATE,
  PERMISSIONS.WORKFLOW_PO_READ_OWN,
  PERMISSIONS.WORKFLOW_PO_READ_ALL,
  PERMISSIONS.WORKFLOW_PO_REVIEW,
  PERMISSIONS.WORKFLOW_PO_APPROVE,
  PERMISSIONS.WORKFLOW_PO_RECEIVE,

  // Settings Management
  PERMISSIONS.SETTINGS_READ,
  PERMISSIONS.LOYALTY_SETTINGS_READ,
  PERMISSIONS.LOYALTY_SETTINGS_UPDATE,
  PERMISSIONS.MEMBERSHIP_SETTINGS_READ,
  PERMISSIONS.MEMBERSHIP_SETTINGS_WRITE,
  PERMISSIONS.ATTENDANCE_SETTINGS_READ,
  PERMISSIONS.SETTINGS_STAFF_ID_MANAGE,
  PERMISSIONS.POSITION_HOURS_SETTINGS_MANAGE,

  // Inventory Checker Management
  PERMISSIONS.INVENTORY_CHECKER_CREATE,
  PERMISSIONS.INVENTORY_CHECKER_READ,
  PERMISSIONS.INVENTORY_CHECKER_UPDATE,
  PERMISSIONS.INVENTORY_CHECKER_DELETE,

  // Alerts Management
  PERMISSIONS.ALERTS_CREATE,
  PERMISSIONS.ALERTS_READ,
  PERMISSIONS.ALERTS_DELETE,

  // Staff Management
  PERMISSIONS.STAFF_LIST_READ,
  PERMISSIONS.STAFF_LIST_CREATE,
  PERMISSIONS.STAFF_LIST_UPDATE,
  PERMISSIONS.STAFF_LIST_DELETE,
  PERMISSIONS.STAFF_ATTENDANCE_READ,
  PERMISSIONS.STAFF_ATTENDANCE_MANAGE,
  PERMISSIONS.STAFF_ADVANCE_READ,
  PERMISSIONS.STAFF_ADVANCE_MANAGE,
  PERMISSIONS.STAFF_PERFORMANCE_READ,
  PERMISSIONS.STAFF_PERFORMANCE_MANAGE,
  PERMISSIONS.STAFF_TARGET_READ,
  PERMISSIONS.STAFF_TARGET_MANAGE,
  PERMISSIONS.STAFF_INCENTIVES_READ,
  PERMISSIONS.STAFF_INCENTIVES_MANAGE,
  PERMISSIONS.STAFF_INCENTIVE_PAYOUT_READ, // --- PERMISSION ADDED ---
  PERMISSIONS.STAFF_INCENTIVE_PAYOUT_MANAGE, // --- PERMISSION ADDED ---
  PERMISSIONS.STAFF_SALARY_READ,
  PERMISSIONS.STAFF_SALARY_MANAGE,
  PERMISSIONS.STAFF_SWIFT_MANAGE,

  // Expenses Management
  PERMISSIONS.EXPENSES_CREATE,
  PERMISSIONS.EXPENSES_READ,
  PERMISSIONS.EXPENSES_UPDATE,
  PERMISSIONS.EXPENSES_DELETE,
  PERMISSIONS.EXPENSES_MANAGE,

  // Budget Management
  PERMISSIONS.BUDGET_READ,
  PERMISSIONS.BUDGET_MANAGE,

  // Sales Report
  PERMISSIONS.SALES_REPORT_READ,
  //SOP Management
  PERMISSIONS.SOP_MANAGE,
  PERMISSIONS.SOP_READ,
  PERMISSIONS.SOP_REPORTS_READ,
  PERMISSIONS.SOP_SUBMIT_CHECKLIST,
  //TELECALLING PERMISSIONS
  PERMISSIONS.TELECALLING_PERFORM,
  PERMISSIONS.TELECALLING_VIEW_DASHBOARD,
  PERMISSIONS.TELECALLING_VIEW_REPORTS
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
    
    // The new role will now be created with the complete list of permissions.
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
