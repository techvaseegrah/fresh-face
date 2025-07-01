'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// Define all your settings sections here
const settingsNavigation = [
  // You can add 'Shop Information' and others later
  { name: 'Loyalty Points', href: '/settings/loyalty', permission: PERMISSIONS.LOYALTY_SETTINGS_READ },
  //{ name: 'Shop Information', href: '/settings/shop-information' },
  //{ name: 'Password', href: '/settings/password' },
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
        {settingsNavigation.map((item) => (
          hasPermission(userPermissions, item.permission) && (
            <Link
              key={item.name}
              href={item.href}
              className={classNames(
                // Check if the current URL starts with the link's href
                pathname.startsWith(item.href)
                  ? 'bg-black text-white' // Active link style
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900', // Inactive link style
                'group flex items-center px-3 py-2 text-sm font-medium rounded-md'
              )}
              aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
            >
              <span className="truncate">{item.name}</span>
            </Link>
          )
        ))}
      </nav>
    </aside>
  );
}