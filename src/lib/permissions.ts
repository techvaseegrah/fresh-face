// src/lib/permissions.ts

export const PERMISSIONS = {
  // User management
  USERS_CREATE: 'users:create',
  USERS_READ: 'users:read',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE: 'users:manage',

  // Role management
  ROLES_CREATE: 'roles:create',
  ROLES_READ: 'roles:read',
  ROLES_UPDATE: 'roles:update',
  ROLES_DELETE: 'roles:delete',
  ROLES_MANAGE: 'roles:manage',

  // Customer management
  CUSTOMERS_CREATE: 'customers:create',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_UPDATE: 'customers:update',
  CUSTOMERS_DELETE: 'customers:delete',
  CUSTOMERS_MANAGE: 'customers:manage',

  // Appointment management
  APPOINTMENTS_CREATE: 'appointments:create',
  APPOINTMENTS_READ: 'appointments:read',
  APPOINTMENTS_UPDATE: 'appointments:update',
  APPOINTMENTS_DELETE: 'appointments:delete',
  APPOINTMENTS_MANAGE: 'appointments:manage',
  
  // Stylist Management
  STYLISTS_CREATE: 'stylists:create',
  STYLISTS_READ: 'stylists:read',
  STYLISTS_UPDATE: 'stylists:update',
  STYLISTS_DELETE: 'stylists:delete',

  // Product Management
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_READ: 'products:read',
  PRODUCTS_UPDATE: 'products:update',
  PRODUCTS_DELETE: 'products:delete',

  // Service Management
  SERVICES_CREATE: 'services:create',
  SERVICES_READ: 'services:read',
  SERVICES_UPDATE: 'services:update',
  SERVICES_DELETE: 'services:delete',

  // Dashboard access
  DASHBOARD_READ: 'dashboard:read',
  DASHBOARD_MANAGE: 'dashboard:manage',

  // Day-end Closing management
  DAYEND_CREATE: 'dayend:create',
  DAYEND_READ: 'dayend:read',
  DAYEND_UPDATE: 'dayend:update',
  DAYEND_DELETE: 'dayend:delete',
  DAYEND_MANAGE: 'dayend:manage',

  // EB (Electricity Bill) management
  EB_UPLOAD: 'eb:upload',
  EB_VIEW_CALCULATE: 'eb:view_calculate',

  // Procurement management
  PROCUREMENT_CREATE: 'procurement:create',
  PROCUREMENT_READ: 'procurement:read',
  PROCUREMENT_UPDATE: 'procurement:update',
  PROCUREMENT_DELETE: 'procurement:delete',

  // Inventory Checker management
  INVENTORY_CHECKER_CREATE: 'inventory-checker:create',
  INVENTORY_CHECKER_READ: 'inventory-checker:read',
  INVENTORY_CHECKER_UPDATE: 'inventory-checker:update',
  INVENTORY_CHECKER_DELETE: 'inventory-checker:delete',

  // Alerts management
  ALERTS_CREATE: 'alerts:create',
  ALERTS_READ: 'alerts:read',
  ALERTS_DELETE: 'alerts:delete',

  // Staff Management Permissions
  STAFF_LIST_READ: 'staff-list:read',
  STAFF_LIST_CREATE: 'staff-list:create',
  STAFF_LIST_UPDATE: 'staff-list:update',
  STAFF_LIST_DELETE: 'staff-list:delete',
  STAFF_ATTENDANCE_READ: 'staff-attendance:read',
  STAFF_ATTENDANCE_MANAGE: 'staff-attendance:manage',
  STAFF_ADVANCE_READ: 'staff-advance:read',
  STAFF_ADVANCE_MANAGE: 'staff-advance:manage',
  STAFF_PERFORMANCE_READ: 'staff-performance:read',
  STAFF_PERFORMANCE_MANAGE: 'staff-performance:manage',
  STAFF_TARGET_READ: 'staff-target:read',
  STAFF_TARGET_MANAGE: 'staff-target:manage',
  STAFF_INCENTIVES_READ: 'staff-incentives:read',
  STAFF_INCENTIVES_MANAGE: 'staff-incentives:manage',
  STAFF_SALARY_READ: 'staff-salary:read',
  STAFF_SALARY_MANAGE: 'staff-salary:manage',

  // Expenses Management Permissions
  EXPENSES_CREATE: 'expenses:create',
  EXPENSES_READ: 'expenses:read',
  EXPENSES_UPDATE: 'expenses:update',
  EXPENSES_DELETE: 'expenses:delete',
  EXPENSES_MANAGE: 'expenses:manage',

  // Settings management
  SETTINGS_READ: 'settings:read',
  LOYALTY_SETTINGS_READ: 'loyalty_settings:read',
  LOYALTY_SETTINGS_UPDATE: 'loyalty_settings:update',
  ATTENDANCE_SETTINGS_READ: 'attendance_settings:read',
  SETTINGS_STAFF_ID_MANAGE: 'settings:staff_id:manage', // --- (1. NEW) --- Added the new permission constant
    POSITION_HOURS_SETTINGS_MANAGE: 'position_hours_settings:manage',
     SHIFT_MANAGEMENT_MANAGE: 'settings:shifts:manage', 

  ALL: '*'
} as const;

