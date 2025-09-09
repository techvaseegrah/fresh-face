// src/app/(main)/reports/components/ReportsNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const reportLinks = [
  { href: '/reports/sales-report', label: 'Sales Report' },
  { href: '/reports/gift-card-sold', label: 'Gift Card Sold' },
  { href: '/reports/gift-card-redemption', label: 'Gift Card Redemption' },
  { href: '/reports/package-sales', label: 'Package Sales' },
  { href: '/reports/package-redemptions', label: 'Package Redemptions' },
  { href: '/reports/tool-stock-report', label: 'Tool Stock Report' },
   { href: '/reports/audit-reports', label: 'Tool Audit Reports' },
];

export function ReportsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col space-y-1">
      {reportLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            'rounded-md px-3 py-2 text-sm font-medium transition-colors',
            // ▼▼▼ THIS CLASS PREVENTS THE TEXT FROM WRAPPING ▼▼▼
            'whitespace-nowrap', 
            pathname.startsWith(link.href)
              ? 'bg-gray-900 text-white' // Active link style
              : 'text-gray-600 hover:bg-gray-100' // Inactive links
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}