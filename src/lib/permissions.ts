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

  // Billing management
  BILLING_CREATE: 'billing:create',
  BILLING_READ: 'billing:read',
  BILLING_UPDATE: 'billing:update',
  BILLING_MANAGE: 'billing:manage',

  // Dashboard access
  DASHBOARD_READ: 'dashboard:read',
  DASHBOARD_MANAGE: 'dashboard:manage',

  // Services management
  SERVICES_CREATE: 'services:create',
  SERVICES_READ: 'services:read',
  SERVICES_UPDATE: 'services:update',
  SERVICES_DELETE: 'services:delete',
  SERVICES_MANAGE: 'services:manage',

  // Staff management
  STAFF_CREATE: 'staff:create',
  STAFF_READ: 'staff:read',
  STAFF_UPDATE: 'staff:update',
  STAFF_DELETE: 'staff:delete',
  STAFF_MANAGE: 'staff:manage',

  // Inventory management
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_UPDATE: 'inventory:update',
  INVENTORY_DELETE: 'inventory:delete',
  INVENTORY_MANAGE: 'inventory:manage',

  // Reports access
  REPORTS_READ: 'reports:read',
  REPORTS_EXPORT: 'reports:export',
  REPORTS_MANAGE: 'reports:manage',

  // Settings management
  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_MANAGE: 'settings:manage',

  // EB (Electricity Bill) management
  EB_UPLOAD: 'eb:upload',
  EB_VIEW_CALCULATE: 'eb:view_calculate',

  // Procurement management
  PROCUREMENT_CREATE: 'procurement:create', // Create procurement records
  PROCUREMENT_READ: 'procurement:read',   // View procurement records
  PROCUREMENT_UPDATE: 'procurement:update', // Update procurement records
  PROCUREMENT_DELETE: 'procurement:delete', // Delete procurement records

  ALL: '*'
} as const;

export const PERMISSION_CATEGORIES = {
  USER_MANAGEMENT: 'User Management',
  ROLE_MANAGEMENT: 'Role Management',
  CUSTOMER_MANAGEMENT: 'Customer Management',
  APPOINTMENT_MANAGEMENT: 'Appointment Management',
  BILLING_MANAGEMENT: 'Billing Management',
  DASHBOARD_ACCESS: 'Dashboard Access',
  SERVICES_MANAGEMENT: 'Services Management',
  STAFF_MANAGEMENT: 'Staff Management',
  INVENTORY_MANAGEMENT: 'Inventory Management',
  REPORTS_ACCESS: 'Reports Access',
  SETTINGS_MANAGEMENT: 'Settings Management',
  EB_MANAGEMENT: 'EB Management',
  PROCUREMENT_MANAGEMENT: 'Procurement Management' // New category
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

  // Billing Management
  { permission: PERMISSIONS.BILLING_CREATE, description: 'Create billing records', category: PERMISSION_CATEGORIES.BILLING_MANAGEMENT },
  { permission: PERMISSIONS.BILLING_READ, description: 'View billing information', category: PERMISSION_CATEGORIES.BILLING_MANAGEMENT },
  { permission: PERMISSIONS.BILLING_UPDATE, description: 'Update billing information', category: PERMISSION_CATEGORIES.BILLING_MANAGEMENT },
  { permission: PERMISSIONS.BILLING_MANAGE, description: 'Full billing management access', category: PERMISSION_CATEGORIES.BILLING_MANAGEMENT },

  // Dashboard Access
  { permission: PERMISSIONS.DASHBOARD_READ, description: 'View dashboard information', category: PERMISSION_CATEGORIES.DASHBOARD_ACCESS },
  { permission: PERMISSIONS.DASHBOARD_MANAGE, description: 'Full dashboard management access', category: PERMISSION_CATEGORIES.DASHBOARD_ACCESS },

  // Services Management
  { permission: PERMISSIONS.SERVICES_CREATE, description: 'Create new services', category: PERMISSION_CATEGORIES.SERVICES_MANAGEMENT },
  { permission: PERMISSIONS.SERVICES_READ, description: 'View service information', category: PERMISSION_CATEGORIES.SERVICES_MANAGEMENT },
  { permission: PERMISSIONS.SERVICES_UPDATE, description: 'Update service information', category: PERMISSION_CATEGORIES.SERVICES_MANAGEMENT },
  { permission: PERMISSIONS.SERVICES_DELETE, description: 'Delete services', category: PERMISSION_CATEGORIES.SERVICES_MANAGEMENT },
  { permission: PERMISSIONS.SERVICES_MANAGE, description: 'Full services management access', category: PERMISSION_CATEGORIES.SERVICES_MANAGEMENT },

  // Staff Management
  { permission: PERMISSIONS.STAFF_CREATE, description: 'Create new staff members', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_READ, description: 'View staff information', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_UPDATE, description: 'Update staff information', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_DELETE, description: 'Delete staff members', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },
  { permission: PERMISSIONS.STAFF_MANAGE, description: 'Full staff management access', category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT },

  // Inventory Management
  { permission: PERMISSIONS.INVENTORY_CREATE, description: 'Create inventory items', category: PERMISSION_CATEGORIES.INVENTORY_MANAGEMENT },
  { permission: PERMISSIONS.INVENTORY_READ, description: 'View inventory information', category: PERMISSION_CATEGORIES.INVENTORY_MANAGEMENT },
  { permission: PERMISSIONS.INVENTORY_UPDATE, description: 'Update inventory information', category: PERMISSION_CATEGORIES.INVENTORY_MANAGEMENT },
  { permission: PERMISSIONS.INVENTORY_DELETE, description: 'Delete inventory items', category: PERMISSION_CATEGORIES.INVENTORY_MANAGEMENT },
  { permission: PERMISSIONS.INVENTORY_MANAGE, description: 'Full inventory management access', category: PERMISSION_CATEGORIES.INVENTORY_MANAGEMENT },

  // Reports Access
  { permission: PERMISSIONS.REPORTS_READ, description: 'View reports and analytics', category: PERMISSION_CATEGORIES.REPORTS_ACCESS },
  { permission: PERMISSIONS.REPORTS_EXPORT, description: 'Export reports and data', category: PERMISSION_CATEGORIES.REPORTS_ACCESS },
  { permission: PERMISSIONS.REPORTS_MANAGE, description: 'Full reports management access', category: PERMISSION_CATEGORIES.REPORTS_ACCESS },

  // Settings Management
  { permission: PERMISSIONS.SETTINGS_READ, description: 'View system settings', category: PERMISSION_CATEGORIES.SETTINGS_MANAGEMENT },
  { permission: PERMISSIONS.SETTINGS_UPDATE, description: 'Update system settings', category: PERMISSION_CATEGORIES.SETTINGS_MANAGEMENT },
  { permission: PERMISSIONS.SETTINGS_MANAGE, description: 'Full settings management access', category: PERMISSION_CATEGORIES.SETTINGS_MANAGEMENT },

  // EB Management
  { permission: PERMISSIONS.EB_UPLOAD, description: 'Upload morning and evening meter images', category: PERMISSION_CATEGORIES.EB_MANAGEMENT },
  { permission: PERMISSIONS.EB_VIEW_CALCULATE, description: 'View meter images and calculate units/costs', category: PERMISSION_CATEGORIES.EB_MANAGEMENT },

  // Procurement Management
  { permission: PERMISSIONS.PROCUREMENT_CREATE, description: 'Create procurement records', category: PERMISSION_CATEGORIES.PROCUREMENT_MANAGEMENT },
  { permission: PERMISSIONS.PROCUREMENT_READ, description: 'View procurement records', category: PERMISSION_CATEGORIES.PROCUREMENT_MANAGEMENT },
  { permission: PERMISSIONS.PROCUREMENT_UPDATE, description: 'Update procurement records', category: PERMISSION_CATEGORIES.PROCUREMENT_MANAGEMENT },
  { permission: PERMISSIONS.PROCUREMENT_DELETE, description: 'Delete procurement records', category: PERMISSION_CATEGORIES.PROCUREMENT_MANAGEMENT },

  // Super Admin
  { permission: PERMISSIONS.ALL, description: 'Full system access (Super Admin)', category: 'System Administration' }
];

