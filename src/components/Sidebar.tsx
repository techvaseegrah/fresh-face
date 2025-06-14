'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import {
  HomeIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  CreditCardIcon,
  UsersIcon,
  CogIcon,
  PowerIcon,
  LightBulbIcon,
  DocumentTextIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/outline';

const Sidebar = () => {
  const pathname = usePathname();
  const { data: session } = useSession();

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  // Check permissions for navigation items
  const canAccessDashboard = session && hasPermission(session.user.role.permissions, PERMISSIONS.DASHBOARD_READ);
  const canAccessCustomers = session && hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_READ);
  const canAccessAppointments = session && hasPermission(session.user.role.permissions, PERMISSIONS.APPOINTMENTS_READ);
  const canAccessBilling = session && hasPermission(session.user.role.permissions, PERMISSIONS.BILLING_READ);
  const canAccessUsers = session && hasPermission(session.user.role.permissions, PERMISSIONS.USERS_READ);
  const canAccessRoles = session && hasPermission(session.user.role.permissions, PERMISSIONS.ROLES_READ);
  const canAccessEBUpload = session && hasPermission(session.user.role.permissions, PERMISSIONS.EB_UPLOAD);
  const canAccessEBViewCalculate = session && hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE);
  const canAccessProcurement = session && hasPermission(session.user.role.permissions, PERMISSIONS.PROCUREMENT_READ);

  const navItems = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: HomeIcon,
      show: canAccessDashboard
    },
    {
      href: '/appointment',
      label: 'Bookings',
      icon: CalendarDaysIcon,
      show: canAccessAppointments
    },
    {
      href: '/crm',
      label: 'Customers',
      icon: UserGroupIcon,
      show: canAccessCustomers
    },
    {
      href: '/eb-upload',
      label: 'EB Upload',
      icon: LightBulbIcon,
      show: canAccessEBUpload
    },
    {
      href: '/eb-view',
      label: 'EB View & Calculate',
      icon: DocumentTextIcon,
      show: canAccessEBViewCalculate
    },
    {
      href: '/procurement',
      label: 'Procurements', // Changed from 'name' to 'label'
      icon: ShoppingCartIcon,
      show: canAccessProcurement // Changed from 'permission' to 'show'
    },
  ];

  const adminItems = [
    {
      href: '/admin/users',
      label: 'Users',
      icon: UsersIcon,
      show: canAccessUsers
    },
    {
      href: '/admin/roles',
      label: 'Roles',
      icon: CogIcon,
      show: canAccessRoles
    }
  ];

  // Filter items based on permissions
  const visibleNavItems = navItems.filter(item => item.show);
  const visibleAdminItems = adminItems.filter(item => item.show);

  return (
    <div className="w-64 h-screen bg-white text-black fixed left-0 top-0 shadow-lg flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white font-bold text-lg">
            FF
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Fresh Face</h1>
            <p className="text-xs text-gray-500">Food Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        <nav className="p-4 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 ${isActive
                    ? 'bg-gray-100 text-black font-medium'
                    : 'hover:bg-gray-50 hover:text-black'
                  }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Admin Section */}
          {visibleAdminItems.length > 0 && (
            <>
              <div className="pt-6 pb-2">
                <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Administration
                </p>
              </div>
              {visibleAdminItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 ${isActive
                        ? 'bg-gray-100 text-black font-medium'
                        : 'hover:bg-gray-50 hover:text-black'
                      }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>
      </div>

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-gray-200">
        {session && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-4 py-2">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-gray-600">
                  {session.user.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {session.user.name}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {session.user.role.displayName || session.user.role.name}
                </div>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <PowerIcon className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;