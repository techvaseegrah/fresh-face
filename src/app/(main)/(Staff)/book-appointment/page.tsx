'use client';

import React, { useState, useEffect, FormEvent, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { useSession } from 'next-auth/react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { useDebounce } from '@/hooks/useDebounce';

// --- INTERFACES & TYPES (No Changes) ---
interface ServiceFromAPI { _id: string; name: string; price: number; duration: number; }
interface StylistFromAPI { _id: string; name: string; }
interface ServiceAssignment {
  _tempId: string;
  serviceId: string;
  stylistId: string;
  serviceDetails: ServiceFromAPI;
}
interface NewStaffBookingData {
  customerId?: string;
  phoneNumber: string;
  customerName: string;
  email: string;
  gender: string;
  dob?: string;
  serviceAssignments: { serviceId: string; stylistId: string; }[];
  date: string;
  time: string;
  notes?: string;
}

// ===================================================================================
//  MAIN STAFF BOOKING FORM COMPONENT
// ===================================================================================
export default function StaffBookAppointmentPage() {
  const [formData, setFormData] = useState({
    customerId: '',
    phoneNumber: '',
    customerName: '',
    email: '',
    gender: '',
    dob: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    notes: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serviceAssignments, setServiceAssignments] = useState<ServiceAssignment[]>([]);
  const [allServices, setAllServices] = useState<ServiceFromAPI[]>([]);
  const [filteredServices, setFilteredServices] = useState<ServiceFromAPI[]>([]);
  
  const [serviceSearch, setServiceSearch] = useState('');
  const debouncedServiceSearch = useDebounce(serviceSearch, 300);

  const [customerLookupStatus, setCustomerLookupStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');
  const [isCustomerSelected, setIsCustomerSelected] = useState(false);
  
  const { data: session } = useSession();
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const tenantAwareFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const tenantId = session?.user?.tenantId;
    if (!tenantId) {
      toast.error("Session invalid. Please sign in again.");
      throw new Error("Tenant ID not found.");
    }
    const headers = { 'Content-Type': 'application/json', ...options.headers, 'x-tenant-id': tenantId };
    return fetch(url, { ...options, headers });
  }, [session]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await tenantAwareFetch('/api/staff/booking-data');
        const result = await res.json();
        if (result.success) {
          setAllServices(result.data.services);
        } else {
          toast.error(result.message || 'Failed to load booking data.');
        }
      } catch (e) {
        toast.error('An error occurred while loading page data.');
        console.error(e);
      }
    };
    if (session) {
      fetchData();
    }
  }, [tenantAwareFetch, session]);

  useEffect(() => {
    const query = debouncedServiceSearch.trim().toLowerCase();
    if (!allServices || allServices.length === 0) return;
    if (!query) {
      setFilteredServices(allServices);
    } else {
      const filtered = allServices.filter(service =>
        service.name.toLowerCase().includes(query)
      );
      setFilteredServices(filtered);
    }
  }, [debouncedServiceSearch, allServices]);

  const handleClearCustomer = () => {
    setIsCustomerSelected(false);
    setCustomerLookupStatus('idle');
    setFormData(prev => ({
        ...prev,
        customerId: '', phoneNumber: '', customerName: '', email: '', gender: '', dob: '',
    }));
    phoneInputRef.current?.focus();
  };

  const handleFindCustomer = useCallback(async (phone: string) => {
    if (phone.length !== 10) return;
    setCustomerLookupStatus('searching');
    try {
      const res = await tenantAwareFetch(`/api/staff/find-customer?phone=${encodeURIComponent(phone.trim())}`);
      const data = await res.json();
      if (res.ok && data.success) {
        const cust = data.customer;
        setFormData(prev => ({
            ...prev,
            customerId: cust._id,
            customerName: cust.name,
            phoneNumber: cust.phoneNumber,
            email: cust.email || '',
            gender: cust.gender || 'other',
            dob: cust.dob || '',
        }));
        setCustomerLookupStatus('found');
        setIsCustomerSelected(true);
      } else {
        setCustomerLookupStatus('not_found');
        setIsCustomerSelected(false);
        setFormData(prev => ({ ...prev, customerId: '', dob: '' }));
        toast.info('New customer. Please fill in their details.');
        nameInputRef.current?.focus();
      }
    } catch (err) {
      setCustomerLookupStatus('not_found');
      setIsCustomerSelected(false);
      toast.error('Failed to search for customer.');
    }
  }, [tenantAwareFetch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    let { name, value } = e.target;
    if (name === 'phoneNumber') {
      value = value.replace(/[^\d]/g, '');
      if (value.length < 10 && isCustomerSelected) {
        handleClearCustomer();
      }
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const phone = formData.phoneNumber.trim();
    if (phone.length === 10 && !isCustomerSelected) {
      const handler = setTimeout(() => {
        handleFindCustomer(phone);
      }, 500);
      return () => clearTimeout(handler);
    }
  }, [formData.phoneNumber, isCustomerSelected, handleFindCustomer]);

  const handleAddService = (service: ServiceFromAPI) => {
    if (!session?.user?.id) {
        toast.error("Your session is invalid. Cannot assign staff.");
        return;
    }
    if (!serviceAssignments.some(a => a.serviceId === service._id)) {
      const newAssignment: ServiceAssignment = {
        _tempId: Date.now().toString(),
        serviceId: service._id,
        stylistId: session.user.id,
        serviceDetails: service,
      };
      setServiceAssignments(prev => [...prev, newAssignment]);
      setServiceSearch('');
    }
  };

  const handleRemoveService = (_tempId: string) => {
    setServiceAssignments(prev => prev.filter(a => a._tempId !== _tempId));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    if (!formData.phoneNumber || !formData.customerName || !formData.date || !formData.time || !formData.gender) {
        setFormError('Please fill in all required customer and schedule details.');
        return;
    }
    if (serviceAssignments.length === 0) {
        setFormError('Please add at least one service.');
        return;
    }
    if (serviceAssignments.some(a => !a.stylistId)) {
        setFormError('A staff member could not be automatically assigned. Please refresh.');
        return;
    }

    setIsSubmitting(true);
    try {
        const appointmentData: NewStaffBookingData = {
            ...formData,
            serviceAssignments: serviceAssignments.map(({ serviceId, stylistId }) => ({ serviceId, stylistId })),
        };
        
        const response = await tenantAwareFetch('/api/staff/appointments', {
            method: 'POST',
            body: JSON.stringify(appointmentData),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Failed to book appointment.');
        }

        toast.success('Appointment successfully booked!');
        setFormData({
            customerId: '', phoneNumber: '', customerName: '', email: '', gender: '', dob: '',
            date: new Date().toISOString().split('T')[0], time: '', notes: '',
        });
        setServiceAssignments([]);
        setIsCustomerSelected(false);
        setCustomerLookupStatus('idle');

    } catch (error: any) {
        setFormError(error.message || 'An unexpected error occurred.');
        toast.error(error.message || 'An unexpected error occurred.');
    } finally {
        setIsSubmitting(false);
    }
  };

  const inputBaseClasses = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/30 text-sm';
  const fieldsetClasses = 'border border-gray-200 p-4 rounded-lg';
  const legendClasses = 'text-base font-semibold text-gray-800 px-2';

  return (
    // --- THIS IS THE KEY CHANGE ---
    // The main container is a fragment <> to allow the heading and form to be siblings.
    <>
      {/* 1. The new, separate heading, just like your "My Attendance" page */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Book Appointment</h1>
        <p className="text-gray-500 mt-1">Create a new appointment for a customer.</p>
      </div>

      {/* 2. The entire form is now wrapped in its own white card */}
      <div className="bg-white rounded-xl shadow-sm p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {formError && (<div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{formError}</div>)}

          <fieldset className={fieldsetClasses}>
              <legend className={legendClasses}>Customer Details</legend>
              <div className="grid md:grid-cols-2 gap-x-6 gap-y-5 mt-4">
                  <div className="md:col-span-2">
                      <label htmlFor="phoneNumber" className="block text-sm font-medium mb-1.5">Phone Number <span className="text-red-500">*</span></label>
                      <input ref={phoneInputRef} id="phoneNumber" type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} required placeholder="Enter 10-digit phone to find or create customer" className={inputBaseClasses} maxLength={10} />
                       <div className="h-5 mt-1 text-xs">
                          {customerLookupStatus === 'searching' && <span className="text-gray-500">Searching...</span>}
                          {customerLookupStatus === 'found' && <span className="font-semibold text-green-600">✓ Existing Customer Found.</span>}
                          {customerLookupStatus === 'not_found' && <span className="font-medium text-blue-600">New Customer: Please fill details below.</span>}
                      </div>
                  </div>
                  <div>
                      <label htmlFor="customerName" className="block text-sm font-medium mb-1.5">Full Name <span className="text-red-500">*</span></label>
                      <input ref={nameInputRef} id="customerName" type="text" name="customerName" value={formData.customerName} onChange={handleChange} required className={`${inputBaseClasses} ${isCustomerSelected ? 'bg-gray-100' : ''}`} disabled={isCustomerSelected}/>
                  </div>
                  <div>
                      <label htmlFor="email" className="block text-sm font-medium mb-1.5">Email</label>
                      <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} className={`${inputBaseClasses} ${isCustomerSelected ? 'bg-gray-100' : ''}`} disabled={isCustomerSelected}/>
                  </div>
                  <div>
                      <label htmlFor="gender" className="block text-sm font-medium mb-1.5">Gender <span className="text-red-500">*</span></label>
                      <select id="gender" name="gender" value={formData.gender || ''} onChange={handleChange} required className={`${inputBaseClasses} ${isCustomerSelected ? 'bg-gray-100' : ''}`} disabled={isCustomerSelected}>
                          <option value="" disabled>Select Gender</option>
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                          <option value="other">Other</option>
                      </select>
                  </div>
                  <div>
                      <label htmlFor="dob" className="block text-sm font-medium mb-1.5">Date of Birth</label>
                      <input id="dob" type="date" name="dob" value={formData.dob} onChange={handleChange} className={`${inputBaseClasses} ${isCustomerSelected ? 'bg-gray-100' : ''}`} disabled={isCustomerSelected}/>
                  </div>
                  {isCustomerSelected && (
                      <div className="md:col-span-2">
                          <button type="button" onClick={handleClearCustomer} className="text-xs text-blue-600 hover:underline">Clear Selection to Add New Customer</button>
                      </div>
                  )}
              </div>
          </fieldset>
          
          <fieldset className={fieldsetClasses}>
              <legend className={legendClasses}>Appointment Details</legend>
               <div className="grid md:grid-cols-2 gap-x-6 gap-y-5 mt-4">
                  <div>
                      <label htmlFor="date" className="block text-sm font-medium mb-1.5">Date <span className="text-red-500">*</span></label>
                      <input id="date" type="date" name="date" value={formData.date} onChange={handleChange} required className={inputBaseClasses} />
                  </div>
                  <div>
                      <label htmlFor="time" className="block text-sm font-medium mb-1.5">Time <span className="text-red-500">*</span></label>
                      <input id="time" type="time" name="time" value={formData.time} onChange={handleChange} required className={inputBaseClasses} />
                  </div>
                  <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1.5">Add Services <span className="text-red-500">*</span></label>
                      <div className="relative">
                          <input type="text" value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} placeholder="Search for a service..." className={inputBaseClasses} />
                          {serviceSearch && (
                              <ul className="absolute z-20 w-full bg-white border rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                                  {filteredServices.length > 0 ? (
                                      filteredServices.map((service) => (
                                          <li key={service._id} onClick={() => handleAddService(service)} className="px-4 py-2 text-sm hover:bg-gray-100 cursor-pointer flex justify-between">
                                              <span>{service.name}</span>
                                              <span className="font-semibold">₹{service.price}</span>
                                          </li>
                                      ))
                                  ) : (
                                      <li className="px-4 py-2 text-sm text-gray-500">No services found.</li>
                                  )}
                              </ul>
                          )}
                      </div>
                  </div>
                  <div className="md:col-span-2 mt-2 space-y-3">
                      {serviceAssignments.map((assignment, index) => (
                          <div key={assignment._tempId} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                              <div className="flex items-start justify-between">
                                  <div className="font-semibold text-gray-800">{index + 1}. {assignment.serviceDetails.name}</div>
                                  <button type="button" onClick={() => handleRemoveService(assignment._tempId)} className="p-1 text-red-500 hover:bg-red-100 rounded-full" title="Remove Service">
                                      <XMarkIcon className="w-5 h-5" />
                                  </button>
                              </div>
                              <div className="mt-3 pt-3 border-t">
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Assigned Staff</label>
                                  <input type="text" value={session?.user?.name || ''} disabled className={`${inputBaseClasses} bg-gray-100 cursor-not-allowed`} />
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="md:col-span-2">
                      <label htmlFor="notes" className="block text-sm font-medium mb-1.5">Notes</label>
                      <textarea id="notes" name="notes" rows={3} value={formData.notes} onChange={handleChange} className={`${inputBaseClasses} resize-none`} placeholder="Any special requests or notes..."/>
                  </div>
               </div>
          </fieldset>

          <div className="flex justify-end gap-3 pt-6 border-t mt-auto">
              <button type="submit" className="px-6 py-2.5 text-sm text-white bg-black rounded-lg hover:bg-gray-800 flex items-center justify-center min-w-[150px]" disabled={isSubmitting}>
                  {isSubmitting ? (<div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />) : ('Book Appointment')}
              </button>
          </div>
        </form>
      </div>
    </>
  );
}