// app/appointment/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import BookAppointmentForm, { NewBookingData } from './BookAppointmentForm';
import BillingModal from './billingmodal';
import {
  CalendarIcon,
  ClockIcon,
  UserGroupIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import EditAppointmentForm from '@/components/EditAppointmentForm';

// ===================================================================================
//  INTERFACES
// ===================================================================================
interface CustomerFromAPI {
  _id: string;
  id: string;
  name: string;
  phoneNumber?: string;
  isMembership?: boolean;
}

interface StylistFromAPI {
  _id: string;
  id: string;
  name: string;
  isAvailable?: boolean;
}

interface AppointmentWithCustomer {
  _id: string;
  id: string;
  customerId: CustomerFromAPI;
  stylistId: StylistFromAPI;
  date: string;
  time: string;
  notes?: string;
  status: 'Appointment' | 'Checked-In' | 'Checked-Out' | 'Paid' | 'Cancelled' | 'No-Show';
  appointmentType: 'Online' | 'Offline';
  serviceIds?: Array<{ _id: string; name: string; price: number; membershipRate?: number }>;
  amount?: number;
  estimatedDuration?: number;
  actualDuration?: number;
}

// --- Helper Functions ---
const formatDate = (dateString: any): string => {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
  } catch {
    return 'N/A';
  }
};

