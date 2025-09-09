// src/app/(main)/reports/components/ReportsNav.tsx
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
  { 
    href: '/reports/sales-report', 
    label: 'Sales Report',
    icon: BarChart3,
    description: 'View detailed sales analytics'
  },
  { 
    href: '/reports/gift-card-sold', 
    label: 'Gift Card Sold',
    icon: Gift,
    description: 'Track gift card sales'
  },
  { 
    href: '/reports/gift-card-redemption', 
    label: 'Gift Card Redemption',
    icon: CreditCard,
    description: 'Monitor gift card usage'
  },
  { 
    href: '/reports/package-sales', 
    label: 'Package Sales',
    icon: Package,
    description: 'Analyze package performance'
  },
  { 
    href: '/reports/package-redemptions', 
    label: 'Package Redemptions',
    icon: RefreshCw,
    description: 'Track package usage'
  },
];

interface ReportsNavProps {
  onItemClick?: () => void;
}

export function ReportsNav({ onItemClick }: ReportsNavProps) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide px-3 py-2">
        Reports
      </h2>
      <div className="space-y-1">
        {reportLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname.startsWith(link.href);
          
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onItemClick}
              className={cn(
                'group flex items-center rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px]',
                isActive
                  ? 'bg-green-100 text-green-800 border-l-4 border-green-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon 
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  isActive 
                    ? 'text-green-600' 
                    : 'text-gray-400 group-hover:text-gray-600'
                )}
              />
              <div className="flex-1">
                <div className={cn(
                  'font-medium',
                  isActive ? 'text-green-800' : 'text-gray-900'
                )}>
                  {link.label}
                </div>
                <div className="text-xs text-gray-500 md:hidden">
                  {link.description}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}