'use client';

import React, { useState, useEffect, FormEvent, useCallback, useRef } from 'react';
import { ChevronDownIcon, XMarkIcon, UserCircleIcon, CalendarDaysIcon, SparklesIcon, TagIcon, GiftIcon } from '@heroicons/react/24/solid';

// ===================================================================================
//  INTERFACES & TYPE DEFINITIONS
// ===================================================================================
export interface NewBookingData { customerId?: string; phoneNumber: string; customerName: string; email: string; serviceIds: string[]; stylistId: string; date: string; time: string; notes?: string; }
interface ServiceFromAPI { _id: string; name: string; price: number; }
interface StylistFromAPI { _id: string; name: string; }
interface CustomerSearchResult { _id: string; name: string; phoneNumber: string; email?: string; }
interface AppointmentHistory { _id: string; date: string; services: string[]; totalAmount: number; stylistName: string; }
interface CustomerDetails { _id: string; name: string; email: string; phoneNumber: string; isMember: boolean; membershipDetails: { planName: string; status: 'Active' | 'Expired' | 'Cancelled' } | null; lastVisit: string | null; appointmentHistory: AppointmentHistory[]; loyaltyPoints?: number; }
interface BookAppointmentFormProps { isOpen: boolean; onClose: () => void; onBookAppointment: (data: NewBookingData) => Promise<void>; }

// ===================================================================================
//  HELPER COMPONENTS
// ===================================================================================
const Spinner = () => ( <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> );

