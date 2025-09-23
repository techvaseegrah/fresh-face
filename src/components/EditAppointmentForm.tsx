'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { XMarkIcon, CurrencyRupeeIcon, SparklesIcon, ShoppingCartIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-toastify';
import { Combobox } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import { useSession } from 'next-auth/react';

// ===================================================================================
//  INTERFACES (UPDATED FOR PRODUCTS)
// ===================================================================================
interface ServiceFromAPI {
  _id: string;
  name: string;
  price: number;
  duration: number;
  membershipRate?: number;
}

interface ProductFromAPI {
  _id: string;
  name: string;
  price: number;
  membershipRate?: number;
}

interface StylistFromAPI {
  _id: string;
  name: string;
}

interface AppointmentForEdit {
  id: string;
  customerId: {
    _id: string;
    name: string;
    phoneNumber?: string;
    isMembership?: boolean;
  };
  serviceIds?: ServiceFromAPI[];
  productIds?: ProductFromAPI[];
  stylistId?: StylistFromAPI;
  appointmentDateTime: string;
  notes?: string;
  status: 'Appointment' | 'Checked-In' | 'Checked-Out' | 'Paid' | 'Cancelled' | 'No-Show';
  appointmentType: 'Online' | 'Offline';
  redeemedItems?: {
    redeemedItemId: string;
  }[];
}

interface EditAppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentForEdit | null;
  onUpdateAppointment: (appointmentId: string, updateData: any) => Promise<void>;
}

interface ItemInForm {
  _id: string;
  name: string;
  price: number;
  duration?: number;
  membershipRate?: number;
  type: 'service' | 'product';
  _tempId: string;
  isRedeemed: boolean;
}

interface SearchableItem {
  _id: string;
  name: string;
  price: number;
  type: 'service' | 'product';
}

