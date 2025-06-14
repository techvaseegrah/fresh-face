// src/components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';

// --- Interfaces ---
interface NavSubItem {
  href: string;
  label: string;
  icon: JSX.Element; // Icon for the sub-item
  basePathForActive?: string;
}

interface NavItemConfig {
  href: string;
  label: string;
  icon: JSX.Element;
  subItems?: NavSubItem[];
}

// --- Main Item Icons ---
const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const AppointmentsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const CrmIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283-.356-1.857m0 0a3.004 3.004 0 01-2.732 0M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 0c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);
const StaffManagementIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M23 21v-2a4 4 0 00-3-3.87"></path>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 3.13a4 4 0 010 7.75"></path>
  </svg>
);
// --- NEW SETTINGS ICON ADDED ---
const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
  </svg>
);


// --- Sub-Item Icons ---
const AttendanceIcon = () => ( <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg> );
const AdvanceIcon = () => ( <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 18v-2m0-8a6 6 0 100 12 6 6 0 000-12z"></path></svg> );
const PerformanceIcon = () => ( <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg> );
const SalaryIcon = () => ( <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg> );
const StaffIcon = () => ( <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg> );
const TargetIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 21a9 9 0 100-18 9 9 0 000 18z"></path>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 12a3 3 0 100-6 3 3 0 000 6z"></path>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v2m0 16v2m-8-9H2m18 0h-2"></path>
    </svg>
);
const IncentivesIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"></path>
    </svg>
);

const Sidebar = () => {
  const pathname = usePathname();
  const [openItemKey, setOpenItemKey] = useState<string | null>(null);

  const navItems: NavItemConfig[] = useMemo(() => [
    { href: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { href: '/appointment', label: 'Appointments', icon: <AppointmentsIcon /> },
    { href: '/crm', label: 'Customers', icon: <CrmIcon /> },
    {
      href: '/staffmanagement',
      label: 'StaffManagement',
      icon: <StaffManagementIcon />,
      subItems: [
        { href: '/staffmanagement/attendance', label: 'Attendance', icon: <AttendanceIcon /> },
        { href: '/staffmanagement/advance', label: 'Advance', icon: <AdvanceIcon /> },
        { href: '/staffmanagement/performance', label: 'Performance', icon: <PerformanceIcon /> },
        { href: '/staffmanagement/target', label: 'Target', icon: <TargetIcon /> },
        { href: '/staffmanagement/incentives', label: 'Incentives', icon: <IncentivesIcon /> },
        { href: '/staffmanagement/salary', label: 'Salary', icon: <SalaryIcon /> },
        {
          href: '/staffmanagement/staff/stafflist',
          label: 'Staff',
          icon: <StaffIcon />,
          basePathForActive: '/staffmanagement/staff',
        },
      ],
    },
    // --- NEW SETTINGS MODULE ADDED TO NAVIGATION ---
    { href: '/settings', label: 'Settings', icon: <SettingsIcon /> },
  ], []);

  // Effect to automatically open the parent item of the active sub-item on page load
  useEffect(() => {
    let parentToOpenKey: string | null = null;
    for (const item of navItems) {
      if (item.subItems && item.subItems.length > 0) {
        const isParentOfActiveSubItem = item.subItems.some(subItem => {
          const activeCheckPath = subItem.basePathForActive || subItem.href;
          return pathname === subItem.href || (activeCheckPath !== '/' && pathname.startsWith(activeCheckPath) && (pathname.length === activeCheckPath.length || pathname[activeCheckPath.length] === '/'));
        });
        if (isParentOfActiveSubItem) {
          parentToOpenKey = item.href;
          break;
        }
      }
    }
    if (!parentToOpenKey) {
        for (const item of navItems) {
            if (item.subItems && item.subItems.length > 0) {
                if (item.href !== '/' && pathname.startsWith(item.href) && (pathname.length === item.href.length || pathname[item.href.length] === '/')) {
                    parentToOpenKey = item.href;
                    break;
                }
            }
        }
    }
    setOpenItemKey(parentToOpenKey);
  }, [pathname, navItems]);

  const handleItemClick = (itemKey: string) => {
    setOpenItemKey(openItemKey === itemKey ? null : itemKey);
  };

  const isItemOrSubitemActive = (item: NavItemConfig, currentPath: string): boolean => {
    if (currentPath === item.href) return true;
    if (item.href !== '/' && currentPath.startsWith(item.href + '/')) {
      return true;
    }
    if (item.subItems) {
      return item.subItems.some(subItem => {
        const activeCheckPath = subItem.basePathForActive || subItem.href;
        return currentPath === subItem.href || (activeCheckPath !== '/' && currentPath.startsWith(activeCheckPath) && (currentPath.length === activeCheckPath.length || currentPath[activeCheckPath.length] === '/'));
      });
    }
    return false;
  };

  return (
    <div className="w-64 h-screen bg-white text-black fixed left-0 top-0 shadow-lg overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white font-bold text-lg">FF</div>
          <h1 className="text-xl font-semibold text-gray-800">FF Project</h1>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = isItemOrSubitemActive(item, pathname);
            const isOpen = openItemKey === item.href;
            return (
              <div key={item.label}>
                {item.subItems ? (
                  <>
                    <button onClick={() => handleItemClick(item.href)} aria-expanded={isOpen} className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg transition-colors text-gray-700 ${isActive ? 'bg-gray-100 text-black font-medium' : 'hover:bg-gray-50 hover:text-black'}`}>
                      <span className="flex items-center gap-3">{item.icon}<span>{item.label}</span></span>
                      <svg className={`w-4 h-4 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-screen' : 'max-h-0'}`}>
                      {isOpen && (
                        <div className="mt-1 space-y-0.5 py-1">
                          {item.subItems.map((subItem) => {
                            const activeSubCheckPath = subItem.basePathForActive || subItem.href;
                            const isSubActive = pathname === subItem.href || (activeSubCheckPath !== '/' && pathname.startsWith(activeSubCheckPath) && (pathname.length === activeSubCheckPath.length || pathname[activeSubCheckPath.length] === '/'));
                            return (
                              <Link key={subItem.label} href={subItem.href} className={`flex items-center gap-3 pl-8 pr-4 py-2 rounded-lg transition-colors text-sm text-gray-600 ${ isSubActive ? 'bg-gray-200 text-black font-medium' : 'hover:bg-gray-100 hover:text-black' }`}>
                                {subItem.icon}
                                <span>{subItem.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <Link href={item.href} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-gray-700 ${isActive ? 'bg-gray-100 text-black font-medium' : 'hover:bg-gray-50 hover:text-black'}`}>
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-600">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
          </div>
          <div>
            <div className="font-medium text-gray-800">Owner</div>
            <div className="text-sm text-gray-500">Admin</div> {/* Lighter text for role */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;