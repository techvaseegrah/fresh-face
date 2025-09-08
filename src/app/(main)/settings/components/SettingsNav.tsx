'use client'; // This component needs to be a client component because of the hooks

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { useState } from 'react';

const settingsNavigation = [
  { 
    name: 'Attendance Settings', 
    href: '/settings/attendancesetting',
    permission: PERMISSIONS.ATTENDANCE_SETTINGS_READ 
  },
  { 
    name: 'Loyalty Points', 
    href: '/settings/loyalty', 
    permission: PERMISSIONS.LOYALTY_SETTINGS_READ 
  },
  { 
    name: 'Membership', 
    href: '/settings/membership', 
    permission: PERMISSIONS.MEMBERSHIP_SETTINGS_READ 
  }, 
  { 
    name: 'Position Hours', 
    href: '/settings/position-hours', 
    permission: PERMISSIONS.POSITION_HOURS_SETTINGS_MANAGE 
  },
  { 
    name: 'Staff ID', 
    href: '/settings/staffid', 
    permission: PERMISSIONS.SETTINGS_STAFF_ID_MANAGE 
  },
  { 
    name: 'Gift Cards', 
    href: '/settings/gift-cards', 
    permission: PERMISSIONS.GIFT_CARD_SETTINGS_MANAGE // Assuming you might change this to _READ
  },
  // --- START ADDITION ---
  { 
    name: 'Packages', 
    href: '/settings/package', 
    permission: PERMISSIONS.PACKAGES_SETTINGS_READ // Link visibility is controlled by the READ permission
  },
  // --- END ADDITION ---
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function SettingsNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userPermissions = session?.user?.role?.permissions || [];
  const [showMobileNav, setShowMobileNav] = useState(false);

  // Get current page name for mobile header
  const currentPage = settingsNavigation.find(item => 
    pathname.startsWith(item.href) && hasPermission(userPermissions, item.permission)
  );

  return (
    <>
      {/* Mobile Navigation */}
      <div className="md:hidden">
        {/* Mobile Header */}
        <div className="bg-white border-b border-gray-200 px-3 sm:px-4 lg:px-6 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-semibold text-gray-900">Settings</h1>
              {currentPage && (
                <span className="text-xs text-gray-500 hidden sm:block">{currentPage.name}</span>
              )}
            </div>
            <button 
              onClick={() => setShowMobileNav(!showMobileNav)}
              className="p-1 sm:p-2 rounded-lg text-gray-600 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
              aria-label="Toggle navigation"
            >
              {showMobileNav ? (
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Overlay */}
        {showMobileNav && (
          <>
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-20" 
              onClick={() => setShowMobileNav(false)}
            ></div>
            <div className="fixed top-[72px] left-0 right-0 bg-white border-b border-gray-200 z-30 shadow-lg">
              <div className="px-3 sm:px-4 py-4 space-y-2 max-h-[50vh] overflow-y-auto">
                {settingsNavigation.map((item) => (
                  hasPermission(userPermissions, item.permission) && (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setShowMobileNav(false)}
                      className={classNames(
                        pathname.startsWith(item.href)
                          ? 'bg-green-600 text-white shadow-sm'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
                        'group flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg min-h-[44px] transition-colors duration-200'
                      )}
                      aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
                    >
                      <span className="truncate">{item.name}</span>
                      {pathname.startsWith(item.href) && (
                        <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </Link>
                  )
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Desktop Navigation */}
      <aside className="hidden md:block w-64 flex-shrink-0 border-r border-gray-200">
        <nav className="flex flex-col space-y-1 p-4">
          {settingsNavigation.map((item) => (
            // The hasPermission check will now automatically handle visibility
            hasPermission(userPermissions, item.permission) && (
              <Link
                key={item.name}
                href={item.href}
                className={classNames(
                  pathname.startsWith(item.href)
                    ? 'bg-green-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
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
    </>
  );
}