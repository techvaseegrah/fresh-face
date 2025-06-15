// components/EditAppointmentForm.tsx - WITH HISTORY BUTTON
'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { XMarkIcon, UserPlusIcon, ClockIcon, EyeIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-toastify';

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
  isAvailable?: boolean;
}

interface AppointmentData {
  id: string;
  customerId: any;
  stylistId: any;
  serviceIds: any[];
  date: string;
  time: string;
  notes?: string;
  status: string;
  appointmentType: 'Online' | 'Offline';
  estimatedDuration?: number;
  actualDuration?: number;
}

interface EditAppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentData | null;
  onUpdateAppointment: (appointmentId: string, data: any) => Promise<void>;
}

// === CUSTOMER HISTORY MODAL ===
const CustomerHistoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  customer: any;
}> = ({ isOpen, onClose, customer }) => {
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && customer?.phoneNumber) {
      fetchCustomerHistory();
    }
  }, [isOpen, customer]);

  const fetchCustomerHistory = async () => {
    if (!customer?.phoneNumber) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/customer/search?query=${customer.phoneNumber}&details=true`);
      const data = await res.json();
      if (data.success && data.customer) {
        setCustomerDetails(data.customer);
      }
    } catch (error) {
      console.error('Failed to fetch customer history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Appointment': return 'bg-blue-100 text-blue-800';
      case 'Checked-In': return 'bg-yellow-100 text-yellow-800';
      case 'Checked-Out': return 'bg-purple-100 text-purple-800';
      case 'Paid': return 'bg-green-100 text-green-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      case 'No-Show': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl p-6 max-w-5xl w-full max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <h2 className="text-2xl font-bold">Customer History - {customer?.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
            ×
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>Loading customer history...</p>
          </div>
        ) : customerDetails ? (
          <div>
            {/* Customer Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{customerDetails.appointmentHistory.length}</div>
                <div className="text-sm text-gray-600">Total Visits</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  ₹{customerDetails.appointmentHistory.reduce((sum: number, apt: any) => sum + apt.totalAmount, 0).toFixed(0)}
                </div>
                <div className="text-sm text-gray-600">Total Spent</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">{customerDetails.loyaltyPoints || 0}</div>
                <div className="text-sm text-gray-600">Loyalty Points</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${customerDetails.isMember ? 'text-green-600' : 'text-gray-400'}`}>
                  {customerDetails.isMember ? 'YES' : 'NO'}
                </div>
                <div className="text-sm text-gray-600">Member</div>
              </div>
            </div>

            {/* Appointment History */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Complete Appointment History</h3>
              {customerDetails.appointmentHistory.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No appointment history found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Services</th>
                        <th className="px-4 py-3 text-left">Stylist</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerDetails.appointmentHistory.map((apt: any) => (
                        <tr key={apt._id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {new Date(apt.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(apt.date).toLocaleDateString('en-US', {
                                weekday: 'short'
                              })}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="max-w-xs">
                              {apt.services.length > 0 ? (
                                <div className="space-y-1">
                                  {apt.services.slice(0, 2).map((service: string, idx: number) => (
                                    <div key={idx} className="text-sm">{service}</div>
                                  ))}
                                  {apt.services.length > 2 && (
                                    <div className="text-xs text-gray-500">
                                      +{apt.services.length - 2} more
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">N/A</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">{apt.stylistName}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(apt.status)}`}>
                              {apt.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="font-semibold">₹{apt.totalAmount.toFixed(2)}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No customer history found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default function EditAppointmentForm({
  isOpen,
  onClose,
  appointment,
  onUpdateAppointment
}: EditAppointmentFormProps) {
  const [formData, setFormData] = useState({
    serviceIds: [] as string[],
    stylistId: '',
    date: '',
    time: '',
    notes: '',
    status: 'Appointment'
  });
  
  const [allServices, setAllServices] = useState<ServiceFromAPI[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceFromAPI[]>([]);
  const [availableStylists, setAvailableStylists] = useState<StylistFromAPI[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMembershipOption, setShowMembershipOption] = useState(false);
  
  // === ADD CUSTOMER HISTORY STATE ===
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);

  // Initialize form with appointment data
  useEffect(() => {
    if (isOpen && appointment) {
      setFormData({
        serviceIds: appointment.serviceIds?.map(s => s._id) || [],
        stylistId: appointment.stylistId?._id || '',
        date: appointment.date.split('T')[0],
        time: appointment.time,
        notes: appointment.notes || '',
        status: appointment.status
      });
      
      setSelectedServices(appointment.serviceIds || []);
      setShowMembershipOption(!appointment.customerId?.isMembership);
      setShowCustomerHistory(false); // Reset history modal state
      fetchData();
    }
  }, [isOpen, appointment]);

  const fetchData = async () => {
    try {
      const [servicesRes, stylistsRes] = await Promise.all([
        fetch('/api/service-items'),
        fetch('/api/stylists')
      ]);
      
      const servicesData = await servicesRes.json();
      const stylistsData = await stylistsRes.json();
      
      if (servicesData.success) setAllServices(servicesData.services);
      if (stylistsData.success) setAvailableStylists(stylistsData.data);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  };

  const handleAddService = (serviceId: string) => {
    const service = allServices.find(s => s._id === serviceId);
    if (service && !selectedServices.some(s => s._id === serviceId)) {
      const newSelected = [...selectedServices, service];
      setSelectedServices(newSelected);
      setFormData(prev => ({
        ...prev,
        serviceIds: newSelected.map(s => s._id)
      }));
    }
  };

  const handleRemoveService = (serviceId: string) => {
    const newSelected = selectedServices.filter(s => s._id !== serviceId);
    setSelectedServices(newSelected);
    setFormData(prev => ({
      ...prev,
      serviceIds: newSelected.map(s => s._id)
    }));
  };

  const handleGrantMembership = async () => {
    if (!appointment?.customerId?._id) return;

    try {
      const response = await fetch(`/api/customer/${appointment.customerId._id}/toggle-membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMembership: true })
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Membership granted successfully!');
        setShowMembershipOption(false);
        // Update appointment customer data
        if (appointment.customerId) {
          appointment.customerId.isMembership = true;
        }
      }
    } catch (err) {
      console.error('Failed to grant membership:', err);
      toast.error('Failed to grant membership');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await onUpdateAppointment(appointment!.id, formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update appointment');
    } finally {
      setIsLoading(false);
    }
  };

  const getAvailableStatuses = () => {
    const current = appointment?.status || 'Appointment';
    
    // Define possible transitions
    switch (current) {
      case 'Appointment':
        return [
          { value: 'Appointment', label: 'Appointment' },
          { value: 'Checked-In', label: 'Check-In (Start Service)' },
          { value: 'Cancelled', label: 'Cancel' },
          { value: 'No-Show', label: 'No-Show' }
        ];
      case 'Checked-In':
        return [
          { value: 'Checked-In', label: 'Checked-In (In Service)' },
          { value: 'Checked-Out', label: 'Check-Out (Complete Service)' },
          { value: 'Cancelled', label: 'Cancel' }
        ];
      case 'Checked-Out':
        return [
          { value: 'Checked-Out', label: 'Checked-Out (Ready for Payment)' },
          { value: 'Paid', label: 'Mark as Paid' }
        ];
      case 'Paid':
        return [{ value: 'Paid', label: 'Paid' }];
      case 'Cancelled':
        return [
          { value: 'Cancelled', label: 'Cancelled' },
          { value: 'Appointment', label: 'Reactivate' }
        ];
      case 'No-Show':
        return [
          { value: 'No-Show', label: 'No-Show' },
          { value: 'Appointment', label: 'Reschedule' }
        ];
      default:
        return [{ value: current, label: current }];
    }
  };

  if (!isOpen || !appointment) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6 pb-4 border-b">
            <h2 className="text-2xl font-bold">Edit Appointment</h2>
            <button onClick={onClose}>
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* === ENHANCED CUSTOMER INFO WITH HISTORY BUTTON === */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Customer Information</h3>
                {/* === HISTORY BUTTON === */}
                {appointment.customerId?.phoneNumber && (
                  <button
                    type="button"
                    onClick={() => setShowCustomerHistory(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                  >
                    <EyeIcon className="w-4 h-4" />
                    View History
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <strong>Name:</strong> {appointment.customerId?.name}
                </div>
                <div>
                  <strong>Phone:</strong> {appointment.customerId?.phoneNumber}
                </div>
                <div>
                  <strong>Type:</strong> 
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    appointment.appointmentType === 'Online' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {appointment.appointmentType}
                  </span>
                </div>
              </div>

              {/* Membership Status & Grant Option */}
              <div className="mt-4 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <strong className="text-sm">Membership:</strong>
                    {appointment.customerId?.isMembership ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-semibold">
                        Active Member
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-semibold">
                        Not a Member
                      </span>
                    )}
                  </div>
                  
                  {showMembershipOption && (
                    <button
                      type="button"
                      onClick={handleGrantMembership}
                      className="px-3 py-1.5 bg-yellow-600 text-white text-xs font-medium rounded-md hover:bg-yellow-700 flex items-center gap-1"
                    >
                      <UserPlusIcon className="w-4 h-4" />
                      Grant Membership
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {getAvailableStatuses().map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              
              {/* Status Change Warnings */}
              {formData.status !== appointment.status && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  {formData.status === 'Checked-In' && (
                    <p className="text-yellow-800">⚠️ Checking in will lock the stylist until service is completed.</p>
                  )}
                  {formData.status === 'Checked-Out' && (
                    <p className="text-green-800">✅ Checking out will unlock the stylist and open billing.</p>
                  )}
                  {formData.status === 'Cancelled' && (
                    <p className="text-red-800">❌ Cancelling will unlock the stylist and end the appointment.</p>
                  )}
                </div>
              )}
            </div>

            {/* Services */}
            <div>
              <label className="block text-sm font-medium mb-2">Services</label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddService(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              >
                <option value="">Add a service...</option>
                {allServices.map(service => (
                  <option 
                    key={service._id} 
                    value={service._id}
                    disabled={selectedServices.some(s => s._id === service._id)}
                  >
                    {service.name} - ₹{service.price}
                    {service.membershipRate && ` (Member: ₹${service.membershipRate})`}
                  </option>
                ))}
              </select>

              <div className="space-y-2">
                {selectedServices.map(service => {
                  const showMembershipPrice = appointment.customerId?.isMembership && service.membershipRate;
                  return (
                    <div key={service._id} className="flex items-center justify-between bg-gray-100 p-3 rounded-md">
                      <div>
                        <span className="font-medium">{service.name}</span>
                        <div className="text-sm text-gray-600">
                          {showMembershipPrice ? (
                            <>
                              <span className="line-through">₹{service.price}</span>
                              <span className="ml-2 text-green-600 font-semibold">₹{service.membershipRate}</span>
                              <span className="ml-2 text-xs bg-green-100 text-green-700 px-1 rounded">Member Price</span>
                            </>
                          ) : (
                            <span>₹{service.price}</span>
                          )}
                          <span className="ml-3 text-gray-500">({service.duration} min)</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(service._id)}
                        className="text-red-500 hover:text-red-700 text-sm px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stylist */}
            <div>
              <label className="block text-sm font-medium mb-2">Stylist</label>
              <select
                value={formData.stylistId}
                onChange={(e) => setFormData(prev => ({ ...prev, stylistId: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a stylist</option>
                {availableStylists.map(stylist => (
                  <option key={stylist._id} value={stylist._id}>
                    {stylist.name} {!stylist.isAvailable && '(Currently Busy)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Time</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Add any notes about the appointment..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? 'Updating...' : 'Update Appointment'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* === CUSTOMER HISTORY MODAL === */}
      <CustomerHistoryModal
        isOpen={showCustomerHistory}
        onClose={() => setShowCustomerHistory(false)}
        customer={appointment?.customerId}
      />
    </>
  );
}