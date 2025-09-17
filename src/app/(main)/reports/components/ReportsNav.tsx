'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// The array of report links, now including the new report
const reportLinks = [
  { href: '/reports/appointment-report', label: 'Appointment Report' },
  { href: '/reports/eb-report', label: 'EB Report' },
  { href: '/reports/day-end-closing-report', label: 'Day End Closing Report' },
  { href: '/reports', label: 'Sales Report' },
  { href: '/reports/gift-card-sold', label: 'Gift Card Sold' },
  { href: '/reports/gift-card-redemption', label: 'Gift Card Redemption' },
  { href: '/reports/package-sales', label: 'Package Sales' },
  { href: '/reports/package-redemptions', label: 'Package Redemptions' },
  { href: '/reports/tool-stock-report', label: 'Tool Stock Report' },
  { href: '/reports/audit-reports', label: 'Tool Audit Reports' },
  { href: '/reports/advance-report', label: 'Advance Report' },
  { href: '/reports/incentive-payout', label: 'Incentive Payout Report' },
  { href: '/reports/leave-report', label: 'Leave Report' },
  { href: '/reports/target-report', label: 'Target Report' },
  { href: '/reports/performance-report', label: 'Performance Report' },
  { href: '/reports/salary-report', label: 'Salary Report' },
  { href: '/reports/shift-report', label: 'Shift Report' },
  { href: '/reports/incentive-report', label: 'Incentive Report' },
  { href: '/reports/staff-sales-report', label: 'Staff Sales Report' },
  { href: '/reports/expenses', label: 'Expenses Report' },
  { href: '/reports/budget-vs-actual', label: 'Budget vs. Actual Report' },
  { href: '/reports/task-library', label: 'Task Library Report' },
  { href: '/reports/task-compliance', label: 'Task Compliance Report' },
  { href: '/reports/issue-library', label: 'Issue Library Report' },
  { href: '/reports/issue-compliance', label: 'Issue Compliance Report' },
  { href: '/reports/sop-compliance', label: 'SOP Compliance Report' },
];

export function ReportsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col space-y-1">
      {reportLinks.map((link) => {
        // This logic correctly highlights the active link
        const isActive =
          link.href === '/reports'
            ? pathname === link.href
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
              isActive
                ? 'bg-gray-900 text-white' // Style for the active link
                : 'text-gray-600 hover:bg-gray-100' // Style for inactive links
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}