export const hasPermission = (userPermissions: string[], requiredPermission: string): boolean => {
  // Super admin has all permissions
  if (userPermissions.includes('*')) return true;
  
  // Direct permission match
  if (userPermissions.includes(requiredPermission)) return true;
  
  return false;
};

// Helper function to check multiple permissions (user needs ANY of the permissions)
export const hasAnyPermission = (userPermissions: string[], requiredPermissions: string[]): boolean => {
  return requiredPermissions.some(permission => hasPermission(userPermissions, permission));
};

// Helper function to check multiple permissions (user needs ALL of the permissions)
export const hasAllPermissions = (userPermissions: string[], requiredPermissions: string[]): boolean => {
  return requiredPermissions.every(permission => hasPermission(userPermissions, permission));
};

// Helper function to get permissions by category
export const getPermissionsByCategory = (category: string) => {
  return ALL_PERMISSIONS.filter(p => p.category === category);
};

// Helper function to get all categories
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
      PERMISSIONS.BILLING_MANAGE,
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.SERVICES_MANAGE,
      PERMISSIONS.STAFF_MANAGE,
      PERMISSIONS.INVENTORY_MANAGE,
      PERMISSIONS.REPORTS_MANAGE,
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.EB_VIEW_CALCULATE,
      PERMISSIONS.PROCUREMENT_CREATE, // Added
      PERMISSIONS.PROCUREMENT_READ,   // Added
      PERMISSIONS.PROCUREMENT_UPDATE, // Added
      PERMISSIONS.PROCUREMENT_DELETE  // Added
    ]
  },
  MANAGER: {
    name: 'Manager',
    description: 'Management access for daily operations',
    permissions: [
      PERMISSIONS.CUSTOMERS_MANAGE,
      PERMISSIONS.APPOINTMENTS_MANAGE,
      PERMISSIONS.BILLING_READ,
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.SERVICES_READ,
      PERMISSIONS.STAFF_READ,
      PERMISSIONS.INVENTORY_UPDATE,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.EB_UPLOAD,
      PERMISSIONS.PROCUREMENT_CREATE, // Added
      PERMISSIONS.PROCUREMENT_READ,   // Added
      PERMISSIONS.PROCUREMENT_UPDATE, // Added
      PERMISSIONS.PROCUREMENT_DELETE  // Added
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
      PERMISSIONS.SERVICES_READ,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.PROCUREMENT_READ // Added
    ]
  },
  RECEPTIONIST: {
    name: 'Receptionist',
    description: 'Front desk operations access',
    permissions: [
      PERMISSIONS.CUSTOMERS_MANAGE,
      PERMISSIONS.APPOINTMENTS_MANAGE,
      PERMISSIONS.BILLING_READ,
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.SERVICES_READ,
      PERMISSIONS.EB_UPLOAD
    ]
  }
};

// Type definitions for better TypeScript support
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