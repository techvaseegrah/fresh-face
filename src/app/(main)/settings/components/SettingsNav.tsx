// This is the complete SettingsNav component with the new link added.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// Define all your settings sections in the desired order
const settingsNavigation = [
  // { 
  //   name: 'Shop Information', 
  //   href: '/settings', // The root page for settings
  //   permission: PERMISSIONS.SETTINGS_SHOP_INFO_MANAGE 
  // },
  { 
    name: 'Attendance Settings', 
    href: '/settings/attendancesetting',
    permission: PERMISSIONS.ATTENDANCE_SETTINGS_READ 
  },
  { 
    name: 'Position Hours', 
    href: '/settings/position-hours', 
    permission: PERMISSIONS.POSITION_HOURS_SETTINGS_MANAGE 
  },
  // --- (NEW) ADDED THIS OBJECT FOR THE SHIFT MANAGEMENT PAGE ---
  // { 
  //   name: 'Shift Management', 
  //   href: '/settings/shifts', 
  //   permission: PERMISSIONS.SHIFT_MANAGEMENT_MANAGE // Assumes you created this permission
  // },
  // -----------------------------------------------------------
  { 
    name: 'Loyalty Points', 
    href: '/settings/loyalty', 
    permission: PERMISSIONS.LOYALTY_SETTINGS_READ 
  },
  { 
    name: 'Staff ID', 
    href: '/settings/staffid', 
    permission: PERMISSIONS.SETTINGS_STAFF_ID_MANAGE 
  },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function SettingsNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userPermissions = session?.user?.role?.permissions || [];

  return (
    <aside className="w-64 flex-shrink-0 border-r border-gray-200">
      <nav className="flex flex-col space-y-1 p-4">
        {settingsNavigation.map((item) => {
          // Check if the user has permission to see this item
          if (!hasPermission(userPermissions, item.permission)) {
            return null; // Don't render the link if no permission
          }

          // Improved logic for determining the active link.
          const isActive = (item.href === '/settings')
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={classNames(
                isActive
                  ? 'bg-black text-white'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
                'group flex items-center px-3 py-2 text-sm font-medium rounded-md'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}