const CustomerDetailPanel = ({ customer, isLoading }: { customer: CustomerDetails | null; isLoading: boolean; }) => {
  if (isLoading) { return (<div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded-md w-3/4"></div><div className="h-5 bg-gray-200 rounded-md w-1/2"></div><div className="h-24 bg-gray-100 rounded-lg mt-6"></div><div className="h-32 bg-gray-100 rounded-lg"></div></div>); }
  if (!customer) { return ( <div className="text-center text-gray-500 h-full flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg"><UserCircleIcon className="w-16 h-16 text-gray-300 mb-4" /><h3 className="font-semibold text-gray-700">Customer Details</h3><p className="text-sm">Enter a phone number to look up an existing customer.</p></div>); }
  const getMembershipStatusClasses = (status?: string) => { switch (status) { case 'Active': return 'bg-green-100 text-green-800'; case 'Expired': return 'bg-red-100 text-red-700'; case 'Cancelled': return 'bg-yellow-100 text-yellow-800'; default: return 'bg-gray-100 text-gray-800'; } };
  return (
    <div>
      <h3 className="text-xl font-bold text-gray-900">{customer.name}</h3>
      <div className="mt-4 space-y-3 text-sm">
        <div className="flex items-center gap-3"><SparklesIcon className="w-5 h-5 text-yellow-500" /><span className="font-medium text-gray-600">Membership:</span>{customer.isMember && customer.membershipDetails ? (<span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getMembershipStatusClasses(customer.membershipDetails.status)}`}>{customer.membershipDetails.planName} - {customer.membershipDetails.status}</span>) : (<span className="text-gray-500">Not a Member</span>)}</div>
        <div className="flex items-center gap-3"><CalendarDaysIcon className="w-5 h-5 text-gray-400" /><span className="font-medium text-gray-600">Last Visit:</span><span>{customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString() : 'N/A'}</span></div>
        <div className="flex items-center gap-3 pt-3 border-t border-gray-200"><GiftIcon className="w-5 h-5 text-indigo-500" /><span className="font-medium text-gray-600">Loyalty Points:</span><span className="font-bold text-lg text-indigo-600">{customer.loyaltyPoints ?? 0}</span></div>
      </div>
      <div className="mt-8">
        <h4 className="text-base font-semibold text-gray-800 border-b pb-2 mb-3">Appointment History</h4>
        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2">{customer.appointmentHistory.length > 0 ? customer.appointmentHistory.map(apt => (<div key={apt._id} className="p-3 bg-gray-100/70 rounded-lg text-sm"><div className="flex justify-between items-start"><p className="font-semibold">{new Date(apt.date).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p><p className="font-bold text-gray-800">₹{apt.totalAmount.toFixed(2)}</p></div><p className="text-xs text-gray-600">with {apt.stylistName}</p><div className="flex items-start gap-2 mt-2 pt-2 border-t text-xs text-gray-500"><TagIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /><span>{Array.isArray(apt.services) ? apt.services.join(', ') : 'Details unavailable'}</span></div></div>)) : <p className="text-sm text-gray-500 italic">No past appointments found.</p>}</div>
      </div>
    </div>
  );
};


// ===================================================================================
//  MAIN BOOKING FORM COMPONENT
// ===================================================================================
export default function BookAppointmentForm({ isOpen, onClose, onBookAppointment }: BookAppointmentFormProps) {
  const initialFormData: NewBookingData = { customerId: undefined, phoneNumber: '', customerName: '', email: '', serviceIds: [], stylistId: '', date: '', time: '', notes: '' };
  
  const [formData, setFormData] = useState<NewBookingData>(initialFormData);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allServices, setAllServices] = useState<ServiceFromAPI[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceFromAPI[]>([]);
  const [availableStylists, setAvailableStylists] = useState<StylistFromAPI[]>([]);
  const [isLoadingStylists, setIsLoadingStylists] = useState(false);
  const [customerSearchResults, setCustomerSearchResults] = useState<CustomerSearchResult[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [isCustomerSelected, setIsCustomerSelected] = useState(false);
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<CustomerDetails | null>(null);
  const [isLoadingCustomerDetails, setIsLoadingCustomerDetails] = useState(false);
  
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => {
    if (isOpen) {
      setFormData(initialFormData); setFormError(null); setIsSubmitting(false);
      setIsCustomerSelected(false); setSelectedServices([]); setAvailableStylists([]);
      setSelectedCustomerDetails(null); setCustomerSearchResults([]);
      const fetchServices = async () => { try { const res = await fetch('/api/servicess'); const data = await res.json(); if (data.success) setAllServices(data.services); } catch (e) { console.error(e); }};
      fetchServices();
    }
  }, [isOpen]);

  const findAvailableStylists = useCallback(async () => {
    if (!formData.date || !formData.time || formData.serviceIds.length === 0) { setAvailableStylists([]); return; }
    setIsLoadingStylists(true);
    try {
      const serviceIdsQuery = formData.serviceIds.map(id => `serviceIds=${id}`).join('&');
      const res = await fetch(`/api/stylists/available?date=${formData.date}&time=${formData.time}&${serviceIdsQuery}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Could not fetch stylists.");
      setAvailableStylists(data.stylists);
      if (formData.stylistId && !data.stylists.some((s: StylistFromAPI) => s._id === formData.stylistId)) {
        setFormData(prev => ({ ...prev, stylistId: '' }));
      }
    } catch (err: any) { setFormError(err.message); setAvailableStylists([]); }
    finally { setIsLoadingStylists(false); }
  }, [formData.date, formData.time, formData.serviceIds, formData.stylistId]);
  useEffect(() => { findAvailableStylists(); }, [findAvailableStylists]);

  useEffect(() => {
    const query = formData.phoneNumber.trim();
    if (isCustomerSelected || query.length < 5) { setCustomerSearchResults([]); return; }
    const handler = setTimeout(async () => {
      setIsSearchingCustomers(true);
      try {
        const res = await fetch(`/api/customer/search?query=${query}`);
        const data = await res.json();
        if (data.success) setCustomerSearchResults(data.customers);
      } catch (error) { console.error("Customer search failed:", error); }
      finally { setIsSearchingCustomers(false); }
    }, 500);
    return () => clearTimeout(handler);
  }, [formData.phoneNumber, isCustomerSelected]);

  // --- Handlers ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (isCustomerSelected && ['customerName', 'phoneNumber', 'email'].includes(name)) { handleClearSelection(false); }
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const fetchAndSetCustomerDetails = async (phone: string) => {
    if (phone.trim().length < 10) return;
    setIsLoadingCustomerDetails(true); setCustomerSearchResults([]);
    try {
      const res = await fetch(`/api/customer/search?query=${phone.trim()}&details=true`);
      const data = await res.json();
      if (res.ok && data.success && data.customer) {
        const cust = data.customer;
        setFormData(prev => ({...prev, customerId: cust._id, customerName: cust.name, phoneNumber: cust.phoneNumber, email: cust.email}));
        setSelectedCustomerDetails(cust); setIsCustomerSelected(true);
      } else {
        handleClearSelection(false);
        nameInputRef.current?.focus(); // Focus on name input if customer is new
      }
    } catch (err) { console.error("Failed to fetch customer details:", err); }
    finally { setIsLoadingCustomerDetails(false); }
  };
  
  const handleSelectCustomer = (customer: CustomerSearchResult) => { fetchAndSetCustomerDetails(customer.phoneNumber); };
  const handlePhoneBlur = () => { if (!isCustomerSelected) fetchAndSetCustomerDetails(formData.phoneNumber); };
  
  const handleClearSelection = (clearPhone = true) => {
    setIsCustomerSelected(false); setSelectedCustomerDetails(null);
    let resetData: any = { customerId: undefined, customerName: '', email: '' };
    if (clearPhone) {
        resetData.phoneNumber = '';
        phoneInputRef.current?.focus();
    } else {
        nameInputRef.current?.focus();
    }
    setFormData(prev => ({...prev, ...resetData}));
  };
  
  const handleAddService = (serviceId: string) => {
    if (!serviceId) return;
    const serviceToAdd = allServices.find(s => s._id === serviceId);
    if (serviceToAdd && !selectedServices.some(s => s._id === serviceId)) {
      const newSelectedList = [...selectedServices, serviceToAdd];
      setSelectedServices(newSelectedList);
      setFormData(prev => ({ ...prev, serviceIds: newSelectedList.map(s => s._id) }));
    }
  };
  const handleRemoveService = (serviceId: string) => {
    const newSelectedList = selectedServices.filter(s => s._id !== serviceId);
    setSelectedServices(newSelectedList);
    setFormData(prev => ({ ...prev, serviceIds: newSelectedList.map(s => s._id) }));
  };
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setFormError(null);
    if (!formData.phoneNumber || !formData.customerName || formData.serviceIds.length === 0 || !formData.stylistId || !formData.date || !formData.time) {
        setFormError("Please fill in all required fields."); return;
    }
    setIsSubmitting(true);
    try { await onBookAppointment(formData); }
    catch (error: any) { setFormError(error.message || "An unexpected error occurred."); }
    finally { setIsSubmitting(false); }
  };

  if (!isOpen) return null;
  const inputBaseClasses = "w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/30 text-sm";
  const fieldsetClasses = "border border-gray-200 p-4 rounded-lg";
  const legendClasses = "text-base font-semibold text-gray-800 px-2 -ml-2";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 md:p-8 max-w-5xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <h2 className="text-2xl font-bold">Book New Appointment</h2>
          <button onClick={onClose}><XMarkIcon className="w-6 h-6"/></button>
        </div>
        <div className="flex-grow overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-x-8">
          <form onSubmit={handleSubmit} className="space-y-6 md:col-span-2 flex flex-col">
            <div className="space-y-6 flex-grow">
              {formError && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{formError}</div>}
              <fieldset className={fieldsetClasses}>
                <legend className={legendClasses}>Customer Information</legend>
                <div className="grid md:grid-cols-2 gap-x-6 gap-y-5 mt-3">
                  <div className="md:col-span-2 relative">
                    <label htmlFor="phoneNumber" className="block text-sm font-medium mb-1.5">Phone Number <span className="text-red-500">*</span></label>
                    <input ref={phoneInputRef} id="phoneNumber" type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} onBlur={handlePhoneBlur} required placeholder="Enter phone to find or create..." className={inputBaseClasses} autoComplete="off" />
                     {(isSearchingCustomers || customerSearchResults.length > 0) && (
                        <ul className="absolute z-20 w-full bg-white border rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">{isSearchingCustomers ? <li className="px-3 py-2 text-sm text-gray-500">Searching...</li> : customerSearchResults.map(cust => (<li key={cust._id} onClick={() => handleSelectCustomer(cust)} className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer">{cust.name} - <span className="text-gray-500">{cust.phoneNumber}</span></li>))}</ul>
                      )}
                  </div>
                  <div><label htmlFor="customerName" className="block text-sm font-medium mb-1.5">Full Name</label><input ref={nameInputRef} id="customerName" type="text" name="customerName" value={formData.customerName} onChange={handleChange} required className={`${inputBaseClasses} disabled:bg-gray-100`} disabled={isCustomerSelected}/></div>
                  <div><label htmlFor="email" className="block text-sm font-medium mb-1.5">Email</label><input id="email" type="email" name="email" value={formData.email} onChange={handleChange} className={`${inputBaseClasses} disabled:bg-gray-100`} disabled={isCustomerSelected}/></div>
                </div>
                 {isCustomerSelected && <button type="button" onClick={() => handleClearSelection(true)} className="text-xs text-blue-600 hover:underline mt-2">Clear Selection & Add New</button>}
              </fieldset>
              <fieldset className={fieldsetClasses}>
                  <legend className={legendClasses}>Schedule & Service</legend>
                  <div className="grid md:grid-cols-2 gap-x-6 gap-y-5 mt-3">
                    <div><label htmlFor="date" className="block text-sm font-medium mb-1.5">Date <span className="text-red-500">*</span></label><input id="date" type="date" name="date" value={formData.date} onChange={handleChange} required className={inputBaseClasses}/></div>
                    <div><label htmlFor="time" className="block text-sm font-medium mb-1.5">Time <span className="text-red-500">*</span></label><input id="time" type="time" name="time" value={formData.time} onChange={handleChange} required className={inputBaseClasses}/></div>
                  </div>
                  <div className="mt-5"><label className="block text-sm font-medium mb-1.5">Add Services <span className="text-red-500">*</span></label><div className="relative"><select onChange={(e)=>{handleAddService(e.target.value);e.target.value=''}} value="" className={`${inputBaseClasses} pr-8`}><option value="" disabled>-- Click to add a service --</option>{allServices.map(service=>(<option key={service._id} value={service._id} disabled={selectedServices.some(s=>s._id===service._id)}>{service.name}</option>))}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2"><ChevronDownIcon className="h-5 w-5 text-gray-400"/></div></div></div>
                  <div className="mt-3 space-y-2">{selectedServices.length > 0 && selectedServices.map(service=>(<div key={service._id} className="flex items-center justify-between bg-gray-100 p-2 rounded-md text-sm"><span className="font-medium">{service.name}</span><div className="flex items-center gap-3"><span>₹{service.price.toFixed(2)}</span><button type="button" onClick={()=>handleRemoveService(service._id)} className="text-red-500 font-bold">×</button></div></div>))}</div>
                  <div className="relative mt-5"><label htmlFor="stylist" className="block text-sm font-medium mb-1.5">Stylist <span className="text-red-500">*</span></label><select id="stylist" name="stylistId" value={formData.stylistId} onChange={handleChange} required disabled={formData.serviceIds.length===0||!formData.date||!formData.time||isLoadingStylists} className={`${inputBaseClasses} pr-8 disabled:bg-gray-100`}><option value="" disabled>{isLoadingStylists?'Checking...':'Select a stylist'}</option>{availableStylists.length>0?availableStylists.map(s=>(<option key={s._id} value={s._id}>{s.name}</option>)):<option value="" disabled>{!isLoadingStylists&&'No stylists available'}</option>}</select><div className="pointer-events-none absolute inset-y-0 right-0 top-6 flex items-center px-2"><ChevronDownIcon className="h-5 w-5 text-gray-400"/></div></div>
                  <div className="mt-5"><label htmlFor="notes" className="block text-sm font-medium mb-1.5">Notes</label><textarea id="notes" name="notes" rows={3} value={formData.notes||''} onChange={handleChange} className={`${inputBaseClasses} resize-none`}></textarea></div>
              </fieldset>
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t mt-auto">
                <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm bg-white border rounded-lg hover:bg-gray-50" disabled={isSubmitting}>Cancel</button>
                <button type="submit" className="px-5 py-2.5 text-sm text-white bg-gray-800 rounded-lg hover:bg-black flex items-center justify-center min-w-[150px]" disabled={isSubmitting}>{isSubmitting?<Spinner/>:"Book Appointment"}</button>
            </div>
          </form>
          <div className="md:col-span-1 md:border-l md:pl-8 mt-8 md:mt-0">
            <CustomerDetailPanel customer={selectedCustomerDetails} isLoading={isLoadingCustomerDetails} />
          </div>
        </div>
      </div>
    </div>
  );
}