// appointment/components/billing/ItemSearch.tsx

import React from 'react';
import { SearchableItem } from './billing.types';

interface ItemSearchProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: SearchableItem[];
  isSearching: boolean;
  onAddItem: (item: SearchableItem) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  customerIsMember: boolean;
}

const ItemSearch: React.FC<ItemSearchProps> = ({
  searchQuery, onSearchQueryChange, searchResults, isSearching, onAddItem, searchInputRef, customerIsMember
}) => {
  return (
    <div className="border-t pt-4">
      <label htmlFor="itemSearch" className="block text-sm font-medium text-gray-700 mb-1">Add Additional Items</label>
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
    </div>
  );
};

export default ItemSearch;