'use client';

import { useState } from 'react';

// We'll create these placeholder components in the next step
import ServiceManager from '@/components/admin/ServiceManager';
import StylistManager from '@/components/admin/StylistManager';
import ProductManager from '@/components/admin/ProductManager';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

type ShopTab = 'products' | 'services' | 'stylists';

// The component name should be PascalCase
export default function StoreManagementPage() {
   const { data: session } = useSession();

  const canReadProducts = session && hasPermission(session.user.role.permissions, PERMISSIONS.PRODUCTS_READ);
  const canReadServices = session && hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_READ);
  const canReadStylists = session && hasPermission(session.user.role.permissions, PERMISSIONS.STYLISTS_READ);

  const availableTabs: { id: ShopTab; label: string; show: boolean }[] = [
    { id: 'products', label: 'Products', show: canReadProducts ?? false },
    { id: 'services', label: 'Services', show: canReadServices ?? false },
    { id: 'stylists', label: 'Stylists', show: canReadStylists ?? false },
  ];

  const visibleTabs = availableTabs.filter(tab => tab.show);

  const [activeTab, setActiveTab] = useState<ShopTab | null>(visibleTabs.length > 0 ? visibleTabs[0].id : null);

  const renderContent = () => {
    switch (activeTab) {
      case 'products':
        return canReadProducts ? <ProductManager /> : null;
      case 'services':
        return canReadServices ? <ServiceManager /> : null;
      case 'stylists':
        return canReadStylists ? <StylistManager /> : null;
      default:
        return (
          <div className="text-center py-16">
            <h2 className="text-xl font-semibold text-gray-700">Access Denied</h2>
            <p className="text-gray-500 mt-2">You do not have permission to view any shop management modules.</p>
          </div>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Page Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Shop Management
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage the core components of your shop front.
        </p>
      </header>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'services' | 'stylists' | 'products')}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                transition-colors duration-200
                ${
                  activeTab === tab.id
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content Area */}
      <main className="mt-8">
        {renderContent()}
      </main>
    </div>
  );
}