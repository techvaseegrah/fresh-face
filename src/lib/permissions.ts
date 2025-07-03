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
  APPOINTMENTS_READ: 'appointments:read', // <-- THIS TYPO IS NOW FIXED
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

  // --- NEW: Staff Management Permissions ---
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

  // --- NEW: Expenses Management Permissions ---
  EXPENSES_CREATE: 'expenses:create',
  EXPENSES_READ: 'expenses:read',
  EXPENSES_UPDATE: 'expenses:update',
  EXPENSES_DELETE: 'expenses:delete',
  EXPENSES_MANAGE: 'expenses:manage',

  // Settings management
  SETTINGS_READ: 'settings:read',
  LOYALTY_SETTINGS_READ: 'loyalty_settings:read',
  LOYALTY_SETTINGS_UPDATE: 'loyalty_settings:update',
  // --- THIS IS THE NEW PERMISSION YOU REQUESTED ---
  ATTENDANCE_SETTINGS_READ: 'attendance_settings:read',

  ALL: '*'
} as const;

export const PERMISSION_CATEGORIES = {
  USER_MANAGEMENT: 'User Management',
  ROLE_MANAGEMENT: 'Role Management',
  CUSTOMER_MANAGEMENT: 'Customer Management',
  APPOINTMENT_MANAGEMENT: 'Appointment Management',
  STAFF_MANAGEMENT: 'Staff Management', // Added
  EXPENSES_MANAGEMENT: 'Expenses Management', // Added
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
  // User Management
  { permission: PERMISSIONS.USERS_CREATE, description: 'Create new users', category: PERMISSION_CATEGORIES.USER_MANAGEMENT },
  { permission: PERMISSIONS.USERS_READ, description: 'View user information', category: PERMISSION_CATEGORIES.USER_MANAGEMENT },
  { permission: PERMISSIONS.USERS_UPDATE, description: 'Update user information', category: PERMISSION_CATEGORIES.USER_MANAGEMENT },
  { permission: PERMISSIONS.USERS_DELETE, description: 'Delete users', category: PERMISSION_CATEGORIES.USER_MANAGEMENT },
  { permission: PERMISSIONS.USERS_MANAGE, description: 'Full user management access', category: PERMISSION_CATEGORIES.USER_MANAGEMENT },

  // Role Management
  { permission: PERMISSIONS.ROLES_CREATE, description: 'Create new roles', category: PERMISSION_CATEGORIES.ROLE_MANAGEMENT },
  { permission: PERMISSIONS.ROLES_READ, description: 'View role information', category: PERMISSION_CATEGORIES.ROLE_MANAGEMENT },
  { permission: PERMISSIONS.ROLES_UPDATE, description: 'Update role information', category: PERMISSION_CATEGORIES.ROLE_MANAGEMENT },
  { permission: PERMISSIONS.ROLES_DELETE, description: 'Delete roles', category: PERMISSION_CATEGORIES.ROLE_MANAGEMENT },
  { permission: PERMISSIONS.ROLES_MANAGE, description: 'Full role management access', category: PERMISSION_CATEGORIES.ROLE_MANAGEMENT },

  // Customer Management
  { permission: PERMISSIONS.CUSTOMERS_CREATE, description: 'Create new customers', category: PERMISSION_CATEGORIES.CUSTOMER_MANAGEMENT },
  { permission: PERMISSIONS.CUSTOMERS_READ, description: 'View customer information', category: PERMISSION_CATEGORIES.CUSTOMER_MANAGEMENT },
  { permission: PERMISSIONS.CUSTOMERS_UPDATE, description: 'Update customer information', category: PERMISSION_CATEGORIES.CUSTOMER_MANAGEMENT },
  { permission: PERMISSIONS.CUSTOMERS_DELETE, description: 'Delete customers', category: PERMISSION_CATEGORIES.CUSTOMER_MANAGEMENT },
  { permission: PERMISSIONS.CUSTOMERS_MANAGE, description: 'Full customer management access', category: PERMISSION_CATEGORIES.CUSTOMER_MANAGEMENT },

  // Appointment Management
  { permission: PERMISSIONS.APPOINTMENTS_CREATE, description: 'Create new appointments', category: PERMISSION_CATEGORIES.APPOINTMENT_MANAGEMENT },
  { permission: PERMISSIONS.APPOINTMENTS_READ, description: 'View appointment information', category: PERMISSION_CATEGORIES.APPOINTMENT_MANAGEMENT },
  { permission: PERMISSIONS.APPOINTMENTS_UPDATE, description: 'Update appointment information', category: PERMISSION_CATEGORIES.APPOINTMENT_MANAGEMENT },
  { permission: PERMISSIONS.APPOINTMENTS_DELETE, description: 'Delete appointments', category: PERMISSION_CATEGORIES.APPOINTMENT_MANAGEMENT },
  { permission: PERMISSIONS.APPOINTMENTS_MANAGE, description: 'Full appointment management access', category: PERMISSION_CATEGORIES.APPOINTMENT_MANAGEMENT },

  // --- NEW: Staff Management Permissions ---
  { permission: PERMISSIONS.STAFF_LIST_CREATE, description: 'Create new staff members', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_LIST_READ, description: 'View staff member list and details', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_LIST_UPDATE, description: 'Update staff member details', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_LIST_DELETE, description: 'Delete staff members', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_ATTENDANCE_READ, description: 'View staff attendance', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_ATTENDANCE_MANAGE, description: 'Manage (add/edit) staff attendance', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_ADVANCE_READ, description: 'View staff salary advances', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_ADVANCE_MANAGE, description: 'Manage (add/approve) staff salary advances', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_PERFORMANCE_READ, description: 'View staff performance metrics', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_PERFORMANCE_MANAGE, description: 'Manage staff performance metrics', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_TARGET_READ, description: 'View staff targets', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_TARGET_MANAGE, description: 'Manage (set/edit) staff targets', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_INCENTIVES_READ, description: 'View staff incentives', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_INCENTIVES_MANAGE, description: 'Manage staff incentives', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_SALARY_READ, description: 'View staff salary details', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_SALARY_MANAGE, description: 'Manage (process/edit) staff salaries', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },

  // --- NEW: Expenses Management Permissions ---
  { permission: PERMISSIONS.EXPENSES_CREATE, description: 'Create new expense records', category: PERMISSION_CATEGORIES.EXPENSES_MANAGEMENT },
  { permission: PERMISSIONS.EXPENSES_READ, description: 'View expense records', category: PERMISSION_CATEGORIES.EXPENSES_MANAGEMENT },
  { permission: PERMISSIONS.EXPENSES_UPDATE, description: 'Update expense records', category: PERMISSION_CATEGORIES.EXPENSES_MANAGEMENT },
  { permission: PERMISSIONS.EXPENSES_DELETE, description: 'Delete expense records', category: PERMISSION_CATEGORIES.EXPENSES_MANAGEMENT },
  { permission: PERMISSIONS.EXPENSES_MANAGE, description: 'Full access to manage expenses', category: PERMISSION_CATEGORIES.EXPENSES_MANAGEMENT },

  // Dashboard Access
  { permission: PERMISSIONS.DASHBOARD_READ, description: 'View dashboard information', category: PERMISSION_CATEGORIES.DASHBOARD_ACCESS },
  { permission: PERMISSIONS.DASHBOARD_MANAGE, description: 'Full dashboard management access', category: PERMISSION_CATEGORIES.DASHBOARD_ACCESS },

  // EB Management
  { permission: PERMISSIONS.EB_UPLOAD, description: 'Upload morning and evening meter images', category: PERMISSION_CATEGORIES.EB_MANAGEMENT },
  { permission: PERMISSIONS.EB_VIEW_CALCULATE, description: 'View meter images and calculate units/costs', category: PERMISSION_CATEGORIES.EB_MANAGEMENT },

  // Procurement Management
  { permission: PERMISSIONS.PROCUREMENT_CREATE, description: 'Create procurement records', category: PERMISSION_CATEGORIES.PROCUREMENT_MANAGEMENT },
  { permission: PERMISSIONS.PROCUREMENT_READ, description: 'View procurement records', category: PERMISSION_CATEGORIES.PROCUREMENT_MANAGEMENT },
  { permission: PERMISSIONS.PROCUREMENT_UPDATE, description: 'Update procurement records', category: PERMISSION_CATEGORIES.PROCUREMENT_MANAGEMENT },
  { permission: PERMISSIONS.PROCUREMENT_DELETE, description: 'Delete procurement records', category: PERMISSION_CATEGORIES.PROCUREMENT_MANAGEMENT },

  // Day-end Closing Management
  { permission: PERMISSIONS.DAYEND_CREATE, description: 'Create day-end closing reports', category: PERMISSION_CATEGORIES.DAYEND_MANAGEMENT },
  { permission: PERMISSIONS.DAYEND_READ, description: 'View day-end closing reports', category: PERMISSION_CATEGORIES.DAYEND_MANAGEMENT },
  { permission: PERMISSIONS.DAYEND_UPDATE, description: 'Update day-end closing reports', category: PERMISSION_CATEGORIES.DAYEND_MANAGEMENT },
  { permission: PERMISSIONS.DAYEND_DELETE, description: 'Delete day-end closing reports', category: PERMISSION_CATEGORIES.DAYEND_MANAGEMENT },
  { permission: PERMISSIONS.DAYEND_MANAGE, description: 'Full day-end closing management access', category: PERMISSION_CATEGORIES.DAYEND_MANAGEMENT },

  // --- ADDED THIS SECTION ---
  // Settings Management
  { permission: PERMISSIONS.ATTENDANCE_SETTINGS_READ, description: 'View and manage attendance settings', category: PERMISSION_CATEGORIES.SETTINGS_MANAGEMENT },
  { permission: PERMISSIONS.LOYALTY_SETTINGS_READ, description: 'View and manage loyalty point settings', category: PERMISSION_CATEGORIES.SETTINGS_MANAGEMENT },
  
  // Super Admin
  { permission: PERMISSIONS.ALL, description: 'Full system access (Super Admin)', category: 'System Administration' }
];

// Helper functions (unchanged)
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

// Predefined role templates (Updated with new permissions)
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
      // --- ADDED THIS LINE ---
      PERMISSIONS.ATTENDANCE_SETTINGS_READ,
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

// Type definitions (unchanged)
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