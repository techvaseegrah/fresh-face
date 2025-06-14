'use client';

import React, { useState, useEffect, useCallback } from 'react';
import BookAppointmentForm, { NewBookingData } from './BookAppointmentForm';
import BillingModal from '../appointment/billingmodal';
import { CalendarIcon, ClockIcon, UserGroupIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

// ===================================================================================
//  INTERFACES
// ===================================================================================
interface CustomerFromAPI { _id: string; id: string; name: string; phoneNumber?: string; }
interface StylistFromAPI { 
    _id: string; 
    id: string; 
    // This is the new, nested structure
    staffInfo: {
        name: string;
        image?: string;
    };
}
interface AppointmentWithCustomer {
  _id: string; id: string;
  customerId: CustomerFromAPI;
  stylistId: StylistFromAPI;
  style: string; date: string; time: string; notes?: string;
  status: 'Scheduled' | 'Checked-In' | 'Billed' | 'Paid' | 'Cancelled' | 'No-Show' | string;
  serviceIds?: Array<{ _id: string, name: string, price: number }>;
}

// --- Helper Functions ---
const formatDate = (dateString: any): string => { try { return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); } catch { return 'N/A'; }};
const formatTime = (timeString: any): string => { try { const [h, m] = timeString.split(':').map(Number); const ampm = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 || 12; return `${h12}:${String(m).padStart(2, '0')} ${ampm}`; } catch { return 'N/A'; }};

// --- StatCard Component ---
const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; }> = ({ title, value, icon }) => (
    <div className="bg-white p-5 rounded-xl shadow-sm"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-500 truncate">{title}</p><p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p></div><div className="flex-shrink-0 h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">{icon}</div></div></div>
);

