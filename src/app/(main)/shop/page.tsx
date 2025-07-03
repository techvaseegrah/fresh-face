'use client';

import { useState } from 'react';
import ServiceManager from '@/components/admin/ServiceManager';
import StylistManager from '@/components/admin/StylistManager';
import ProductManager from '@/components/admin/ProductManager';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { CubeIcon, WrenchScrewdriverIcon, UsersIcon, BuildingStorefrontIcon } from '@heroicons/react/24/outline';

type ShopTab = 'products' | 'services' | 'stylists';

export default function StoreManagementPage() {
  const { data: session } = useSession();

  const canReadProducts = session && hasPermission(session.user.role.permissions, PERMISSIONS.PRODUCTS_READ);
  const canReadServices = session && hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_READ);
  const canReadStylists = session && hasPermission(session.user.role.permissions, PERMISSIONS.STYLISTS_READ);

  const availableTabs: { id: ShopTab; label: string; show: boolean; icon: React.ElementType }[] = [
    { id: 'products', label: 'Products', show: canReadProducts ?? false, icon: CubeIcon },
    { id: 'services', label: 'Services', show: canReadServices ?? false, icon: WrenchScrewdriverIcon },
    { id: 'stylists', label: 'Stylists', show: canReadStylists ?? false, icon: UsersIcon },
  ];

  const visibleTabs = availableTabs.filter(tab => tab.show);
  const [activeTab, setActiveTab] = useState<ShopTab | null>(visibleTabs.length > 0 ? visibleTabs[0].id : null);

  const renderContent = () => {
    if (!activeTab) {
      return (
        <div className="text-center py-20 bg-white rounded-lg shadow-sm">
          <h2 className="text-2xl font-bold text-gray-800">Access Denied</h2>
          <p className="text-gray-500 mt-3 max-w-md mx-auto">You do not have the necessary permissions to manage any of the shop sections. Please contact an administrator if you believe this is an error.</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'products':
        return canReadProducts ? <ProductManager /> : null;
      case 'services':
        return canReadServices ? <ServiceManager /> : null;
      case 'stylists':
        return canReadStylists ? <StylistManager /> : null;
      default:
        return null; // Should not be reached if activeTab is handled correctly
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <header className="bg-white shadow-sm p-4 sm:p-6 z-10">
        <div className="flex items-center space-x-4">
          <BuildingStorefrontIcon className="h-8 w-8 text-gray-700" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Shop Management
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage products, services, and stylists for your shop.
            </p>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      {visibleTabs.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6">
          <nav className="flex space-x-2" aria-label="Tabs">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 whitespace-nowrap py-3 px-4 font-medium text-sm
                  rounded-t-lg transition-all duration-200 ease-in-out
                  ${
                    activeTab === tab.id
                      ? 'bg-gray-50 border-b-2 border-indigo-600 text-indigo-600'
                      : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Main Content Area */}
                  <main className="flex-1 bg-gray-50">
        {renderContent()}
      </main>
    </div>
  );
}