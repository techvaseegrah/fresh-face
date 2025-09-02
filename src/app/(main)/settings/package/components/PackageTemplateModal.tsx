'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { PackageTemplate, PackageTemplateItem, SelectableItem } from '@/app/(main)/settings/package/types/packages';
import  Button  from '@/components/ui/Button';
import { useDebounce } from '@/hooks/useDebounce';
import LoadingSpinner from '@/components/LoadingSpinner'; // Assuming a shared spinner component

const initialState: Omit<PackageTemplate, '_id' | 'items'> & { items: PackageTemplateItem[] } = {
  name: '',
  description: '',
  price: 0,
  validityInDays: 30,
  items: [{ itemType: 'service', itemId: '', quantity: 1, itemName: '' }],
  isActive: true,
};

interface PackageTemplateModalProps {
  templateData: PackageTemplate | null;
  onClose: () => void;
  onSave: () => void;
}

// Icon component for the validity input field
const CalendarIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.25h18" />
    </svg>
);


export default function PackageTemplateModal({ templateData, onClose, onSave }: PackageTemplateModalProps) {
  const { data: session } = useSession();
  const [formData, setFormData] = useState(initialState);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingNames, setIsLoadingNames] = useState(false);

  // --- State for Search Functionality ---
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SelectableItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Effect to pre-fill form and fetch item names when editing
  useEffect(() => {
    const fetchItemNames = async (items: PackageTemplateItem[], tenantId: string) => {
      setIsLoadingNames(true);
      try {
        const [servicesRes, productsRes] = await Promise.all([
          fetch(`/api/service-items`, { headers: { 'x-tenant-id': tenantId }, credentials: 'include' }),
          fetch(`/api/products`, { headers: { 'x-tenant-id': tenantId }, credentials: 'include' })
        ]);

        if (!servicesRes.ok || !productsRes.ok) throw new Error("Failed to fetch initial item lists.");

        const servicesData = await servicesRes.json();
        const productsData = await productsRes.json();
        
        const allItems = [
          ...(servicesData.services || []),
          ...(productsData.products || productsData.data || [])
        ];
        
        const nameMap = new Map(allItems.map(i => [i._id.toString(), i.name]));

        const itemsWithNames = items.map(item => ({
          ...item,
          itemName: nameMap.get(item.itemId.toString()) || 'Unknown Item'
        }));

        setFormData(prev => ({ ...prev, items: itemsWithNames }));
      } catch (err) {
        console.error("Failed to fetch item names", err);
        setFormData(prev => ({ ...prev, items: prev.items.map(i => ({...i, itemName: 'Error loading name'})) }));
      } finally {
        setIsLoadingNames(false);
      }
    };

    if (templateData) {
      setFormData({
        ...templateData,
        description: templateData.description || '',
      });
      if (session?.user?.tenantId && templateData.items.length > 0) {
        fetchItemNames(templateData.items, session.user.tenantId);
      }
    } else {
      setFormData(initialState);
    }
  }, [templateData, session]);

  // Effect for fetching search results
  useEffect(() => {
    const fetchSearchResults = async () => {
      if (debouncedSearchQuery.trim().length < 2 || activeSearchIndex === null) {
        setSearchResults([]);
        return;
      }

      const tenantId = session?.user?.tenantId;
      if (!tenantId) return;

      setIsSearching(true);
      const itemType = formData.items[activeSearchIndex].itemType;
      const endpoint = itemType === 'service' ? '/service-items' : '/products';
      
      try {
        const res = await fetch(`/api${endpoint}?search=${debouncedSearchQuery}`, {
          credentials: 'include',
          headers: { 'x-tenant-id': tenantId },
        });

        if (!res.ok) throw new Error('Search request failed');

        const data = await res.json();
        setSearchResults(data.services || data.products || data.data || []);
      } catch (err) {
        console.error("Search failed:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    fetchSearchResults();
  }, [debouncedSearchQuery, activeSearchIndex, formData.items, session]);
  
  // Effect to handle clicking outside the search results to close them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setActiveSearchIndex(null);
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? Number(value) || 0 : value }));
  };

  const handleItemChange = (index: number, field: keyof PackageTemplateItem, value: any) => {
    const newItems = [...formData.items];
    (newItems[index] as any)[field] = value;
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { itemType: 'service', itemId: '', quantity: 1, itemName: '' }],
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  
  const handleItemSelect = (index: number, item: SelectableItem) => {
    handleItemChange(index, 'itemId', item._id);
    handleItemChange(index, 'itemName', item.name);
    setSearchQuery('');
    setSearchResults([]);
    setActiveSearchIndex(null);
  };
  
  const clearSelectedItem = (index: number) => {
    handleItemChange(index, 'itemId', '');
    handleItemChange(index, 'itemName', '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) {
      setError("Cannot save: session is not available.");
      return;
    }
    
    setIsSaving(true);
    setError(null);

    const cleanedItems = formData.items.map(({ itemType, itemId, quantity }) => ({
      itemType,
      itemId,
      quantity,
    }));
    const payload = { ...formData, items: cleanedItems };

    const method = templateData ? 'PUT' : 'POST';
    const url = templateData ? `/api/packages/templates/${templateData._id}` : '/api/packages/templates';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to save the package.');
      }
      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Consistent styling for form inputs. Added py-2 for more height.
  const inputBaseStyle = "block w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm px-3 py-2";

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-70 overflow-y-auto h-full w-full z-50 flex items-start justify-center pt-10">
      <div className="relative p-8 border w-full max-w-3xl shadow-lg rounded-md bg-white">
        <h3 className="text-xl font-semibold leading-6 text-gray-900 mb-6">{templateData ? 'Edit' : 'Create'} Package Template</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Package Name</label>
            <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className={`mt-1 ${inputBaseStyle}`}/>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700">Price</label>
              <div className="relative mt-1 rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-gray-500 sm:text-sm">₹</span>
                </div>
                <input type="number" name="price" id="price" min="0" value={formData.price} onChange={handleChange} required className={`${inputBaseStyle} pl-7`} />
              </div>
            </div>
            <div>
              <label htmlFor="validityInDays" className="block text-sm font-medium text-gray-700">Validity (days)</label>
               <div className="relative mt-1 rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <CalendarIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input type="number" name="validityInDays" id="validityInDays" min="1" value={formData.validityInDays} onChange={handleChange} required className={`${inputBaseStyle} pl-10`} />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={3} className={`mt-1 ${inputBaseStyle}`}/>
          </div>
          
          <div className="pt-2">
            <h4 className="text-md font-medium text-gray-800">Items in Package</h4>
            <div className="grid grid-cols-12 gap-2 mt-3 text-xs font-semibold text-gray-500 px-1">
                <div className="col-span-3">Type</div>
                <div className="col-span-6">Item</div>
                <div className="col-span-2">Quantity</div>
            </div>
            {isLoadingNames ? <div className="text-center p-4"><LoadingSpinner/></div> : (
              <div className="mt-1 space-y-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center">
                    <select value={item.itemType} onChange={(e) => {
                      handleItemChange(index, 'itemType', e.target.value as 'service' | 'product');
                      clearSelectedItem(index);
                    }} className={`col-span-3 ${inputBaseStyle}`}>
                      <option value="service">Service</option>
                      <option value="product">Product</option>
                    </select>

                    <div className="relative col-span-6" ref={index === activeSearchIndex ? searchContainerRef : null}>
                      {item.itemId && item.itemName ? (
                        <div className="flex items-center justify-between w-full min-h-[42px] px-3 bg-gray-100 rounded-md">
                          <span className="text-sm text-gray-800 truncate">{item.itemName}</span>
                          <button type="button" onClick={() => clearSelectedItem(index)} className="ml-2 text-red-500 font-bold">&times;</button>
                        </div>
                      ) : (
                        <input type="text" placeholder={`Search for a ${item.itemType}...`} onChange={handleSearchChange} onFocus={() => setActiveSearchIndex(index)} autoComplete="off" className={inputBaseStyle}/>
                      )}

                      {activeSearchIndex === index && debouncedSearchQuery.length > 1 && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                          {isSearching ? <div className="px-3 py-2 text-sm text-gray-500">Searching...</div> : 
                           searchResults.length > 0 ? (
                            <ul>{searchResults.map((result) => (
                              <li key={result._id} onClick={() => handleItemSelect(index, result)} className="px-3 py-2 text-sm text-gray-800 cursor-pointer hover:bg-gray-100">{result.name}</li>
                            ))}</ul>
                          ) : <div className="px-3 py-2 text-sm text-gray-500">No results found for "{debouncedSearchQuery}".</div>
                          }
                        </div>
                      )}
                    </div>
                    
                    <input type="number" min="1" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10))} required className={`col-span-2 ${inputBaseStyle}`} placeholder="Qty"/>
                    
                    <div className="col-span-1 text-right">
                      {formData.items.length > 1 && (
                        <Button type="button" variant="primary" size="sm" onClick={() => handleRemoveItem(index)}>X</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button type="button" variant="outline" onClick={handleAddItem} className="mt-3">+ Add Item</Button>
          </div>

          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          
          <div className="pt-5 flex justify-end space-x-3 border-t">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Package'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}