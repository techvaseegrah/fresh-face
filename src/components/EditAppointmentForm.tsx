'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { XMarkIcon, CurrencyRupeeIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-toastify';
import { Combobox } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import { useSession } from 'next-auth/react';

// ===================================================================================
//  INTERFACES
// ===================================================================================
interface ServiceFromAPI {
  _id: string;
  name: string;
  price: number;
  duration: number;
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

// ✅ UPDATED INTERFACE
interface ServiceInForm extends ServiceFromAPI {
  _tempId: string; // To uniquely identify each instance in the list
  isRedeemed: boolean;
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
  // Form state
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    notes: '',
    status: 'Appointment' as AppointmentForEdit['status'],
    stylistId: '',
  });

  // Data state
  const [allServices, setAllServices] = useState<ServiceFromAPI[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceInForm[]>([]);
  const [availableStylists, setAvailableStylists] = useState<StylistFromAPI[]>([]);
  
  // UI state
  const [isLoadingStylists, setIsLoadingStylists] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');

  // Get the user's session to access the tenantId
  const { data: session } = useSession();

  // Create a reusable, tenant-aware fetch wrapper
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

  // Derived state for total calculation
  const { total, membershipSavings } = useMemo(() => {
    let total = 0;
    let membershipSavings = 0;
    const isMember = appointment?.customerId?.isMembership || false;

    selectedServices.forEach(service => {
      const originalService = allServices.find(s => s._id === service._id) || service;
      const hasDiscount = isMember && !service.isRedeemed && typeof originalService.membershipRate === 'number';
      const price = hasDiscount ? originalService.membershipRate! : service.price;
      
      total += price;

      if (hasDiscount) {
        membershipSavings += originalService.price - originalService.membershipRate!;
      }
    });
    return { total, membershipSavings };
  }, [selectedServices, appointment?.customerId?.isMembership, allServices]);

  // Effect to populate form when an appointment is selected
  useEffect(() => {
    if (isOpen && appointment) {
      const appointmentDate = new Date(appointment.appointmentDateTime);
      const datePart = appointmentDate.toISOString().split('T')[0];
      const hours = String(appointmentDate.getHours()).padStart(2, '0');
      const minutes = String(appointmentDate.getMinutes()).padStart(2, '0');
      const timePart = `${hours}:${minutes}`;

      setFormData({
        date: datePart,
        time: timePart,
        notes: appointment.notes || '',
        status: appointment.status,
        stylistId: appointment.stylistId?._id || '',
      });

      // ✅ MODIFIED to add a unique _tempId to each initial service
      const processedServices = (appointment.serviceIds || []).map((service, index) => {
        const isRedeemed = appointment.redeemedItems?.some(
          redeemed => String(redeemed.redeemedItemId) === String(service._id)
        ) || false;

        return {
          ...service,
          _tempId: `initial-${service._id}-${index}`, // Unique ID for each instance
          price: isRedeemed ? 0 : service.price,
          name: isRedeemed ? `(Package) ${service.name}` : service.name,
          isRedeemed: isRedeemed,
        };
      });
      setSelectedServices(processedServices);

      const fetchServices = async () => {
        try {
          const res = await tenantAwareFetch('/api/service-items');
          const data = await res.json();
          if (data.success) {
            setAllServices(data.services);
          } else {
            toast.error("Failed to load services.");
          }
        } catch (e) {
          console.error('Failed to fetch services:', e);
          toast.error("Error loading services.");
        }
      };
      fetchServices();
      
      setError(null);
      setServiceSearchQuery('');
    }
  }, [isOpen, appointment, tenantAwareFetch]);

  // Effect to find available stylists when date/time changes
  useEffect(() => {
    if (!isOpen || !formData.date || !formData.time) return;

    const findStylists = async () => {
      setIsLoadingStylists(true);
      try {
        const res = await tenantAwareFetch(`/api/staff?action=listForAssignment`);
        const data = await res.json();
        
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Could not fetch staff list.');
        }

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
        setIsLoadingStylists(false);
      }
    };

    findStylists();
  }, [isOpen, formData.date, formData.time, appointment?.stylistId, tenantAwareFetch]);

  // ✅ MODIFIED Handlers for adding/removing services
  const handleAddService = (serviceId: string) => {
    if (!serviceId) return;
    const serviceToAdd = allServices.find((s) => s._id === serviceId);
    if (serviceToAdd) {
      setSelectedServices(prev => [...prev, { 
        ...serviceToAdd, 
        isRedeemed: false, 
        _tempId: Date.now().toString() // Assign a new unique ID
      }]);
    }
    setServiceSearchQuery('');
  };

  const handleRemoveService = (_tempId: string) => {
    setSelectedServices(prev => prev.filter((s) => s._tempId !== _tempId));
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment || selectedServices.length === 0) {
        setError("At least one service is required.");
        return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const updateData = {
          ...formData,
          serviceIds: selectedServices.map(s => s._id),
          appointmentType: appointment.appointmentType,
      };
      await onUpdateAppointment(appointment.id, updateData);
    } catch (err: any) {
      setError(err.message || 'Failed to update appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Memoized, universal search for services
  const filteredServices = useMemo(() => {
    const query = serviceSearchQuery.trim().toLowerCase();
    if (query === '') {
      return [...allServices].sort((a, b) => a.price - b.price);
    }
    const filtered = allServices.filter(service => 
      service.name.toLowerCase().includes(query) || 
      String(service.price).includes(query)
    );
    return filtered.sort((a,b) => a.price - b.price);
  }, [serviceSearchQuery, allServices]);

  if (!isOpen || !appointment) return null;

  const inputClasses = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/30 text-sm';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold">Edit Appointment</h2>
            <p className="text-sm text-gray-600 mt-1">
              {appointment.customerId.name} - {appointment.customerId.phoneNumber}
              {appointment.customerId.isMembership && (
                <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-semibold">
                  Member
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose}>
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-grow">
          {error && (<div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>)}

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CurrencyRupeeIcon className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Appointment Total:</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">₹{total.toFixed(2)}</div>
                {membershipSavings > 0 && (<div className="text-xs text-green-500">Member savings: ₹{membershipSavings.toFixed(2)}</div>)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select value={formData.status} onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as AppointmentForEdit['status'] }))} className={inputClasses}>
                <option value="Appointment">Appointment</option>
                <option value="Checked-In">Checked-In</option>
                <option value="Checked-Out">Checked-Out</option>
                <option value="Cancelled">Cancelled</option>
                <option value="No-Show">No-Show</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select value={appointment.appointmentType} className={`${inputClasses} bg-gray-100`} disabled>
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input type="date" value={formData.date} onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))} className={inputClasses} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Time</label>
              <input type="time" value={formData.time} onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))} className={inputClasses} required />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Services</label>
            <Combobox onChange={handleAddService} value="">
              <div className="relative">
                <Combobox.Input
                  className={inputClasses + ' pr-10'}
                  onChange={(event) => setServiceSearchQuery(event.target.value)}
                  placeholder="Search to add more services..."
                  autoComplete="off"
                />
                <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </Combobox.Button>
              </div>
              <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full max-w-md overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm">
                {filteredServices.length === 0 && serviceSearchQuery !== '' ? (
                  <div className="relative cursor-default select-none px-4 py-2 text-gray-700">
                    Nothing found.
                  </div>
                ) : (
                  filteredServices.map((service) => (
                    <Combobox.Option
                      key={service._id}
                      value={service._id}
                      // ✅ REMOVED the disabled prop to allow re-selection
                      className={({ active }) =>
                        `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                          active ? 'bg-black text-white' : 'text-gray-900'
                        }`
                      }
                    >
                      {({ active }) => (
                        <>
                          <span className="block truncate font-normal">
                            {service.name} - ₹{service.price}
                          </span>
                          {selectedServices.some((s) => s._id === service._id) && (
                            <span className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? 'text-white' : 'text-teal-600'}`}>
                              <CheckIcon className="h-5 w-5" aria-hidden="true" />
                            </span>
                          )}
                        </>
                      )}
                    </Combobox.Option>
                  ))
                )}
              </Combobox.Options>
            </Combobox>
            <div className="mt-2 space-y-2">
              {selectedServices.map((service) => (
                <div key={service._tempId} /* ✅ Use _tempId for the key */ className={`flex items-center justify-between p-2 rounded ${service.isRedeemed ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-100'}`}>
                  <div>
                    <span className="font-medium text-sm">{service.name}</span>
                    <span className="text-xs text-gray-600 ml-2">({service.duration} min)</span>
                     {service.isRedeemed && (<span className="ml-2 text-xs font-semibold text-indigo-800 bg-indigo-200 px-2 py-0.5 rounded-full">Package</span>)}
                  </div>
                  <div className="flex items-center gap-3">
                    {appointment.customerId.isMembership && !service.isRedeemed && typeof service.membershipRate === 'number' ? (
                      <div className="text-right">
                        <div className="line-through text-gray-400 text-xs">₹{service.price.toFixed(2)}</div>
                        <div className="text-green-600 font-semibold text-sm">₹{service.membershipRate.toFixed(2)}</div>
                      </div>
                    ) : (
                      <span className={`font-semibold text-sm ${service.isRedeemed ? 'text-indigo-600' : 'text-gray-800'}`}>
                        {service.isRedeemed ? 'Redeemed' : `₹${service.price.toFixed(2)}`}
                      </span>
                    )}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveService(service._tempId)} // ✅ Pass the unique _tempId
                      className="text-red-500 hover:text-red-700 text-xl font-bold leading-none" 
                      disabled={service.isRedeemed}
                    >
                        &times;
                    </button>
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
                disabled={isLoadingStylists}
                required
            >
              {isLoadingStylists ? (<option>Loading staff...</option>) : (
                <>
                  <option value="" disabled>Select a staff member</option>
                  {availableStylists.map((stylist) => (
                    <option key={stylist._id} value={stylist._id}>
                      {stylist.name}
                      {stylist._id === appointment.stylistId?._id && ' (Current)'}
                    </option>
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
            <button type="submit" className="px-6 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 min-w-[120px]" disabled={isSubmitting || selectedServices.length === 0}>
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Updating...
                </div>
              ) : ( formData.status === 'Checked-Out' ? 'Update & Bill' : 'Update Appointment' )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}