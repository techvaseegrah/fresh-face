'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { hasAnyPermission, PERMISSIONS } from '@/lib/permissions'; // Use hasAnyPermission
import {
  HomeIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  CreditCardIcon,
  UsersIcon,
  CogIcon,
  Cog6ToothIcon,
  PowerIcon,
  LightBulbIcon,
  DocumentTextIcon,
  ShoppingCartIcon,
  BuildingStorefrontIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import { BeakerIcon } from 'lucide-react';

const Sidebar = () => {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (pathname === '/login' || pathname === '/signup') {
    return null;
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  const userPermissions = session?.user?.role?.permissions || [];

  // --- CORRECTED PERMISSION CHECKS ---
  // A user can see the module if they have ANY permission related to it.
  const canAccessDashboard = hasAnyPermission(userPermissions, [PERMISSIONS.DASHBOARD_READ, PERMISSIONS.DASHBOARD_MANAGE]);
  const canAccessAppointments = hasAnyPermission(userPermissions, [PERMISSIONS.APPOINTMENTS_READ, PERMISSIONS.APPOINTMENTS_CREATE, PERMISSIONS.APPOINTMENTS_UPDATE, PERMISSIONS.APPOINTMENTS_DELETE]);
  const canAccessCustomers = hasAnyPermission(userPermissions, [PERMISSIONS.CUSTOMERS_READ, PERMISSIONS.CUSTOMERS_CREATE, PERMISSIONS.CUSTOMERS_UPDATE, PERMISSIONS.CUSTOMERS_DELETE]);
  
  // The Shop module is visible if the user can read ANY of its sub-modules.
  const canAccessShop = hasAnyPermission(userPermissions, [PERMISSIONS.PRODUCTS_READ, PERMISSIONS.SERVICES_READ, PERMISSIONS.STYLISTS_READ]);
  
  const canAccessEBUpload = hasAnyPermission(userPermissions, [PERMISSIONS.EB_UPLOAD]);
  const canAccessEBViewCalculate = hasAnyPermission(userPermissions, [PERMISSIONS.EB_VIEW_CALCULATE]);
  const canAccessProcurement = hasAnyPermission(userPermissions, [PERMISSIONS.PROCUREMENT_READ, PERMISSIONS.PROCUREMENT_CREATE, PERMISSIONS.PROCUREMENT_UPDATE, PERMISSIONS.PROCUREMENT_DELETE]);
  const canAccessDayEnd = hasAnyPermission(userPermissions, [PERMISSIONS.DAYEND_READ, PERMISSIONS.DAYEND_CREATE]);


  // Admin section visibility
  const canAccessAdmin = hasAnyPermission(userPermissions, [PERMISSIONS.USERS_READ, PERMISSIONS.ROLES_READ]);
  const canAccessUsers = hasAnyPermission(userPermissions, [PERMISSIONS.USERS_READ]);
  const canAccessRoles = hasAnyPermission(userPermissions, [PERMISSIONS.ROLES_READ]);
  
  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: HomeIcon, show: canAccessDashboard },
    { href: '/appointment', label: 'Appointments', icon: CalendarDaysIcon, show: canAccessAppointments },
    { href: '/crm', label: 'Customers', icon: UserGroupIcon, show: canAccessCustomers },
    { href: '/shop', label: 'Shop', icon: BuildingStorefrontIcon, show: canAccessShop },
    { href: '/eb-upload', label: 'EB Upload', icon: LightBulbIcon, show: canAccessEBUpload },
    { href: '/eb-view', label: 'EB View & Calculate', icon: DocumentTextIcon, show: canAccessEBViewCalculate },
    { href: '/procurement', label: 'Procurements', icon: ShoppingCartIcon, show: canAccessProcurement },
    { href:'/DayendClosing', label:'Day-end Closing', icon:BanknotesIcon, show: canAccessDayEnd },
        { href: '/inventory-checker', label: 'Inventory Checker', icon: BeakerIcon, show: true },

    {href:'/settings',label:'Settings',icon:Cog6ToothIcon,show:canAccessAdmin}
  ];

  const adminItems = [
    { href: '/admin/users', label: 'Users', icon: UsersIcon, show: canAccessUsers },
    { href: '/admin/roles', label: 'Roles', icon: CogIcon, show: canAccessRoles }
  ];

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
            <p className="text-xs text-gray-500">Salon Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        <nav className="p-4 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link key={item.label} href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 ${
                  isActive ? 'bg-gray-100 text-black font-medium' : 'hover:bg-gray-50 hover:text-black'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Admin Section */}
          {canAccessAdmin && (
            <>
              <div className="pt-6 pb-2">
                <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Administration
                </p>
              </div>
              {visibleAdminItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);

                return (
                  <Link key={item.label} href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 ${
                      isActive ? 'bg-gray-100 text-black font-medium' : 'hover:bg-gray-50 hover:text-black'
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
            <button onClick={handleSignOut}
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