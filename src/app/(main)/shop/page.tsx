'use client';

import { useState } from 'react';

// We'll create these placeholder components in the next step
import ServiceManager from '@/components/admin/ServiceManager';
import StylistManager from '@/components/admin/StylistManager';
import ProductManager from '@/components/admin/ProductManager';

// The component name should be PascalCase
export default function StoreManagementPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'stylists' | 'services'>('products');

  const tabs = [
    { id: 'products', label: 'Products' },
    { id: 'services', label: 'Services' },
    { id: 'stylists', label: 'Stylists' },
    
  ];

  const renderContent = () => {
    switch (activeTab) {

      case 'products':
        return <ProductManager />;
 
      case 'stylists':
        return <StylistManager />;

        case 'services':
          return <ServiceManager />;

      default:
        return null;
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
          {tabs.map((tab) => (
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