// ===================================================================================
//  MAIN EDIT FORM COMPONENT
// ===================================================================================
export default function EditAppointmentForm({
  isOpen,
  onClose,
  appointment,
  onUpdateAppointment
}: EditAppointmentFormProps) {
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    notes: '',
    status: 'Appointment' as AppointmentForEdit['status'],
    stylistId: '',
  });

  const [allServices, setAllServices] = useState<ServiceFromAPI[]>([]);
  const [allProducts, setAllProducts] = useState<ProductFromAPI[]>([]);
  const [selectedItems, setSelectedItems] = useState<ItemInForm[]>([]);
  const [availableStylists, setAvailableStylists] = useState<StylistFromAPI[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  const { data: session } = useSession();

  const tenantAwareFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const tenantId = session?.user?.tenantId;
    if (!tenantId) {
      toast.error("Your session has expired or is invalid. Please sign in again.");
      throw new Error("Tenant ID not found in session.");
    }
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
      'x-tenant-id': tenantId,
    };
    return fetch(url, { ...options, headers });
  }, [session]);

  const { total, membershipSavings } = useMemo(() => {
    let total = 0;
    let membershipSavings = 0;
    const isMember = appointment?.customerId?.isMembership || false;

    selectedItems.forEach(item => {
      const originalItem = item.type === 'service' 
        ? allServices.find(s => s._id === item._id)
        : allProducts.find(p => p._id === item._id);
      const basePrice = originalItem?.price ?? item.price;
      const memberPrice = originalItem?.membershipRate;
      const hasDiscount = isMember && !item.isRedeemed && typeof memberPrice === 'number';
      const price = hasDiscount ? memberPrice! : item.price;
      
      total += price;

      if (hasDiscount) {
        membershipSavings += basePrice - memberPrice!;
      }
    });
    return { total, membershipSavings };
  }, [selectedItems, appointment?.customerId?.isMembership, allServices, allProducts]);

  useEffect(() => {
    if (isOpen && appointment) {
      const appointmentDate = new Date(appointment.appointmentDateTime);
      const datePart = appointmentDate.toISOString().split('T')[0];
      const hours = String(appointmentDate.getHours()).padStart(2, '0');
      const minutes = String(appointmentDate.getMinutes()).padStart(2, '0');
      const timePart = `${hours}:${minutes}`;

      setFormData({
        date: datePart, time: timePart, notes: appointment.notes || '',
        status: appointment.status, stylistId: appointment.stylistId?._id || '',
      });

      const processedServices = (appointment.serviceIds || []).map((service, index) => {
        const isRedeemed = appointment.redeemedItems?.some(redeemed => String(redeemed.redeemedItemId) === String(service._id)) || false;
        return {
          ...service, type: 'service' as const, _tempId: `initial-service-${service._id}-${index}`,
          price: isRedeemed ? 0 : service.price, name: isRedeemed ? `(Package) ${service.name}` : service.name,
          isRedeemed: isRedeemed,
        };
      });
      
      const processedProducts = (appointment.productIds || []).map((product, index) => ({
        ...product, type: 'product' as const, _tempId: `initial-product-${product._id}-${index}`, isRedeemed: false,
      }));
      
      setSelectedItems([...processedServices, ...processedProducts]);

      const fetchInitialData = async () => {
        setIsLoading(true);
        try {
          const [servicesRes, productsRes] = await Promise.all([
            tenantAwareFetch('/api/service-items'),
            tenantAwareFetch('/api/products')
          ]);
          
          const servicesData = await servicesRes.json();
          if (servicesData.success) setAllServices(servicesData.services || []);
          
          const productsData = await productsRes.json();
          if (productsData.success) setAllProducts(productsData.products || []);
        } catch (e) {
          console.error('Failed to fetch initial data:', e);
          toast.error("Error loading services or products.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchInitialData();
      setError(null);
      setItemSearchQuery('');
    }
  }, [isOpen, appointment, tenantAwareFetch]);
  
  useEffect(() => {
    if (!isOpen || !formData.date || !formData.time) return;
    const findStylists = async () => {
      setIsLoading(true);
      try {
        const res = await tenantAwareFetch(`/api/staff?action=listForAssignment`);
        const data = await res.json();
        if (!res.ok || !data.success) { throw new Error(data.message || 'Could not fetch staff list.'); }
        const staffList = data.stylists || [];
        const currentStylist = appointment?.stylistId;
        if (currentStylist && !staffList.some((s: StylistFromAPI) => s._id === currentStylist._id)) {
          staffList.unshift(currentStylist);
        }
        setAvailableStylists(staffList);
      } catch (err: any) {
        setError(err.message);
        setAvailableStylists(appointment?.stylistId ? [appointment.stylistId] : []);
      } finally {
        setIsLoading(false);
      }
    };
    findStylists();
  }, [isOpen, formData.date, formData.time, appointment?.stylistId, tenantAwareFetch]);

  const handleAddItem = (itemId: string, itemType: 'service' | 'product') => {
    if (!itemId) return;
    let itemToAdd: ItemInForm | null = null;
    if (itemType === 'service') {
        const service = allServices.find(s => s._id === itemId);
        if (service) itemToAdd = { ...service, type: 'service', isRedeemed: false, _tempId: Date.now().toString() };
    } else {
        const product = allProducts.find(p => p._id === itemId);
        if (product) itemToAdd = { ...product, type: 'product', isRedeemed: false, _tempId: Date.now().toString() };
    }
    if (itemToAdd) setSelectedItems(prev => [...prev, itemToAdd!]);
    setItemSearchQuery('');
  };

  const handleRemoveItem = (_tempId: string) => {
    setSelectedItems(prev => prev.filter((item) => item._tempId !== _tempId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment) return;
    if (selectedItems.some(item => item.type === 'service') && !formData.stylistId) {
        setError("A stylist must be assigned if services are selected.");
        return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const updateData = {
          ...formData,
          serviceIds: selectedItems.filter(item => item.type === 'service').map(s => s._id),
          productIds: selectedItems.filter(item => item.type === 'product').map(p => p._id),
          appointmentType: appointment.appointmentType,
      };
      await onUpdateAppointment(appointment.id, updateData);
    } catch (err: any) {
      setError(err.message || 'Failed to update appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = useMemo(() => {
    const query = itemSearchQuery.trim().toLowerCase();
    const allSearchableItems: SearchableItem[] = [
        ...allServices.map(s => ({ ...s, type: 'service' as const })),
        ...allProducts.map(p => ({ ...p, type: 'product' as const }))
    ];
    if (query === '') return allSearchableItems.sort((a, b) => a.price - b.price);
    return allSearchableItems.filter(item => 
      item.name.toLowerCase().includes(query) || String(item.price).includes(query)
    ).sort((a,b) => a.price - b.price);
  }, [itemSearchQuery, allServices, allProducts]);

  if (!isOpen || !appointment) return null;

  const inputClasses = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/30 text-sm';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6 pb-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold">Edit Appointment</h2>
            <p className="text-sm text-gray-600 mt-1">
              {appointment.customerId.name} - {appointment.customerId.phoneNumber}
              {appointment.customerId.isMembership && (
                <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-semibold">Member</span>
              )}
            </p>
          </div>
          <button onClick={onClose}><XMarkIcon className="w-6 h-6" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-grow" >
          {error && (<div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>)}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><CurrencyRupeeIcon className="w-5 h-5 text-gray-600" /><span className="text-sm font-medium text-gray-700">Appointment Total:</span></div>
              <div className="text-right"><div className="text-2xl font-bold text-green-600">₹{total.toFixed(2)}</div>
                {membershipSavings > 0 && (<div className="text-xs text-green-500">Member savings: ₹{membershipSavings.toFixed(2)}</div>)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Status</label><select value={formData.status} onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as AppointmentForEdit['status'] }))} className={inputClasses}><option value="Appointment">Appointment</option><option value="Checked-In">Checked-In</option><option value="Checked-Out">Checked-Out</option><option value="Cancelled">Cancelled</option><option value="No-Show">No-Show</option></select></div>
            <div><label className="block text-sm font-medium mb-1">Type</label><select value={appointment.appointmentType} className={`${inputClasses} bg-gray-100`} disabled><option value="Online">Online</option><option value="Offline">Offline</option></select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Date</label><input type="date" value={formData.date} onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))} className={inputClasses} required /></div>
            <div><label className="block text-sm font-medium mb-1">Time</label><input type="time" value={formData.time} onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))} className={inputClasses} required /></div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Services & Products</label>
            {/* FIX 1: Correct the onChange handler and remove the `value` prop */}
            <Combobox onChange={(item: { id: string, type: 'service' | 'product' } | null) => {
              if (item) {
                handleAddItem(item.id, item.type);
              }
            }}>
              <div className="relative">
                <Combobox.Input
                  className={inputClasses + ' pr-10'}
                  onChange={(event) => setItemSearchQuery(event.target.value)}
                  placeholder="Search to add items..."
                  autoComplete="off"
                />
                <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </Combobox.Button>
              </div>
              <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full max-w-md overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm">
                {isLoading ? (<div className="relative cursor-default select-none px-4 py-2 text-gray-700">Loading...</div>) : 
                filteredItems.length === 0 && itemSearchQuery !== '' ? (
                  <div className="relative cursor-default select-none px-4 py-2 text-gray-700">Nothing found.</div>
                ) : (
                  filteredItems.map((item) => (
                    <Combobox.Option key={`${item.type}-${item._id}`} value={{ id: item._id, type: item.type }}
                      className={({ active }) => `relative cursor-pointer select-none py-2 pl-10 pr-4 ${active ? 'bg-black text-white' : 'text-gray-900'}`}>
                      {/* FIX 2: Wrap the children in a render prop to get `active` state */}
                      {({ active, selected }) => (
                        <>
                          <span className="block truncate font-normal">{item.name} - ₹{item.price}</span>
                          <span className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? 'text-white' : item.type === 'service' ? 'text-blue-600' : 'text-green-600'}`}>
                            {item.type === 'service' ? <SparklesIcon className="h-5 w-5" /> : <ShoppingCartIcon className="h-5 w-5" />}
                          </span>
                        </>
                      )}
                    </Combobox.Option>
                  ))
                )}
              </Combobox.Options>
            </Combobox>
            <div className="mt-2 space-y-2">
              {selectedItems.map((item) => (
                <div key={item._tempId} className={`flex items-center justify-between p-2 rounded ${item.isRedeemed ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-100'}`}>
                  <div className="flex items-center gap-2">
                    {item.type === 'service' ? <SparklesIcon className="h-5 w-5 text-blue-500" /> : <ShoppingCartIcon className="h-5 w-5 text-green-500" />}
                    <div>
                      <span className="font-medium text-sm">{item.name}</span>
                      {item.type === 'service' && <span className="text-xs text-gray-600 ml-2">({item.duration} min)</span>}
                      {item.isRedeemed && (<span className="ml-2 text-xs font-semibold text-indigo-800 bg-indigo-200 px-2 py-0.5 rounded-full">Package</span>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {appointment.customerId.isMembership && !item.isRedeemed && item.membershipRate != null ? (
                      <div className="text-right">
                        <div className="line-through text-gray-400 text-xs">₹{item.price.toFixed(2)}</div>
                        <div className="text-green-600 font-semibold text-sm">₹{item.membershipRate.toFixed(2)}</div>
                      </div>
                    ) : (<span className={`font-semibold text-sm ${item.isRedeemed ? 'text-indigo-600' : 'text-gray-800'}`}>{item.isRedeemed ? 'Redeemed' : `₹${(item.price || 0).toFixed(2)}`}</span>)}
                    <button type="button" onClick={() => handleRemoveItem(item._tempId)} className="text-red-500 hover:text-red-700 text-xl font-bold leading-none" disabled={item.isRedeemed}>&times;</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Stylist</label>
            <select
                value={formData.stylistId}
                onChange={(e) => setFormData(prev => ({ ...prev, stylistId: e.target.value }))}
                className={inputClasses}
                disabled={isLoading}
                required={selectedItems.some(item => item.type === 'service')}
            >
              {isLoading ? (<option>Loading staff...</option>) : (
                <>
                  <option value="">{selectedItems.some(item => item.type === 'service') ? 'Select a staff member' : 'N/A (No services)'}</option>
                  {availableStylists.map((stylist) => (
                    <option key={stylist._id} value={stylist._id}>{stylist.name}{stylist._id === appointment.stylistId?._id && ' (Current)'}</option>
                  ))}
                </>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea rows={3} value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} className={`${inputClasses} resize-none`} placeholder="Any special notes..." />
          </div>
          <div className="flex justify-end gap-3 pt-4 sticky bottom-0 bg-white">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300" disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="px-6 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 min-w-[120px]" disabled={isSubmitting}>
              {isSubmitting ? (<div className="flex items-center justify-center"><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />Updating...</div>) : ( formData.status === 'Checked-Out' ? 'Update & Bill' : 'Update Appointment' )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}