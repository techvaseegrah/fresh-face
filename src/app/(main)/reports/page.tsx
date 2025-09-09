// src/app/(main)/reports/page.tsx

import Card from '@/components/ui/Card';
import { 
  BarChart3, 
  Gift, 
  CreditCard, 
  Package, 
  RefreshCw 
} from 'lucide-react';

const reportCards = [
  {
    title: 'Sales Report',
    description: 'View comprehensive sales analytics and performance metrics',
    icon: BarChart3,
    href: '/reports/sales-report',
    color: 'blue'
  },
  {
    title: 'Gift Card Sold',
    description: 'Track gift card sales and monitor revenue from gift cards',
    icon: Gift,
    href: '/reports/gift-card-sold',
    color: 'green'
  },
  {
    title: 'Gift Card Redemption',
    description: 'Monitor gift card usage and redemption patterns',
    icon: CreditCard,
    href: '/reports/gift-card-redemption',
    color: 'purple'
  },
  {
    title: 'Package Sales',
    description: 'Analyze package performance and sales trends',
    icon: Package,
    href: '/reports/package-sales',
    color: 'orange'
  },
  {
    title: 'Package Redemptions',
    description: 'Track package usage and customer engagement',
    icon: RefreshCw,
    href: '/reports/package-redemptions',
    color: 'teal'
  },
];

const colorClasses = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  purple: 'bg-purple-100 text-purple-600',
  orange: 'bg-orange-100 text-orange-600',
  teal: 'bg-teal-100 text-teal-600',
};

export default function ReportsHomePage() {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="text-center md:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Reports Dashboard
        </h1>
        <p className="text-gray-600 text-base sm:text-lg">
          Get comprehensive insights into your business performance
        </p>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {reportCards.map((report) => {
          const Icon = report.icon;
          const iconColorClass = colorClasses[report.color as keyof typeof colorClasses];
          
          return (
            <Card 
              key={report.href} 
              className="p-4 sm:p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer group border border-gray-200"
            >
              <a href={report.href} className="block">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${iconColorClass} group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                      {report.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                      {report.description}
                    </p>
                    <div className="mt-3">
                      <span className="text-sm font-medium text-green-600 group-hover:text-green-700">
                        View Report →
                      </span>
                    </div>
                  </div>
                </div>
              </a>
            </Card>
          );
        })}
      </div>

      {/* Help Section */}
      <Card className="p-4 sm:p-6 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200">
        <div className="text-center md:text-left">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
            Need Help with Reports?
          </h2>
          <p className="text-gray-600 text-sm sm:text-base mb-4">
            Select any report from the navigation menu on the left (or use the menu button on mobile) to view detailed analytics and download options.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
              Contact Support
            </button>
            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
              View Guide
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}