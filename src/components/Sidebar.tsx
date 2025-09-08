// src/components/Sidebar.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import { hasAnyPermission, PERMISSIONS } from '@/lib/permissions';

// --- ICONS ---
import {
  HomeIcon, CalendarDaysIcon, UserGroupIcon, UsersIcon, CogIcon, Cog6ToothIcon, PowerIcon,
  LightBulbIcon, DocumentTextIcon, ShoppingCartIcon, BuildingStorefrontIcon, BanknotesIcon,
  BellAlertIcon, ReceiptPercentIcon, ChevronDownIcon, ChartBarIcon, XMarkIcon, BriefcaseIcon,
  ArrowLeftOnRectangleIcon,ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
import { BeakerIcon, ClipboardList, PhoneForwarded, BarChartBig, PencilIcon, BookOpenIcon, ScaleIcon } from 'lucide-react';
import { DocumentCheckIcon } from '@heroicons/react/24/solid';


// --- CUSTOM ICONS ---
const AttendanceIcon = () => ( <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg> );
const AdvanceIcon = () => ( <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08 .402 2.599 1M12 8V7m0 1v.01M12 18v-2m0-8a6 6 0 100 12 6 6 0 000-12z"></path></svg> );
const PerformanceIcon = () => ( <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg> );
const SalaryIcon = () => ( <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg> );
const StaffListIcon = () => ( <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg> );
const TargetIcon = () => ( <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 21a9 9 0 100-18 9 9 0 000 18z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 12a3 3 0 100-6 3 3 0 000 6z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v2m0 16v2m-8-9H2m18 0h-2"></path></svg> );
const IncentivesIcon = () => ( <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"></path></svg> );
const SwiftIcon = () => ( <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> );

// --- LOGO ICON FOR COLLAPSED SIDEBAR (ENLARGED) ---
const LogoIcon = () => (
    <div className="relative h-12 w-12 overflow-hidden rounded-full">
        <Image
            src="/image.png" // Path to your Salon Capp logo
            alt="Salon Capp Icon"
            fill
            className="object-contain"
        />
    </div>
);

// --- INTERFACES ---
interface NavSubItem { href: string; label: string; icon: JSX.Element; show: boolean; basePathForActive?: string; }
interface NavItemConfig { href: string; label: string; icon: JSX.Element; show: boolean; subItems?: NavSubItem[]; }
interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

// --- MAIN COMPONENT ---
const Sidebar = ({ sidebarOpen, setSidebarOpen, isExpanded, setIsExpanded }: SidebarProps) => {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  
  const [isMobile, setIsMobile] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);
  const [openItemKey, setOpenItemKey] = useState<string | null>(null);
  
  const userPermissions = useMemo(() => session?.user?.role?.permissions || [], [session]);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768); // Tailwind's 'md' breakpoint
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, sidebarOpen]);

  // --- NAVIGATION DATA ---
  const navItems = useMemo((): NavItemConfig[] => {
    // ... (Your navItems array definition is fine, keeping it collapsed for brevity)
    const staffSubItems: NavSubItem[] = [
      { href: '/staffmanagement/attendance', label: 'Attendance', icon: <AttendanceIcon />, show: hasAnyPermission(userPermissions, [PERMISSIONS.STAFF_ATTENDANCE_READ]) },
      { href: '/staffmanagement/advance', label: 'Advance', icon: <AdvanceIcon />, show: hasAnyPermission(userPermissions, [PERMISSIONS.STAFF_ADVANCE_READ]) },
      { href: '/staffmanagement/performance', label: 'Performance', icon: <PerformanceIcon />, show: hasAnyPermission(userPermissions, [PERMISSIONS.STAFF_PERFORMANCE_READ]) },
      { href: '/staffmanagement/target', label: 'Target', icon: <TargetIcon />, show: hasAnyPermission(userPermissions, [PERMISSIONS.STAFF_TARGET_READ]) },
      { href: '/staffmanagement/incentives', label: 'Incentives', icon: <IncentivesIcon />, show: hasAnyPermission(userPermissions, [PERMISSIONS.STAFF_INCENTIVES_READ]) },
      { href: '/staffmanagement/incentive-payout', label: 'Incentive Payout', icon: <AdvanceIcon />, show: hasAnyPermission(userPermissions, [PERMISSIONS.STAFF_INCENTIVE_PAYOUT_READ]) },
      { href: '/staffmanagement/salary', label: 'Salary', icon: <SalaryIcon />, show: hasAnyPermission(userPermissions, [PERMISSIONS.STAFF_SALARY_READ]) },
      { href: '/staffmanagement/staff/stafflist', label: 'Staff List', icon: <StaffListIcon />, show: hasAnyPermission(userPermissions, [PERMISSIONS.STAFF_LIST_READ]), basePathForActive: '/staffmanagement/staff' },
      { href: '/staffmanagement/swift', label: 'Shift Management', icon: <SwiftIcon />, show: hasAnyPermission(userPermissions, [PERMISSIONS.STAFF_SWIFT_MANAGE]) },
      { href: '/staffmanagement/leave', label: 'Leave', icon:<PowerIcon className="h-5 w-5"/>, show: hasAnyPermission(userPermissions, [PERMISSIONS.STAFF_LEAVE_MANAGE]) },
    ];
    const adminSubItems: NavSubItem[] = [
      { href: '/admin/users', label: 'Users', icon: <UsersIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.USERS_READ]) },
      { href: '/admin/roles', label: 'Roles', icon: <CogIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.ROLES_READ]) },
      { href: '/admin/tenants', label: 'Stores', icon: <BuildingStorefrontIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.TENANTS_CREATE]) }
    ];
    const budgetSubItems: NavSubItem[] = [
      { href: '/budgets/setup', label: 'Budget Setup', icon: <CogIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.BUDGET_MANAGE]) },
      { href: '/budgets/tracker', label: 'Budget Tracker', icon: <ChartBarIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.BUDGET_READ]) },
    ];
    
    const sopSubItems: NavSubItem[] = [
      { href: '/sop', label: 'SOP Library', icon: <ClipboardList className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.SOP_READ]) },
      { href: '/sop/tasks', label: 'My Daily Tasks', icon: <DocumentCheckIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.SOP_SUBMIT_CHECKLIST]) },
      { href: '/sop/compliance', label: 'Compliance Report', icon: <ChartBarIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.SOP_REPORTS_READ]) }
    ];

    const taskSubItems: NavSubItem[] = [
        { href: '/task', label: 'Task Library', icon: <ClipboardDocumentListIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.TASK_READ]) },
        { href: '/task/my-tasks', label: 'My Daily Tasks', icon: <DocumentCheckIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.TASK_SUBMIT_CHECKLIST]) },
        { href: '/task/compliance', label: 'Task Compliance Report', icon: <ChartBarIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.TASK_REPORTS_READ]) }
    ];

    const telecallingSubItems: NavSubItem[] = [
        { href: '/telecalling', label: 'Telecalling', icon: <PhoneForwarded className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.TELECALLING_PERFORM]) },
    ];
    const reconciliationSubItems: NavSubItem[] = [
      { href: '/back-office/reconciliation', label: 'Daily Entry', icon: <PencilIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.RECONCILIATION_READ]), },
      { href: '/back-office/reconciliation/history', label: 'History Report', icon: <BookOpenIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.RECONCILIATION_READ])},
      { href: '/back-office/pnl-summary', label: 'Profit-loss', icon: <ChartBarIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.PROFIT_LOSS_READ])},
      { href: '/back-office/monthly-comparison', label: 'profit-loss comparison', icon: <ScaleIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.PROFIT_LOSS_READ])},
    ];

    const reportSubItems: NavSubItem[] = [
      { 
          href: '/sales-report', 
          label: 'Sales Report', 
          icon: <DocumentTextIcon className="h-5 w-5" />, 
          show: hasAnyPermission(userPermissions, [PERMISSIONS.SALES_REPORT_READ]) 
      },
      { 
          href: '/reports/gift-card-sold', 
          label: 'Gift Card Sold', 
          icon: <DocumentTextIcon className="h-5 w-5" />, 
          show: hasAnyPermission(userPermissions, [PERMISSIONS.REPORT_GIFT_CARD_SOLD_READ]) 
      },
      { 
          href: '/reports/gift-card-redemption', 
          label: 'Gift Card Redemption', 
          icon: <DocumentTextIcon className="h-5 w-5" />, 
          show: hasAnyPermission(userPermissions, [PERMISSIONS.REPORT_GIFT_CARD_REDEMPTION_READ]) 
      },
      { 
          href: '/reports/package-sales', 
          label: 'Package Sales', 
          icon: <DocumentTextIcon className="h-5 w-5" />, 
          show: hasAnyPermission(userPermissions, [PERMISSIONS.PACKAGES_REPORTS_READ]) 
      },
      { 
          href: '/reports/package-redemptions', 
          label: 'Package Redemptions', 
          icon: <DocumentTextIcon className="h-5 w-5" />, 
          show: hasAnyPermission(userPermissions, [PERMISSIONS.PACKAGES_REPORTS_READ]) 
      },
    ];

    const canSeeStaffManagement = staffSubItems.some(item => item.show);
    const canSeeAdministration = adminSubItems.some(item => item.show);
    const canSeeBudgetManagement = budgetSubItems.some(item => item.show);
    const canSeeTelecalling = telecallingSubItems.some(item => item.show);
    const canSeeSopManagement = sopSubItems.some(item => item.show);
    const canSeeTaskManagement = taskSubItems.some(item => item.show);
    const canSeeReconciliation = reconciliationSubItems.some(item => item.show);
    const canSeeReports = reportSubItems.some(item => item.show);
    
    return [
      { href: '/dashboard', label: 'Dashboard', icon: <HomeIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.DASHBOARD_READ, PERMISSIONS.DASHBOARD_MANAGE]) },
      { href: '/appointment', label: 'Appointments', icon: <CalendarDaysIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.APPOINTMENTS_READ, PERMISSIONS.APPOINTMENTS_CREATE]) },
      { href: '/crm', label: 'Customers', icon: <UserGroupIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.CUSTOMERS_READ, PERMISSIONS.CUSTOMERS_CREATE]) },
      { href: '/shop', label: 'Shop', icon: <BuildingStorefrontIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.PRODUCTS_READ, PERMISSIONS.SERVICES_READ]) },
      { 
        href: '/reports', 
        label: 'Reports', 
        icon: <ChartBarIcon className="h-5 w-5" />, 
        show: canSeeReports, 
        subItems: reportSubItems.filter(item => item.show) 
      },
      { href: '/staffmanagement', label: 'Staff Management', icon: <UsersIcon className="h-5 w-5" />, show: canSeeStaffManagement, subItems: staffSubItems.filter(item => item.show) },
      { href: '/DayendClosing', label:'Day-end Closing', icon: <BanknotesIcon className="h-5 w-5"/>, show: hasAnyPermission(userPermissions, [PERMISSIONS.DAYEND_READ, PERMISSIONS.DAYEND_CREATE]) },
      { href: '/alerts', label: 'Alerts', icon: <BellAlertIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.ALERTS_READ]) },
      { href: '/procurement', label: 'Procurements', icon: <ShoppingCartIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.PROCUREMENT_READ, PERMISSIONS.PROCUREMENT_CREATE]) },
      { href: '/eb-upload', label: 'EB Upload', icon: <LightBulbIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.EB_UPLOAD]) },
      { href: '/eb-view', label: 'EB View & Calculate', icon: <DocumentTextIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.EB_VIEW_CALCULATE]) },
      { href: '/inventory-checker', label: 'Inventory Checker', icon: <BeakerIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.INVENTORY_CHECKER_READ]) },
      { href: '/expenses', label: 'Expenses', icon: <ReceiptPercentIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [PERMISSIONS.EXPENSES_READ]) },
      { href: '/budgets', label: 'Budget Management', icon: <BanknotesIcon className="h-5 w-5" />, show: canSeeBudgetManagement, subItems: budgetSubItems.filter(item => item.show) },
      
      { href: '/sop', label: 'SOP Management', icon: <ClipboardList className="h-5 w-5" />, show: canSeeSopManagement, subItems: sopSubItems.filter(item => item.show) },
      { href: '/task-management', label: 'Task Management', icon: <ClipboardDocumentListIcon className="h-5 w-5" />, show: canSeeTaskManagement, subItems: taskSubItems.filter(item => item.show) },
      { href: '/telecalling',label: 'Telecalling',icon: <PhoneForwarded className="h-5 w-5" />,show: canSeeTelecalling,subItems: telecallingSubItems.filter(item => item.show)},
      { 
        href: '/back-office/reconciliation', 
        label: 'Back Office', 
        icon: <BriefcaseIcon className="h-5 w-5" />,
        show: canSeeReconciliation, 
        subItems: reconciliationSubItems.filter(item => item.show) 
      },
      { href: '/admin', label: 'Administration', icon: <Cog6ToothIcon className="h-5 w-5" />, show: canSeeAdministration, subItems: adminSubItems.filter(item => item.show) },
      { href: '/settings', label: 'Settings', icon: <Cog6ToothIcon className="h-5 w-5" />, show: hasAnyPermission(userPermissions, [ PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_STAFF_ID_MANAGE, PERMISSIONS.ATTENDANCE_SETTINGS_READ, PERMISSIONS.LOYALTY_SETTINGS_READ, ])},
    ];
  }, [userPermissions]);
  
  useEffect(() => {
    if (status !== 'authenticated') return;
    const activeParent = navItems.find(item => item.subItems?.some(subItem => {
      const activeCheckPath = subItem.basePathForActive || subItem.href;
      if (item.href === '/reports') {
        return pathname.startsWith('/reports/') || pathname.startsWith('/sales-report');
      }
      return pathname.startsWith(activeCheckPath);
    }));
    setOpenItemKey(activeParent?.href || null);
  }, [pathname, navItems, status]);
  
  const handleSignOut = () => signOut({ callbackUrl: '/login' });
  const handleItemClick = (itemKey: string) => setOpenItemKey(openItemKey === itemKey ? null : itemKey);
  const handleMouseEnter = () => !isMobile && setIsExpanded(true);
  const handleMouseLeave = () => !isMobile && setIsExpanded(false);

  const handleNavClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };
  
  const isItemOrSubitemActive = (item: NavItemConfig, currentPath: string): boolean => {
    if (item.subItems?.length) {
      if (item.href === '/reports') {
        return currentPath.startsWith('/reports/') || currentPath.startsWith('/sales-report');
      }
      return item.subItems.some(subItem => currentPath.startsWith(subItem.basePathForActive || subItem.href));
    }
    if (currentPath === '/') {
        return item.href === '/dashboard';
    }
    return currentPath.startsWith(item.href);
  };
  
  const renderNavItems = (items: NavItemConfig[]) => {
    return items.filter(item => item.show).map((item) => {
      const isActive = isItemOrSubitemActive(item, pathname);
      const isAccordionOpen = openItemKey === item.href;

      return (
        <div key={item.href} className="relative group">
          {item.subItems?.length ? (
            <>
              <button 
                onClick={() => handleItemClick(item.href)}
                className={clsx(
                  'flex items-center w-full rounded-md transition-colors duration-200 text-left text-sm font-medium',
                  isActive 
                    ? 'bg-[#f0f9eb] text-[#4d7c0f] font-semibold' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  (isExpanded || isMobile) ? "justify-between p-2.5" : "justify-center p-2.5"
                )}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  {(isExpanded || isMobile) && <span>{item.label}</span>}
                </div>
                {(isExpanded || isMobile) && <ChevronDownIcon className={clsx('w-4 h-4 transition-transform', isAccordionOpen && 'rotate-180')} />}
              </button>
              <div className={clsx('overflow-hidden transition-all duration-300 ease-in-out', isAccordionOpen ? 'max-h-screen' : 'max-h-0')}>
                {(isExpanded || isMobile) && isAccordionOpen && (
                  <div className="mt-1 space-y-1 py-1 pl-8">
                    {item.subItems.map((subItem) => {
                      const isSubActive = pathname.startsWith(subItem.basePathForActive || subItem.href);
                      return (
                        <Link onClick={handleNavClick} key={subItem.href} href={subItem.href} className={clsx(
                          'flex items-center gap-3 w-full p-2 rounded-md transition-colors text-sm font-medium',
                          isSubActive 
                            ? 'bg-[#f0f9eb] text-[#4d7c0f] font-semibold' 
                            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                        )}>
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
            <Link
              href={item.href}
              className={clsx(
                'flex items-center gap-3 w-full rounded-md transition-colors duration-200 text-sm font-medium',
                isActive 
                  ? 'bg-[#f0f9eb] text-[#4d7c0f] font-semibold'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                (isExpanded || isMobile) ? "justify-start p-2.5" : "justify-center p-2.5"
              )}
              onClick={handleNavClick}
            >
              {item.icon}
              {(isExpanded || isMobile) && <span>{item.label}</span>}
            </Link>
          )}

          {!isExpanded && !isMobile && (
            <div className="absolute left-full ml-3 px-3 py-2 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
              {item.label}
              <div className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45"></div>
            </div>
          )}
        </div>
      );
    });
  };

  const SidebarContent = ({ forMobile = false }) => (
    <div className="flex flex-col w-full h-full bg-white text-black shadow-lg overflow-hidden border-r border-gray-200">
        <div className={clsx(
            "flex items-center border-b border-gray-200 flex-shrink-0 transition-all duration-300",
            (isExpanded || forMobile) ? "p-4 h-[65px] justify-between" : "py-3 h-[65px] justify-center"
        )}>
          <div className={clsx("flex items-center gap-3", !(isExpanded || forMobile) && "opacity-0 w-0 h-0 pointer-events-none")}>
            <div className="relative h-12 w-12 flex-shrink-0">
                <Image
                    src="/image.png"
                    alt="Salon Capp Logo"
                    fill
                    className="object-contain"
                    priority
                />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-800">Salon Capp</h1>
              <p className="text-xs text-gray-500">Salon Management</p>
            </div>
          </div>
          {!(isExpanded || forMobile) && <LogoIcon />}
          {forMobile && (
            <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-gray-800">
              <XMarkIcon className="h-6 w-6" />
            </button>
          )}
        </div>
        <nav ref={scrollRef} className="flex-1 p-2 space-y-1 overflow-y-auto">
          {renderNavItems(navItems)}
        </nav>
        <div className="p-2 border-t border-gray-200">
          {session && (
             <div className={clsx("flex items-center gap-3 rounded-md p-2 transition-colors", "hover:bg-gray-100")}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 flex-shrink-0">
                  <span className="text-sm font-semibold text-slate-600">
                    {session.user.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className={clsx("min-w-0 flex-1 transition-opacity", !(isExpanded || isMobile) && "w-0 opacity-0 h-0")}>
                  <p className="truncate text-sm font-semibold text-slate-800">{session.user.name}</p>
                  <p className="truncate text-xs text-slate-500">{session.user.role.displayName || session.user.role.name}</p>
                </div>
                 <button onClick={handleSignOut} title="Sign Out" className="text-slate-500">
                    <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                </button>
            </div>
          )}
        </div>
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <div className={clsx(
        'fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out md:hidden',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <SidebarContent forMobile={true} />
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={clsx(
          "hidden md:fixed md:inset-y-0 md:flex transition-all duration-300 ease-in-out z-30",
          isExpanded ? "w-64" : "w-20"
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <SidebarContent forMobile={false} />
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
          onTouchStart={() => setSidebarOpen(false)}
        ></div>
      )}
    </>
  );
};

export default Sidebar;