export const PERMISSION_CATEGORIES = {
  USER_MANAGEMENT: 'User Management',
  ROLE_MANAGEMENT: 'Role Management',
  CUSTOMER_MANAGEMENT: 'Customer Management',
  APPOINTMENT_MANAGEMENT: 'Appointment Management',
  STAFF_MANAGEMENT: 'Staff Management',
  EXPENSES_MANAGEMENT: 'Expenses Management',
  BILLING_MANAGEMENT: 'Billing Management',
  DASHBOARD_ACCESS: 'Dashboard Access',
  SERVICES_MANAGEMENT: 'Services Management',
  INVENTORY_MANAGEMENT: 'Inventory Management',
  STYLIST_MANAGEMENT: 'Stylist Management',
  PRODUCT_MANAGEMENT: 'Product Management',
  SERVICE_MANAGEMENT: 'Service Management',
  SETTINGS_MANAGEMENT: 'Settings Management',
  REPORTS_ACCESS: 'Reports Access',
  EB_MANAGEMENT: 'EB Management',
  PROCUREMENT_MANAGEMENT: 'Procurement Management',
  DAYEND_MANAGEMENT: 'Day-end Closing Management',
  INVENTORY_CHECKER_MANAGEMENT: 'Inventory Checker Management',
  ALERTS_MANAGEMENT: 'Alerts Management',
} as const;

export const ALL_PERMISSIONS = [
  // ... (all other existing permission descriptions are unchanged)

  // Settings Management
  { permission: PERMISSIONS.SETTINGS_READ, description: 'Access settings section', category: PERMISSION_CATEGORIES.SETTINGS_MANAGEMENT },
  { permission: PERMISSIONS.LOYALTY_SETTINGS_READ, description: 'View loyalty settings', category: PERMISSION_CATEGORIES.SETTINGS_MANAGEMENT },
  { permission: PERMISSIONS.LOYALTY_SETTINGS_UPDATE, description: 'Update loyalty settings', category: PERMISSION_CATEGORIES.SETTINGS_MANAGEMENT },
  { permission: PERMISSIONS.ATTENDANCE_SETTINGS_READ, description: 'View and manage attendance settings', category: PERMISSION_CATEGORIES.SETTINGS_MANAGEMENT },
  // --- (2. NEW) --- Added the permission description for the UI
  { permission: PERMISSIONS.SETTINGS_STAFF_ID_MANAGE, description: 'Manage Staff ID starting number', category: PERMISSION_CATEGORIES.SETTINGS_MANAGEMENT },

  // ... (all other existing permission descriptions are unchanged)

  // Super Admin
  { permission: PERMISSIONS.ALL, description: 'Full system access (Super Admin)', category: 'System Administration' }
];

// ... (Helper functions like hasPermission, hasAnyPermission, etc. are unchanged)
export const hasPermission = (userPermissions: string[], requiredPermission: string): boolean => {
  if (userPermissions.includes('*')) return true;
  if (userPermissions.includes(requiredPermission)) return true;
  return false;
};
export const hasAnyPermission = (userPermissions: string[], requiredPermissions: string[]): boolean => {
  return requiredPermissions.some(permission => hasPermission(userPermissions, permission));
};
export const hasAllPermissions = (userPermissions: string[], requiredPermissions: string[]): boolean => {
  return requiredPermissions.every(permission => hasPermission(userPermissions, permission));
};
export const getPermissionsByCategory = (category: string) => {
  return ALL_PERMISSIONS.filter(p => p.category === category);
};
export const getAllCategories = () => {
  return Object.values(PERMISSION_CATEGORIES);
};


