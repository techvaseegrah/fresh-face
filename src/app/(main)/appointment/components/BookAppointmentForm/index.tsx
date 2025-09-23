'use client';
import React, { useState, useEffect, FormEvent, useCallback, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-toastify';
import { useDebounce } from '@/hooks/useDebounce';
import { useSession } from 'next-auth/react';

// Import all types and child components from the new local structure
import {
  AppointmentFormData, AppointmentItemState, BookAppointmentFormProps, CustomerDetails,
  CustomerSearchResult, NewBookingData, ProductFromAPI, SearchableItem,
  ServiceAppointmentItem, ServiceFromAPI, StylistFromAPI, CustomerPackage, AppointmentHistory, ProductAppointmentItem
} from './types';
import CustomerInformationForm from './CustomerInformationForm';
import AppointmentDetailsForm from './AppointmentDetailsForm';
import CustomerDetailPanel from './CustomerDetailPanel';
import CustomerHistoryModal from './CustomerHistoryModal';

export default function BookAppointmentForm({ isOpen, onClose, onBookAppointment }: BookAppointmentFormProps) {
  const initialFormData: AppointmentFormData = { customerId: undefined, phoneNumber: '', customerName: '', email: '', gender: '', dob: '', survey: '', date: '', time: '', notes: '', status: 'Appointment' as 'Appointment' | 'Checked-In' };
  const [formData, setFormData] = useState<AppointmentFormData>(initialFormData);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appointmentItems, setAppointmentItems] = useState<AppointmentItemState[]>([]);
  const [assignableStaff, setAssignableStaff] = useState<StylistFromAPI[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [allServices, setAllServices] = useState<ServiceFromAPI[]>([]);
  const [allProducts, setAllProducts] = useState<ProductFromAPI[]>([]);
  const [filteredItems, setFilteredItems] = useState<SearchableItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const debouncedItemSearch = useDebounce(itemSearch, 200);
  const [customerSearchResults, setCustomerSearchResults] = useState<CustomerSearchResult[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [isCustomerSelected, setIsCustomerSelected] = useState(false);
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<CustomerDetails | null>(null);
  const [isLoadingCustomerDetails, setIsLoadingCustomerDetails] = useState(false);
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  const [customerLookupStatus, setCustomerLookupStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');
  const [barcodeQuery, setBarcodeQuery] = useState<string>('');
  const [isSearchingByBarcode, setIsSearchingByBarcode] = useState<boolean>(false);
  const [searchMode, setSearchMode] = useState<'phone' | 'barcode'>('phone');
  const [stockIssues, setStockIssues] = useState<any[] | null>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [customerPackages, setCustomerPackages] = useState<CustomerPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [packageError, setPackageError] = useState<string | null>(null);
  const [redeemedItems, setRedeemedItems] = useState<NewBookingData['redeemedItems']>([]);
  const { data: session } = useSession();


  const tenantAwareFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const tenantId = session?.user?.tenantId;
    if (!tenantId) { toast.error("Your session has expired or is invalid. Please sign in again."); throw new Error("Tenant ID not found in session."); }
    const headers = { 'Content-Type': 'application/json', ...options.headers, 'x-tenant-id': tenantId, };
    return fetch(url, { ...options, headers });
  }, [session]);

  const getCurrentDate = () => new Date().toISOString().split('T')[0];
  const getCurrentTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const calculateTotals = useCallback(() => {
    let total = 0;
    let membershipSavings = 0;
    const isMember = selectedCustomerDetails?.isMember || false;
    appointmentItems.forEach(item => {
      const hasDiscount = isMember && item.membershipRate;
      const price = hasDiscount ? item.membershipRate! : item.price;
      total += price;
      if (hasDiscount) {
        membershipSavings += item.price - item.membershipRate!;
      }
    });
    return { total, membershipSavings };
  }, [appointmentItems, selectedCustomerDetails?.isMember]);

  const { total, membershipSavings } = calculateTotals();

  useEffect(() => {
    if (isOpen) {
      setFormData(initialFormData);
      setAppointmentItems([]);
      setFormError(null);
      setStockIssues(null);
      setIsSubmitting(false);
      setIsCustomerSelected(false);
      setSelectedCustomerDetails(null);
      setCustomerSearchResults([]);
      setShowCustomerHistory(false);
      setBarcodeQuery('');
      setSearchMode('phone');
      setItemSearch('');
      setFilteredItems([]);
      setCustomerLookupStatus('idle');
      setAssignableStaff([]);
      setIsLoadingStaff(true);
      setCustomerPackages([]);
      setRedeemedItems([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
        const fetchAllData = async () => {
            try {
                const [servicesRes, productsRes] = await Promise.all([
                    tenantAwareFetch('/api/service-items'),
                    tenantAwareFetch('/api/products?limit=all') 
                ]);
                
                const servicesData = await servicesRes.json();
                if (servicesData.success) {
                    setAllServices(servicesData.services || []);
                } else {
                    setFormError('Failed to load services.');
                }

                const productsData = await productsRes.json();
                if (productsData.success) {
                    setAllProducts(productsData.products || []);
                } else {
                    toast.warn('Could not load products.');
                }
            } catch (e) {
                setFormError('An error occurred while loading services or products.');
            }
        };
        fetchAllData();
    } else {
        setAllServices([]);
        setAllProducts([]);
    }
  }, [isOpen, tenantAwareFetch]);

  useEffect(() => {
      const query = debouncedItemSearch.trim().toLowerCase();
      
      const servicesWithType: SearchableItem[] = allServices.map(s => ({ ...s, type: 'service' }));
      const productsWithType: SearchableItem[] = allProducts.map(p => ({ ...p, type: 'product' }));
      const allSearchableItems = [...servicesWithType, ...productsWithType];

      if (!query) {
          const sorted = allSearchableItems.sort((a, b) => a.price - b.price);
          setFilteredItems(sorted);
          return;
      }

      const filtered = allSearchableItems.filter(item =>
          item.name.toLowerCase().includes(query) ||
          String(item.price).includes(query)
      );
      const sorted = filtered.sort((a, b) => a.price - b.price);
      setFilteredItems(sorted);
  }, [debouncedItemSearch, allServices, allProducts]);

  useEffect(() => {
    if (formData.status === 'Checked-In') {
      setFormData(prev => ({ ...prev, date: getCurrentDate(), time: getCurrentTime() }));
    }
  }, [formData.status]);

  // FIX: Added explicit type assertion to prevent TS error with discriminated unions.
  const handleUpdateItem = (_tempId: string, updates: Partial<ServiceAppointmentItem>) => {
    setAppointmentItems(prev => prev.map(a => {
        if (a._tempId === _tempId && a.type === 'service') {
            return { ...a, ...updates } as ServiceAppointmentItem;
        }
        return a;
    }));
  };

  useEffect(() => {
    if (isOpen && formData.date && formData.time) {
      setIsLoadingStaff(true);
      // FIX: Used a more explicit map with type assertion to help TypeScript inference.
      setAppointmentItems(prev => prev.map(item => {
        if (item.type === 'service') {
          return { ...item, isLoadingStylists: true, stylistId: '' } as ServiceAppointmentItem;
        }
        return item;
      }));

      const fetchAssignableStaff = async () => {
        try {
          const res = await tenantAwareFetch('/api/staff?action=listForAssignment');
          const data = await res.json();
          const staffList = data.success ? data.stylists : [];
          if (!data.success) { toast.error("Failed to load staff list."); }
          setAssignableStaff(staffList);
          // FIX: Used a more explicit map with type assertion.
          setAppointmentItems(prev => prev.map(item => {
            if (item.type === 'service') {
              return { ...item, availableStylists: staffList, isLoadingStylists: false } as ServiceAppointmentItem;
            }
            return item;
          }));
        } catch (error) {
          toast.error("Error fetching staff list.");
          setAssignableStaff([]);
           // FIX: Used a more explicit map with type assertion.
          setAppointmentItems(prev => prev.map(item => {
            if (item.type === 'service') {
              return { ...item, availableStylists: [], isLoadingStylists: false } as ServiceAppointmentItem;
            }
            return item;
          }));
        } finally {
          setIsLoadingStaff(false);
        }
      };
      fetchAssignableStaff();
    } else {
      setAssignableStaff([]);
      // FIX: Used a more explicit map with type assertion.
      setAppointmentItems(prev => prev.map(item => {
        if (item.type === 'service') {
          return { ...item, availableStylists: [], isLoadingStylists: true, stylistId: '' } as ServiceAppointmentItem;
        }
        return item;
      }));
    }
  }, [isOpen, formData.date, formData.time, tenantAwareFetch]);

  const fetchAndSetCustomerDetails = useCallback(async (phone: string) => {
    if (isLoadingCustomerDetails) return;
    setIsLoadingCustomerDetails(true);
    setCustomerLookupStatus('searching');
    setCustomerSearchResults([]);
    try {
      const res = await tenantAwareFetch(`/api/customer/search?query=${encodeURIComponent(phone.trim())}&details=true`);
      const data = await res.json();

      if (res.ok && data.success && data.customer) {
        const cust = data.customer;
        
        try {
          const importedHistoryRes = await tenantAwareFetch(`/api/customer/${cust._id}/imported-invoices`);

          if (importedHistoryRes.ok) {
            const importedInvoices = await importedHistoryRes.json();

            const mappedImportedHistory: AppointmentHistory[] = importedInvoices.map((inv: any) => {
              const getPaymentMode = (details: any) => {
                if (!details) return 'N/A';
                const modes = [];
                if (details.cash > 0) modes.push('Cash');
                if (details.card > 0) modes.push('Card');
                if (details.upi > 0) modes.push('UPI');
                if (details.other > 0) modes.push('Other');
                return modes.length > 0 ? modes.join(', ') : 'N/A';
              };

              return {
                _id: inv._id,
                date: inv.createdAt,
                services: inv.lineItems?.map((item: { name: string }) => item.name) ?? ['Imported Service'],
                totalAmount: inv.grandTotal ?? 0,
                stylistName: inv.stylistId?.name ?? 'N/A',
                status: 'Paid',
                isImported: true,
                invoiceNumber: inv.invoiceNumber ?? 'N/A',
                paymentMode: getPaymentMode(inv.paymentDetails),
              };
            });
            const combinedHistory = [...cust.appointmentHistory, ...mappedImportedHistory];
            combinedHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            cust.appointmentHistory = combinedHistory;

          } else {
            console.warn(`Could not fetch imported history. Status: ${importedHistoryRes.status}`);
          }
        } catch (e) {
          console.error("Error fetching or merging imported history:", e);
        }

        setFormData((prev) => ({ ...prev, customerId: cust._id, customerName: cust.name, phoneNumber: cust.phoneNumber, email: cust.email || '', gender: cust.gender || 'other', dob: cust.dob ? new Date(cust.dob).toISOString().split('T')[0] : '', survey: cust.survey || '' }));
        setSelectedCustomerDetails(cust);
        setIsCustomerSelected(true);
        setCustomerLookupStatus('found');

      } else {
        setSelectedCustomerDetails(null);
        setIsCustomerSelected(false);
        setCustomerLookupStatus('not_found');
        if (nameInputRef.current) nameInputRef.current.focus();
      }
    } catch (err) {
      setSelectedCustomerDetails(null);
      setIsCustomerSelected(false);
      setCustomerLookupStatus('not_found');
    } finally {
      setIsLoadingCustomerDetails(false);
    }
  }, [tenantAwareFetch]);

  useEffect(() => {
    if (searchMode !== 'phone') return;
    const query = formData.phoneNumber.trim();
    if (isCustomerSelected || query.length < 3 || query.length >= 10) { setCustomerSearchResults([]); return; }
    const handler = setTimeout(async () => {
      setIsSearchingCustomers(true);
      try {
        const res = await tenantAwareFetch(`/api/customer/search?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.success) setCustomerSearchResults(data.customers);
      } catch (error) { console.error('Customer search failed:', error); }
      finally { setIsSearchingCustomers(false); }
    }, 500);
    return () => clearTimeout(handler);
  }, [formData.phoneNumber, isCustomerSelected, searchMode, tenantAwareFetch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    let { name, value } = e.target;
    if (name === 'phoneNumber') { value = value.replace(/[^\d]/g, ''); }
    if (name === 'customerName') { value = value.replace(/[^a-zA-Z\s]/g, ''); }
    if (isCustomerSelected && ['customerName', 'phoneNumber', 'email', 'gender', 'dob', 'survey'].includes(name)) { handleClearSelection(false); }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const phone = formData.phoneNumber.trim();
    if (phone.length === 10 && !isCustomerSelected) {
      fetchAndSetCustomerDetails(phone);
    }
    else if (phone.length < 10 && customerLookupStatus !== 'idle') {
      setCustomerLookupStatus('idle');
    }
  }, [formData.phoneNumber, isCustomerSelected, fetchAndSetCustomerDetails]);

  useEffect(() => {
    if (!selectedCustomerDetails?._id || !session?.user?.tenantId) {
      setCustomerPackages([]);
      setRedeemedItems([]);
      return;
    }
    const fetchPackagesForCustomer = async () => {
      setIsLoadingPackages(true);
      setPackageError(null);
      try {
        const res = await tenantAwareFetch(`/api/customer/${selectedCustomerDetails._id}/packages`);
        if (!res.ok) throw new Error('Failed to fetch customer packages.');
        const allPackages: CustomerPackage[] = await res.json();
        const now = new Date();
        const redeemablePackages = allPackages.filter(p => p.status === 'active' && new Date(p.expiryDate) > now && p.remainingItems.some(i => i.remainingQuantity > 0));
        setCustomerPackages(redeemablePackages);
      } catch (err: any) {
        setPackageError(err.message);
        setCustomerPackages([]);
      } finally {
        setIsLoadingPackages(false);
      }
    };
    fetchPackagesForCustomer();
  }, [selectedCustomerDetails, session, tenantAwareFetch]);

  const handleBarcodeSearch = async () => {
    if (!barcodeQuery.trim()) return;
    setIsSearchingByBarcode(true);
    try {
      const res = await tenantAwareFetch(`/api/customer/search-by-barcode?barcode=${encodeURIComponent(barcodeQuery.trim())}`);
      const data = await res.json();
      if (res.ok && data.success && data.customer) {
        fetchAndSetCustomerDetails(data.customer.phoneNumber);
        setBarcodeQuery(''); toast.success('Customer found by barcode!');
      } else {
        toast.error('No customer found with this barcode'); setBarcodeQuery('');
      }
    } catch (err) { toast.error('Failed to search by barcode'); setBarcodeQuery(''); }
    finally { setIsSearchingByBarcode(false); }
  };

  const handleSelectCustomer = (customer: CustomerSearchResult) => {
    fetchAndSetCustomerDetails(customer.phoneNumber);
  };

  const handleClearSelection = (clearPhone = true) => {
    setIsCustomerSelected(false);
    setSelectedCustomerDetails(null);
    setCustomerLookupStatus('idle');
    const resetData: Partial<typeof formData> = { customerId: undefined, customerName: '', email: '', gender: '', dob: '', survey: '' };
    if (clearPhone) {
      resetData.phoneNumber = ''; setBarcodeQuery('');
      if (searchMode === 'phone' && phoneInputRef.current) phoneInputRef.current.focus();
      else if (searchMode === 'barcode' && barcodeInputRef.current) barcodeInputRef.current.focus();
    } else {
      if (nameInputRef.current) nameInputRef.current.focus();
    }
    setFormData((prev) => ({ ...prev, ...resetData }));
  };

  const handleToggleMembership = async (customBarcode?: string) => {
    if (!selectedCustomerDetails) return;
    try {
      const response = await tenantAwareFetch(`/api/customer/${selectedCustomerDetails._id}/toggle-membership`, {
        method: 'POST',
        body: JSON.stringify({ isMembership: !selectedCustomerDetails.isMember, membershipBarcode: customBarcode })
      });
      const result = await response.json();
      if (result.success) {
        toast.success(selectedCustomerDetails.isMember ? 'Membership removed successfully!' : `Membership granted successfully with barcode: ${result.customer.membershipBarcode}`);
        setTimeout(() => fetchAndSetCustomerDetails(selectedCustomerDetails.phoneNumber), 300);
      } else {
        toast.error(result.message || 'Failed to update membership status');
      }
    } catch (error) {
      toast.error('Failed to update membership status');
    }
  };

  const handleAddItem = (item: SearchableItem) => {
    if (item) {
        if (item.type === 'service') {
            const newService: ServiceAppointmentItem = {
                _tempId: Date.now().toString(),
                itemId: item._id,
                serviceId: item._id, // For submission payload
                itemName: item.name,
                price: item.price,
                membershipRate: item.membershipRate,
                duration: item.duration || 0,
                stylistId: '',
                type: 'service',
                availableStylists: assignableStaff,
                isLoadingStylists: isLoadingStaff
            };
            setAppointmentItems(prev => [...prev, newService]);
        } else if (item.type === 'product') {
            const newProduct: ProductAppointmentItem = {
                _tempId: Date.now().toString(),
                itemId: item._id,
                itemName: item.name,
                price: item.price,
                membershipRate: item.membershipRate,
                type: 'product',
            };
            setAppointmentItems(prev => [...prev, newProduct]);
        }
        setItemSearch('');
    }
  };

  const handleRedeemItem = (pkg: CustomerPackage, item: CustomerPackage['remainingItems'][0]) => {
    const redeemedCount = appointmentItems.filter(a => a.itemId === item.itemId && a.isRedeemed).length;
    if (redeemedCount >= item.remainingQuantity) {
      toast.info(`No more "${item.itemName}" left to redeem from this package.`);
      return;
    }
    
    const newAssignment: ServiceAppointmentItem = {
      _tempId: `redeemed-${item.itemId}-${Date.now()}`,
      itemId: item.itemId,
      serviceId: item.itemId,
      itemName: `(Package) ${item.itemName}`,
      price: 0,
      duration: allServices.find(s => s._id === item.itemId)?.duration || 0,
      stylistId: '',
      type: 'service',
      availableStylists: assignableStaff,
      isLoadingStylists: isLoadingStaff,
      isRedeemed: true,
    };
    setAppointmentItems(prev => [...prev, newAssignment]);
    
    setRedeemedItems(prev => [...(prev || []), {
      customerPackageId: pkg._id,
      redeemedItemId: item.itemId,
      redeemedItemType: item.itemType as 'service' | 'product',
    }]);
    
    toast.success(`"${item.itemName}" added to appointment from package.`);
  };

  const handleRemoveItem = (_tempId: string) => {
    const itemToRemove = appointmentItems.find(a => a._tempId === _tempId);
    if (!itemToRemove) return;

    if (itemToRemove.isRedeemed) {
      setRedeemedItems(prev => {
        if (!prev) return [];
        const redeemed = [...prev];
        const indexToRemove = redeemed.findIndex(r => r.redeemedItemId === itemToRemove.itemId);
        if (indexToRemove > -1) {
          redeemed.splice(indexToRemove, 1);
        }
        return redeemed;
      });
      toast.info("Redeemed item removed from appointment.");
    }
    
    setAppointmentItems(prev => prev.filter(a => a._tempId !== _tempId));
  };

  const handleSubmit = async (e: FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setStockIssues(null);
      const { phoneNumber, customerName, date, time, status, gender } = formData;
      if (!phoneNumber || !customerName || !date || !time || !status || !gender) { setFormError('Please fill in all customer and schedule details.'); return; }
      if (appointmentItems.length === 0) { setFormError('Please add at least one service or product.'); return; }
      
      const serviceItems = appointmentItems.filter(a => a.type === 'service') as ServiceAppointmentItem[];
      if (serviceItems.some(a => !a.stylistId)) { setFormError('A staff member must be assigned to every service.'); return; }

      setIsSubmitting(true);
      try {
          const serviceIds = serviceItems.map(a => a.itemId);
          const productIds = appointmentItems.filter(a => a.type === 'product').map(a => a.itemId);

          const checkPayload = {
            serviceIds,
            productIds,
            customerGender: formData.gender as 'male' | 'female' | 'other'
          };

          const checkRes = await tenantAwareFetch('/api/appointment/check-consumables', { method: 'POST', body: JSON.stringify(checkPayload) });
          const checkData = await checkRes.json();
          if (!checkRes.ok || !checkData.success) { throw new Error(checkData.message || "Failed to check stock availability."); }
          if (checkData.canBook === false) {
              toast.error("Cannot book: Required items are out of stock. See details below.");
              setStockIssues(checkData.issues);
              setIsSubmitting(false);
              return;
          }

          const finalServiceAssignments = serviceItems.map(a => ({ serviceId: a.serviceId, stylistId: a.stylistId, guestName: a.guestName || undefined }));
          const finalProductAssignments = appointmentItems.filter(item => item.type === 'product').map(p => ({ productId: p.itemId }));

          const appointmentData: NewBookingData = {
            ...formData,
            serviceAssignments: finalServiceAssignments,
            productAssignments: finalProductAssignments,
            appointmentType: formData.status === 'Checked-In' ? 'Offline' : 'Online',
            redeemedItems: redeemedItems,
          };
          await onBookAppointment(appointmentData);
      } catch (error: any) { setFormError(error.message || 'An unexpected error occurred.'); }
      finally { setIsSubmitting(false); }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-4 sm:p-6 md:p-8 max-w-6xl w-full max-h-[95vh] flex flex-col">
          <div className="flex justify-between items-center mb-6 pb-4 border-b">
            <h2 className="text-xl md:text-2xl font-bold">Book New Appointment</h2>
            <button onClick={onClose}><XMarkIcon className="w-6 h-6" /></button>
          </div>

          <div className="flex-grow overflow-y-auto grid grid-cols-1 lg:grid-cols-3 gap-x-8">
            <form onSubmit={handleSubmit} className="space-y-6 lg:col-span-2 flex flex-col" autoComplete="off">
              <div className="space-y-6 flex-grow">
                {formError && (<div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{formError}</div>)}
                {stockIssues && stockIssues.length > 0 && (
                <div className="my-4 p-4 border-l-4 border-orange-500 bg-orange-50 text-orange-800 rounded-r-lg">
                  <h4 className="font-bold">Cannot Book: Insufficient Consumables</h4>
                  <ul className="list-disc pl-5 mt-2 text-sm space-y-1">{stockIssues.map((issue, index) => (<li key={index}><strong>{issue.productName}</strong>: Requires {issue.required}{issue.unit}, but only {issue.available}{issue.unit} available.</li>))}</ul>
                </div>
                )}
                
                <CustomerInformationForm
                  formData={formData}
                  handleChange={handleChange}
                  handleSelectCustomer={handleSelectCustomer}
                  handleClearSelection={handleClearSelection}
                  isCustomerSelected={isCustomerSelected}
                  customerSearchResults={customerSearchResults}
                  isSearchingCustomers={isSearchingCustomers}
                  customerLookupStatus={customerLookupStatus}
                  searchMode={searchMode}
                  setSearchMode={setSearchMode}
                  barcodeQuery={barcodeQuery}
                  setBarcodeQuery={setBarcodeQuery}
                  handleBarcodeSearch={handleBarcodeSearch}
                  isSearchingByBarcode={isSearchingByBarcode}
                  phoneInputRef={phoneInputRef}
                  nameInputRef={nameInputRef}
                  barcodeInputRef={barcodeInputRef}
                />

                <AppointmentDetailsForm
                   formData={formData}
                   handleChange={handleChange}
                   selectedCustomerDetails={selectedCustomerDetails}
                   customerPackages={customerPackages}
                   isLoadingPackages={isLoadingPackages}
                   packageError={packageError}
                   handleRedeemItem={handleRedeemItem}
                   itemSearch={itemSearch}
                   setItemSearch={setItemSearch}
                   filteredItems={filteredItems}
                   handleAddItem={handleAddItem}
                   appointmentItems={appointmentItems}
                   handleRemoveItem={handleRemoveItem}
                   handleUpdateItem={handleUpdateItem}
                   total={total}
                   membershipSavings={membershipSavings}
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t mt-auto">
                <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm bg-white border rounded-lg hover:bg-gray-50 w-full sm:w-auto" disabled={isSubmitting}>Cancel</button>
                <button type="submit" className="px-5 py-2.5 text-sm text-white bg-gray-800 rounded-lg hover:bg-black flex items-center justify-center w-full sm:w-auto sm:min-w-[150px]" disabled={isSubmitting}>{isSubmitting ? (<div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />) : ('Book Appointment')}</button>
              </div>
            </form>

            <div className="lg:col-span-1 lg:border-l lg:pl-8 mt-8 lg:mt-0">
              <CustomerDetailPanel customer={selectedCustomerDetails} isLoading={isLoadingCustomerDetails} onToggleMembership={handleToggleMembership} onViewFullHistory={() => setShowCustomerHistory(true)} tenantId={session?.user?.tenantId} />
            </div>
          </div>
        </div>
      </div>

      <CustomerHistoryModal isOpen={showCustomerHistory} onClose={() => setShowCustomerHistory(false)} customer={selectedCustomerDetails} />
    </>
  );
}