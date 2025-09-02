'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { SearchableItem } from './billing.types';
import { PackageTemplate } from '@/app/(main)/appointment/components/billing/billing.types'; // Adjust this path if needed

interface ItemSearchProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: SearchableItem[];
  isSearching: boolean;
  // The onAddItem function will now need to handle items with a 'package' type
  onAddItem: (item: SearchableItem | (Omit<SearchableItem, 'type'> & { type: 'package' })) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  customerIsMember: boolean;
}

const ItemSearch: React.FC<ItemSearchProps> = ({
  searchQuery, onSearchQueryChange, searchResults, isSearching, onAddItem, searchInputRef, customerIsMember
}) => {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'items' | 'packages'>('items');

  // State for fetching and storing package templates
  const [packages, setPackages] = useState<PackageTemplate[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);

  // Effect to fetch packages when the 'packages' tab is selected
  useEffect(() => {
    const fetchPackages = async () => {
      if (activeTab !== 'packages' || !session?.user?.tenantId) {
        return;
      }
      setIsLoadingPackages(true);
      try {
        const res = await fetch('/api/packages/templates?isActive=true', {
          credentials: 'include',
          headers: { 'x-tenant-id': session.user.tenantId }
        });
        if (!res.ok) throw new Error('Failed to fetch packages');
        const data = await res.json();
        setPackages(data);
      } catch (error) {
        console.error("Error fetching packages for billing:", error);
        setPackages([]); // Clear on error
      } finally {
        setIsLoadingPackages(false);
      }
    };

    fetchPackages();
  }, [activeTab, session]);

  const handleSelectPackage = (pkg: PackageTemplate) => {
    // Add the package to the bill using the onAddItem prop.
    // We add a `type: 'package'` property to distinguish it in the billing state.
    onAddItem({
      id: pkg._id,
      name: pkg.name,
      price: pkg.price,
      type: 'package',
    });
  };

  const tabButtonClasses = (tabName: 'items' | 'packages') => 
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tabName 
      ? 'border-indigo-500 text-indigo-600' 
      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`;

  return (
    <div className="border-t pt-4">
      <div className="flex border-b mb-2">
        <button className={tabButtonClasses('items')} onClick={() => setActiveTab('items')}>
          Services & Products
        </button>
        <button className={tabButtonClasses('packages')} onClick={() => setActiveTab('packages')}>
          Sell a Package
        </button>
      </div>

      {activeTab === 'items' && (
        <>
          <label htmlFor="itemSearch" className="sr-only">Add Additional Items</label>
          <div className="relative">
            <input
              ref={searchInputRef}
              id="itemSearch"
              type="text"
              value={searchQuery}
              onChange={e => onSearchQueryChange(e.target.value)}
              placeholder="Search services or products..."
              className="w-full px-3 py-2 border rounded-md"
              autoComplete="off"
            />
            {(isSearching || searchResults.length > 0 || searchQuery.length >= 2) && (
              <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                {isSearching && <li className="px-3 py-2 text-sm text-gray-500">Searching...</li>}
                {!isSearching && searchResults.map(item => (
                  <li key={item.id} onClick={() => onAddItem(item)} className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{item.type === 'product' && item.categoryName ? `${item.categoryName} - ${item.name}` : item.name}</span>
                        <span className={`text-xs ml-2 px-1.5 py-0.5 rounded-full ${item.type === 'service' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{item.type}</span>
                      </div>
                      <div className="text-right">
                        <div>₹{item.price.toFixed(2)}</div>
                        {customerIsMember && item.membershipRate && item.type === 'service' && (
                          <div className="text-xs text-green-600">Member: ₹{item.membershipRate.toFixed(2)}</div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
                {!isSearching && searchResults.length === 0 && searchQuery.length >= 2 && (
                  <li className="px-3 py-2 text-sm text-gray-500">No items found.</li>
                )}
              </ul>
            )}
          </div>
        </>
      )}

      {activeTab === 'packages' && (
        <div className="relative">
          <ul className="w-full bg-white border rounded-md max-h-48 overflow-y-auto shadow-inner">
            {isLoadingPackages && <li className="px-3 py-2 text-sm text-gray-500">Loading packages...</li>}
            {!isLoadingPackages && packages.map(pkg => (
              <li key={pkg._id} onClick={() => handleSelectPackage(pkg)} className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{pkg.name}</span>
                  <div className="text-right font-semibold">₹{pkg.price.toFixed(2)}</div>
                </div>
              </li>
            ))}
            {!isLoadingPackages && packages.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-500">No active packages found.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ItemSearch;