// Predefined role templates
export const ROLE_TEMPLATES = {
  SUPER_ADMIN: {
    name: 'Super Admin',
    description: 'Full system access',
    permissions: [PERMISSIONS.ALL]
  },
  ADMIN: {
    name: 'Admin',
    description: 'Administrative access with most permissions',
    permissions: [
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.ROLES_READ,
      PERMISSIONS.CUSTOMERS_MANAGE,
      PERMISSIONS.APPOINTMENTS_MANAGE,
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.EB_VIEW_CALCULATE,
      PERMISSIONS.PROCUREMENT_CREATE,
      PERMISSIONS.PROCUREMENT_READ,
      PERMISSIONS.PROCUREMENT_UPDATE,
      PERMISSIONS.PROCUREMENT_DELETE,
      PERMISSIONS.DAYEND_MANAGE,
      PERMISSIONS.STAFF_LIST_CREATE,
      PERMISSIONS.STAFF_LIST_READ,
      PERMISSIONS.STAFF_LIST_UPDATE,
      PERMISSIONS.STAFF_LIST_DELETE,
      PERMISSIONS.STAFF_ATTENDANCE_MANAGE,
      PERMISSIONS.STAFF_ADVANCE_MANAGE,
      PERMISSIONS.STAFF_PERFORMANCE_MANAGE,
      PERMISSIONS.STAFF_TARGET_MANAGE,
      PERMISSIONS.STAFF_INCENTIVES_MANAGE,
      PERMISSIONS.STAFF_SALARY_MANAGE,
      PERMISSIONS.EXPENSES_MANAGE,
      PERMISSIONS.ATTENDANCE_SETTINGS_READ,
      PERMISSIONS.SETTINGS_STAFF_ID_MANAGE, // --- (3. NEW) --- Added to default Admin role
    ]
  },
  MANAGER: {
    name: 'Manager',
    description: 'Management access for daily operations',
    permissions: [
      PERMISSIONS.CUSTOMERS_MANAGE,
      PERMISSIONS.APPOINTMENTS_MANAGE,
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.EB_UPLOAD,
      PERMISSIONS.PROCUREMENT_CREATE,
      PERMISSIONS.PROCUREMENT_READ,
      PERMISSIONS.PROCUREMENT_UPDATE,
      PERMISSIONS.PROCUREMENT_DELETE,
      PERMISSIONS.DAYEND_CREATE,
      PERMISSIONS.DAYEND_READ,
      PERMISSIONS.DAYEND_UPDATE,
      PERMISSIONS.STAFF_LIST_READ,
      PERMISSIONS.STAFF_ATTENDANCE_MANAGE,
      PERMISSIONS.STAFF_ADVANCE_READ,
      PERMISSIONS.STAFF_PERFORMANCE_READ,
      PERMISSIONS.STAFF_TARGET_READ,
      PERMISSIONS.STAFF_INCENTIVES_READ,
      PERMISSIONS.STAFF_SALARY_READ,
      PERMISSIONS.EXPENSES_CREATE,
      PERMISSIONS.EXPENSES_READ,
      PERMISSIONS.EXPENSES_UPDATE,
    ]
  },
  STAFF: {
    name: 'Staff',
    description: 'Basic staff access for appointments and customers',
    permissions: [
      PERMISSIONS.CUSTOMERS_READ,
      PERMISSIONS.CUSTOMERS_UPDATE,
      PERMISSIONS.APPOINTMENTS_READ,
      PERMISSIONS.APPOINTMENTS_UPDATE,
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.PROCUREMENT_READ,
      PERMISSIONS.DAYEND_READ
    ]
  },
  RECEPTIONIST: {
    name: 'Receptionist',
    description: 'Front desk operations access',
    permissions: [
      PERMISSIONS.CUSTOMERS_MANAGE,
      PERMISSIONS.APPOINTMENTS_MANAGE,
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.EB_UPLOAD,
      PERMISSIONS.DAYEND_CREATE,
      PERMISSIONS.DAYEND_READ,
      PERMISSIONS.EXPENSES_CREATE,
      PERMISSIONS.EXPENSES_READ,
    ]
  }
};

// Type definitions
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export type PermissionCategory = typeof PERMISSION_CATEGORIES[keyof typeof PERMISSION_CATEGORIES];

export interface PermissionInfo {
  permission: Permission;
  description: string;
  category: PermissionCategory | string;
}

export interface RoleTemplate {
  name: string;
  description: string;
  permissions: Permission[];
}