const formatTime = (timeString: any): string => {
  try {
    const [h, m] = timeString.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  } catch {
    return 'N/A';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Appointment':
      return 'bg-blue-100 text-blue-800';
    case 'Checked-In':
      return 'bg-yellow-100 text-yellow-800';
    case 'Checked-Out':
      return 'bg-purple-100 text-purple-800';
    case 'Paid':
      return 'bg-green-100 text-green-800';
    case 'Cancelled':
    case 'No-Show':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// ===================================================================================
//  MAIN PAGE COMPONENT
// ===================================================================================
export default function AppointmentPage() {
  const [allAppointments, setAllAppointments] = useState<AppointmentWithCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [isBookAppointmentModalOpen, setIsBookAppointmentModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);

  // Selected appointment states
  const [selectedAppointmentForEdit, setSelectedAppointmentForEdit] = useState<AppointmentWithCustomer | null>(null);
  const [selectedAppointmentForBilling, setSelectedAppointmentForBilling] = useState<AppointmentWithCustomer | null>(null);

  // Filtering and pagination
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAppointmentsCount, setTotalAppointmentsCount] = useState(0);

  console.log(allAppointments);
  

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: currentPage.toString(),
        limit: '10',
        search: searchTerm
      });
      const res = await fetch(`/api/appointment?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to fetch appointments');

      setAllAppointments(data.appointments);
      setTotalPages(data.pagination.totalPages);
      setCurrentPage(data.pagination.currentPage);
      setTotalAppointmentsCount(data.pagination.totalAppointments);
    } catch (err: any) {
      toast.error(err.message);
      setAllAppointments([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, currentPage, searchTerm]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (currentPage !== 1 && searchTerm !== '') {
        setCurrentPage(1);
      } else {
        fetchAppointments();
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm, fetchAppointments, currentPage]);

  useEffect(() => {
    fetchAppointments();
  }, [currentPage, statusFilter]);

  // === HANDLERS ===
  const handleBookNewAppointment = async (bookingData: NewBookingData) => {
    try {
      const response = await fetch('/api/appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to book appointment.');

      toast.success('Appointment successfully booked!');
      setIsBookAppointmentModalOpen(false);
      fetchAppointments();
    } catch (err: any) {
      toast.error(err.message);
      throw err;
    }
  };

  const handleEditAppointment = (appointment: AppointmentWithCustomer) => {
    setSelectedAppointmentForEdit(appointment);
    setIsEditModalOpen(true);
  };

  const handleUpdateAppointment = async (appointmentId: string, updateData: any) => {
    try {
      const response = await fetch(`/api/appointment/${appointmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message);

      toast.success('Appointment updated successfully!');
      setIsEditModalOpen(false);
      setSelectedAppointmentForEdit(null);

      console.log('Appointment updated:', result.appointment);
      

      // If status changed to Checked-Out, open billing modal
      if (updateData.status === 'Checked-Out') {
        setSelectedAppointmentForBilling(result.appointment);
        setIsBillingModalOpen(true);
      } else {
        fetchAppointments();
      }
    } catch (err: any) {
      toast.error(err.message);
      throw err;
    }
  };

  const handleFinalizeBill = async (appointmentId: string, finalTotal: number, billDetails: any) => {
    try {
      const response = await fetch(`/api/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          customerId: selectedAppointmentForBilling?.customerId._id,
          stylistId: selectedAppointmentForBilling?.stylistId._id,
          items: billDetails.items,
          grandTotal: finalTotal,
          paymentMethod: billDetails.paymentMethod,
          notes: billDetails.notes,
          membershipPurchase: billDetails.membershipPurchase
        })
      });

      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to create invoice.');

      toast.success('Payment completed successfully!');
      handleCloseBillingModal();
    } catch (err: any) {
      toast.error(err.message);
      throw err;
    }
  };

  const handleCloseBillingModal = () => {
    setIsBillingModalOpen(false);
    setSelectedAppointmentForBilling(null);
    fetchAppointments();
  };

  const handleFilterChange = (newStatus: string) => {
    setCurrentPage(1);
    setStatusFilter(newStatus);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <div className="min-h-screen bg-gray-50/30 p-4 md:p-0">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Appointments</h1>
        <button
          onClick={() => setIsBookAppointmentModalOpen(true)}
          className="px-4 py-2.5 bg-black text-white rounded-lg flex items-center gap-2 hover:bg-gray-800"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Book Appointment</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col md:flex-row items-center gap-4">
        <div className="flex-grow w-full">
          <input
            type="text"
            placeholder="Search by client or stylist..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
        <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
          {['All', 'Appointment', 'Checked-In', 'Checked-Out', 'Paid', 'Cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => handleFilterChange(status)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${statusFilter === status
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-600 hover:bg-gray-200'
                }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Appointments Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading && (
          <div className="p-10 text-center text-gray-500">
            Loading appointments...
          </div>
        )}

        {!isLoading && allAppointments.length === 0 && (
          <div className="p-10 text-center text-gray-500">
            {searchTerm || statusFilter !== 'All'
              ? 'No appointments match criteria.'
              : 'No appointments scheduled.'}
          </div>
        )}

        {!isLoading && allAppointments.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-6 py-3">Client</th>
                  <th className="px-6 py-3">Service(s)</th>
                  <th className="px-6 py-3">Stylist</th>
                  <th className="px-6 py-3">Date & Time</th>
                                    <th className="px-6 py-3">Appointment Time</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Amount</th> {/* NEW COLUMN */}

                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allAppointments.map((appointment) => {
                  const customerName = appointment.customerId?.name || 'N/A';
                  const customerPhone = appointment.customerId?.phoneNumber || 'N/A';
                  const stylistName = appointment.stylistId?.name || 'N/A';
                  const serviceNames = Array.isArray(appointment.serviceIds) && appointment.serviceIds.length > 0
                    ? appointment.serviceIds.map((s) => s.name).join(', ')
                    : 'N/A';

                  return (
                    <tr key={appointment.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                        <div>{customerName}</div>
                        <div className="text-xs text-gray-500 font-normal">{customerPhone}</div>
                        {appointment.customerId?.isMembership && (
                          <div className="text-xs text-yellow-600 font-semibold">Member</div>
                        )}
                      </td>
                      <td className="px-6 py-4">{serviceNames}</td>
                      <td className="px-6 py-4">
                        <div>{stylistName}</div>
                        {/* {!appointment.stylistId?.isAvailable && appointment.status === 'Checked-In' && (
                          <div className="text-xs text-red-500">🔒 Busy</div>
                        )} */}
                      </td>
                      <td className="px-6 py-4">
                        <div>{formatDate(appointment.date)}</div>
                        <div className="text-xs text-gray-500">{formatTime(appointment.time)}</div>
                      </td>
                      {
                         appointment?.status=="Appointment"?<td className="px-6 py-4">
                        <div>{formatDate(appointment.appointmentTime)}</div>
                        <div className="text-xs text-gray-500">{formatTime(appointment.appointmentTime)}</div>
                      </td>:<td className="px-6 py-4">
                       -
                      </td>
                      }
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${appointment.appointmentType === 'Online'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-orange-100 text-orange-800'
                          }`}>
                          {appointment.appointmentType}
                        </span>
                      </td>
                      <td className="px-2  py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(appointment.status)}`}>
                          {appointment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {appointment.finalAmount ? (
                          <div>
                            <div className="font-semibold text-green-600">₹{appointment.finalAmount.toFixed(2)}</div>
                            {appointment.membershipDiscount > 0 && (
                              <div className="text-xs text-green-500">
                                Saved ₹{appointment.membershipDiscount.toFixed(2)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {/* Edit Button - Always available */}
                          <button
                            onClick={() => handleEditAppointment(appointment)}
                            className="px-3 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full hover:bg-blue-200 flex items-center gap-1"
                          >
                            <PencilIcon className="w-3 h-3" />
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t flex items-center justify-center space-x-2 text-sm">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
            className="px-3 py-1 border rounded-md disabled:opacity-50 flex items-center"
          >
            <ChevronLeftIcon className="h-4 w-4 mr-1" />
            Previous
          </button>
          <span>
            Page <b>{currentPage}</b> of <b>{totalPages}</b>
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
            className="px-3 py-1 border rounded-md disabled:opacity-50 flex items-center"
          >
            Next
            <ChevronRightIcon className="h-4 w-4 ml-1" />
          </button>
        </div>
      )}

      {/* Modals */}
      <BookAppointmentForm
        isOpen={isBookAppointmentModalOpen}
        onClose={() => setIsBookAppointmentModalOpen(false)}
        onBookAppointment={handleBookNewAppointment}
      />

      <EditAppointmentForm
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedAppointmentForEdit(null);
        }}
        appointment={selectedAppointmentForEdit}
        onUpdateAppointment={handleUpdateAppointment}
      />

      {selectedAppointmentForBilling && isBillingModalOpen && (
        <BillingModal
          isOpen={isBillingModalOpen}
          onClose={handleCloseBillingModal}
          appointment={selectedAppointmentForBilling}
          customer={selectedAppointmentForBilling.customerId}
          stylist={selectedAppointmentForBilling.stylistId}
          onFinalizeAndPay={handleFinalizeBill}
        />
      )}
    </div>
  );
}