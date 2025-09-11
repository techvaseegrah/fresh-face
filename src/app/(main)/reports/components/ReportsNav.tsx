'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  BarChart3, 
  Gift, 
  CreditCard, 
  Package, 
  RefreshCw 
} from 'lucide-react';

const reportLinks = [
  { href: '/reports/sales-report', label: 'Sales Report' },
  { href: '/reports/gift-card-sold', label: 'Gift Card Sold' },
  { href: '/reports/gift-card-redemption', label: 'Gift Card Redemption' },
  { href: '/reports/package-sales', label: 'Package Sales' },
  { href: '/reports/package-redemptions', label: 'Package Redemptions' },
  { href: '/reports/advance-report', label: 'Advance Report' },
  { href: '/reports/incentive-payout', label: 'Incentive Payout Report' },
  { href: '/reports/leave-report', label: 'Leave Report' },
  { href: '/reports/target-report', label: 'Target Report' },
  // ▼▼▼ NEW LINK ADDED HERE ▼▼▼
  { href: '/reports/performance-report', label: 'Performance Report' },
   { href: '/reports/salary-report', label: 'Salary Report' },
     { href: '/reports/shift-report', label: 'Shift Report' },
     { href: '/reports/incentive-report', label: 'Incentive Report' },
      { href: '/reports/staff-sales-report', label: 'Staff Sales Report' },
];

interface ReportsNavProps {
  onItemClick?: () => void;
}

export function ReportsNav({ onItemClick }: ReportsNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col space-y-1">
      {reportLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            'rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap', 
            pathname.startsWith(link.href)
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}