// ===================================================================================
//  MAIN PAGE COMPONENT
// ===================================================================================
export default function AppointmentPage() {
  const [allAppointments, setAllAppointments] = useState<AppointmentWithCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isBookAppointmentModalOpen, setIsBookAppointmentModalOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [selectedAppointmentForBilling, setSelectedAppointmentForBilling] = useState<AppointmentWithCustomer | null>(null);
  const [customerForBilling, setCustomerForBilling] = useState<CustomerFromAPI | null>(null);
  const [stylistForBilling, setStylistForBilling] = useState<StylistFromAPI | null>(null);

  // State for Filtering and Pagination
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAppointmentsCount, setTotalAppointmentsCount] = useState(0);

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: currentPage.toString(),
        limit: '10',
        search: searchTerm,
      });
      const res = await fetch(`/api/appointment?${params.toString()}`);
      const data = await res.json();
      console.log("RAW DATA FROM API:", data.appointments); 
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
        // When search term changes, always go back to page 1
        if (currentPage !== 1 && searchTerm !== '') {
            setCurrentPage(1);
        } else {
            fetchAppointments();
        }
    }, 300); // Debounce search to avoid excessive API calls
    return () => clearTimeout(handler);
  }, [searchTerm, fetchAppointments, currentPage]);

  useEffect(() => {
    fetchAppointments();
  }, [currentPage, statusFilter]); // Re-fetch when page or filter changes


  // --- API ACTION HANDLERS ---
  const handleAppointmentAction = async (appointmentId: string, action: 'check-in' | 'cancel' | 'pay', successMessage: string, payload: any = {} ) => {
    if (action === 'cancel' && !confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      const response = await fetch(`/api/appointment/${appointmentId}/${action}`, { method: 'POST', ...(Object.keys(payload).length > 0 && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || `Failed to ${action}`);
      toast.success(successMessage);
      fetchAppointments();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleFinalizeBill = async (appointmentId: string, finalTotal: number, billDetails: any) => {
    try {
      const response = await fetch(`/api/billing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appointmentId, customerId: customerForBilling?._id, stylistId: stylistForBilling?._id, items: billDetails.items, grandTotal: finalTotal, paymentMethod: billDetails.paymentMethod, notes: billDetails.notes, purchasedMembershipPlanId: billDetails.purchasedMembershipPlanId, }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to create invoice.');
      toast.success(`Invoice created!`);
      handleCloseBillingModal();
    } catch (err: any) {
      toast.error(err.message);
      throw err;
    }
  };
  
  const handleBookNewAppointment = async (bookingData: NewBookingData) => {
    try {
      const response = await fetch('/api/appointment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bookingData), });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to book appointment.');
      toast.success('Appointment successfully booked!');
      setIsBookAppointmentModalOpen(false);
      fetchAppointments();
    } catch (err: any) { toast.error(err.message); }
  };

  // --- MODAL AND FILTER HANDLERS ---
  const handleOpenBillingModal = (appointment: AppointmentWithCustomer) => {
    if (appointment.customerId && appointment.stylistId) {
      setSelectedAppointmentForBilling(appointment); setCustomerForBilling(appointment.customerId); setStylistForBilling(appointment.stylistId); setIsBillingModalOpen(true);
    } else { toast.error(`Customer or Stylist details are missing.`); }
  };
  const handleCloseBillingModal = () => { setIsBillingModalOpen(false); setSelectedAppointmentForBilling(null); setCustomerForBilling(null); setStylistForBilling(null); fetchAppointments(); };
  
  const handleFilterChange = (newStatus: string) => {
    setCurrentPage(1);
    setStatusFilter(newStatus);
  };
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <div className="min-h-screen bg-gray-50/30 p-4 md:p-8">
      <div className="flex justify-between items-center mb-8"><h1 className="text-3xl font-bold">Appointments</h1><button onClick={() => setIsBookAppointmentModalOpen(true)} className="px-4 py-2.5 bg-black text-white rounded-lg flex items-center gap-2"><PlusIcon className="h-5 w-5"/><span>Book Appointment</span></button></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Today's Bookings" value={isLoading ? "..." : allAppointments.filter(apt => apt.date && apt.date.startsWith(new Date().toISOString().split('T')[0])).length.toString()} icon={<CalendarIcon className="h-6 w-6"/>} />
        <StatCard title="Upcoming" value={isLoading ? "..." : allAppointments.filter(apt => apt.date && new Date(apt.date) >= new Date() && apt.status === 'Scheduled').length.toString()} icon={<ClockIcon className="h-6 w-6"/>} />
        <StatCard title="Total Appointments" value={isLoading ? "..." : totalAppointmentsCount.toString()} icon={<UserGroupIcon className="h-6 w-6"/>} />
      </div>

      <div className="mb-6 flex flex-col md:flex-row items-center gap-4">
        <div className="flex-grow w-full"><input type="text" placeholder="Search by client or stylist..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"/></div>
        <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
          {['All', 'Scheduled', 'Checked-In', 'Paid', 'Cancelled'].map(status => (<button key={status} onClick={() => handleFilterChange(status)} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${ statusFilter === status ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>{status}</button>))}
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading && <div className="p-10 text-center text-gray-500">Loading appointments...</div>}
        {!isLoading && allAppointments.length === 0 && (<div className="p-10 text-center text-gray-500">{searchTerm || statusFilter !== 'All' ? 'No appointments match criteria.' : 'No appointments scheduled.'}</div>)}
        {!isLoading && allAppointments.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50"><tr><th className="px-6 py-3">Client</th><th className="px-6 py-3">Service(s)</th><th className="px-6 py-3">Stylist</th><th className="px-6 py-3">Date & Time</th><th className="px-6 py-3">Status</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
              <tbody>
                {allAppointments.map((appointment) => {
                  const customerName = appointment.customerId?.name || 'N/A';
                  const customerPhone = appointment.customerId?.phoneNumber || 'N/A';
                  const stylistName = appointment.stylistId?.staffInfo?.name || 'N/A';
                  const serviceNames = Array.isArray(appointment.serviceIds) && appointment.serviceIds.length > 0 ? appointment.serviceIds.map(s => s.name).join(', ') : (appointment.style || 'N/A');
                  return (
                    <tr key={appointment.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap"><div>{customerName}</div><div className="text-xs text-gray-500 font-normal">{customerPhone}</div></td>
                      <td className="px-6 py-4">{serviceNames}</td>
                      <td className="px-6 py-4">{stylistName}</td>
                      <td className="px-6 py-4">{formatDate(appointment.date)} at {formatTime(appointment.time)}</td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${ appointment.status === 'Scheduled' ? 'bg-blue-100 text-blue-800' : appointment.status === 'Checked-In' ? 'bg-yellow-100 text-yellow-800' : appointment.status === 'Billed' ? 'bg-purple-100 text-purple-800' : appointment.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' }`}>{appointment.status}</span></td>
                      <td className="px-6 py-4 text-right"><div className="flex items-center justify-end space-x-2">{appointment.status === 'Scheduled' && (<button onClick={() => handleAppointmentAction(appointment.id, 'check-in', 'Customer Checked In!')} className="px-3 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full hover:bg-yellow-200">Check-In</button>)}{appointment.status === 'Checked-In' && (<button onClick={() => handleOpenBillingModal(appointment)} className="px-3 py-1 text-xs font-semibold text-indigo-800 bg-indigo-100 rounded-full hover:bg-indigo-200">Bill</button>)}{ (appointment.status === 'Scheduled' || appointment.status === 'Checked-In') && (<button onClick={() => handleAppointmentAction(appointment.id, 'cancel', 'Appointment has been cancelled.')} className="px-3 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full hover:bg-red-200">Cancel</button>)}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {totalPages > 1 && (<div className="px-6 py-4 border-t flex items-center justify-center space-x-2 text-sm"><button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1 || isLoading} className="px-3 py-1 border rounded-md disabled:opacity-50 flex items-center"><ChevronLeftIcon className="h-4 w-4 mr-1"/>Previous</button><span>Page <b>{currentPage}</b> of <b>{totalPages}</b></span><button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages || isLoading} className="px-3 py-1 border rounded-md disabled:opacity-50 flex items-center">Next<ChevronRightIcon className="h-4 w-4 ml-1"/></button></div>)}
      
      <BookAppointmentForm isOpen={isBookAppointmentModalOpen} onClose={() => setIsBookAppointmentModalOpen(false)} onBookAppointment={handleBookNewAppointment} />
      {selectedAppointmentForBilling && customerForBilling && stylistForBilling && isBillingModalOpen && (<BillingModal isOpen={isBillingModalOpen} onClose={handleCloseBillingModal} appointment={selectedAppointmentForBilling} customer={customerForBilling} stylist={stylistForBilling} onFinalizeAndPay={handleFinalizeBill} />)}
    </div>
  );
}