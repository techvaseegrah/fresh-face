'use client';

import React, { useState, useEffect, useCallback, FC } from 'react';
import { createPortal } from 'react-dom';
import {
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  Cog6ToothIcon,
  ClockIcon,
  PrinterIcon, 
} from '@heroicons/react/24/outline';
import BookAppointmentForm from './components/BookAppointmentForm';
import { NewBookingData } from './components/BookAppointmentForm/types';
import BillingModal from './billingmodal';
import { FinalizeBillingPayload, FinalizedInvoice } from './components/billing/billing.types';
import { toast } from 'react-toastify';
import EditAppointmentForm from '@/components/EditAppointmentForm';
import { useSession, getSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { formatDateIST, formatTimeIST } from '@/lib/dateFormatter';
import { formatDuration } from '@/lib/utils';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import Receipt from '@/components/Receipt';

// --- TYPE DEFINITIONS ---
interface BusinessDetails {
  name: string;
  address: string;
  phone: string;
  gstin?: string;
}

interface AppointmentWithCustomer {
  _id: string;
  id: string;
  customerId: any; 
  stylistId: any;
  appointmentDateTime: string;
  createdAt: string;
  notes?: string;
  status: 'Appointment' | 'Waiting for Service'|'Checked-In' | 'Checked-Out' | 'Paid' | 'Cancelled' | 'No-Show';
  appointmentType: 'Online' | 'Offline';
  serviceIds?: Array<{ _id: string; name: string; price: number; membershipRate?: number; duration: number; }>;
  productIds?: Array<{ _id: string; name: string; price: number; membershipRate?: number; }>;
  amount?: number;
  estimatedDuration?: number;
  actualDuration?: number;
  billingStaffId?: any;
  paymentDetails?: Record<string, number>;
  finalAmount?: number;
  membershipDiscount?: number;
  invoiceId?: {
    _id: string;
    invoiceNumber: string;
  } | null;
  redeemedItems?: {
    customerPackageId: string;
    redeemedItemId: string;
    redeemedItemType: 'service' | 'product';
  }[];
  isLocked: boolean;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Appointment': return 'bg-blue-100 text-blue-800';
    case 'Waiting for Service': return 'bg-teal-100 text-teal-800';
    case 'Checked-In': return 'bg-yellow-100 text-yellow-800';
    case 'Checked-Out': return 'bg-purple-100 text-purple-800';
    case 'Paid': return 'bg-green-100 text-green-800';
    case 'Cancelled': case 'No-Show': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const AppointmentCard: FC<{ 
  appointment: AppointmentWithCustomer; 
  onEdit: (appt: AppointmentWithCustomer) => void; 
  canUpdate: boolean;
  onReprint: (invoiceId: string) => void;
}> = ({ appointment, onEdit, canUpdate, onReprint }) => {
    const customerName = appointment.customerId?.name || 'N/A';
    const customerPhone = appointment.customerId?.phoneNumber || 'N/A';
    const stylistName = appointment.stylistId?.name || 'N/A';
    const serviceNames = appointment.serviceIds?.map(s => s.name) || [];
    const productNames = appointment.productIds?.map(p => p.name) || [];
    const allItems = [...serviceNames, ...productNames];
    const allItemsDisplay = allItems.length > 0 ? allItems.join(', ') : 'N/A';
    const isActionable = !['Cancelled', 'No-Show'].includes(appointment.status);
    const isPaid = appointment.status === 'Paid';

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-gray-800">{customerName}</p>
                    <p className="text-sm text-gray-500">{customerPhone}</p>
                    <div className="mt-1">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(appointment.status)}`}>{appointment.status}</span>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-semibold">{formatDateIST(appointment.appointmentDateTime)}</p>
                    <p className="text-sm text-gray-500">{formatTimeIST(appointment.appointmentDateTime)}</p>
                </div>
            </div>
            <div className="border-t border-b border-gray-200 py-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Items:</span> <span className="font-semibold text-right">{allItemsDisplay}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Stylist:</span> <span className="font-semibold">{stylistName}</span></div>
                {appointment.finalAmount != null && <div className="flex justify-between"><span className="text-gray-500">Amount:</span> <span className="font-bold text-green-600">₹{appointment.finalAmount.toFixed(2)}</span></div>}
            </div>
            <div className="flex justify-end items-center gap-2">
                {isActionable && canUpdate ? (
                    isPaid ? (
                        <>
                          {appointment.invoiceId && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onReprint(appointment.invoiceId!._id); }}
                              className="p-2 text-gray-600 hover:text-black rounded-full hover:bg-gray-100 transition-colors"
                              aria-label="Reprint Bill"
                            >
                               <PrinterIcon className="w-5 h-5" />
                            </button>
                          )}
                          <button 
                            onClick={() => onEdit(appointment)} 
                            disabled={appointment.isLocked}
                            className="px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 text-orange-800 bg-orange-100 hover:bg-orange-200 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
                          >
                            <Cog6ToothIcon className="w-4 h-4" />
                            <span>Correct Bill</span>
                          </button>
                        </>
                    ) : (
                        <button onClick={() => onEdit(appointment)} className="px-3 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full hover:bg-blue-200 flex items-center gap-1"><PencilIcon className="w-3 h-3" /> Edit</button>
                    )
                ) : (
                    !isActionable && <span className="px-3 py-1 text-xs text-gray-500">No Actions</span>
                )}
            </div>
        </div>
    );
};


export default function AppointmentPage() {
  const { data: session } = useSession();
  const [allAppointments, setAllAppointments] = useState<AppointmentWithCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isBookAppointmentModalOpen, setIsBookAppointmentModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [selectedAppointmentForEdit, setSelectedAppointmentForEdit] = useState<AppointmentWithCustomer | null>(null);
  const [selectedAppointmentForBilling, setSelectedAppointmentForBilling] = useState<AppointmentWithCustomer | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAppointmentsCount, setTotalAppointmentsCount] = useState(0);
  const [isDesktop, setIsDesktop] = useState(true);
  const [businessDetails, setBusinessDetails] = useState<BusinessDetails | null>(null);
  const [invoiceForPrint, setInvoiceForPrint] = useState<FinalizedInvoice | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const checkScreenSize = () => { setIsDesktop(window.innerWidth >= 1024); };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const tenantFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const session = await getSession();
    if (!session?.user?.tenantId) { throw new Error("Your session is invalid or has expired. Please log in again."); }
    const headers = { ...options.headers, 'x-tenant-id': session.user.tenantId };
    if (options.body) { (headers as any)['Content-Type'] = 'application/json'; }
    return fetch(url, { ...options, headers });
  }, []);

  useEffect(() => {
    const fetchBusinessDetails = async () => {
      try {
        const res = await tenantFetch('/api/settings/business-details');
        if (!res.ok) throw new Error('Failed to fetch business details');
        const data = await res.json();
        setBusinessDetails(data.details);
      } catch (error) {
        console.error("Could not load business details for printing:", error);
        toast.warn("Could not load business details. Printing may not be available.");
      }
    };
    fetchBusinessDetails();
  }, [tenantFetch]);


  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter, page: currentPage.toString(), limit: '10', search: searchTerm });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const res = await tenantFetch(`/api/appointment?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch appointments');
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
  }, [statusFilter, currentPage, searchTerm, startDate, endDate, tenantFetch]);

  useEffect(() => {
    const handler = setTimeout(() => { fetchAppointments(); }, 300);
    return () => clearTimeout(handler);
  }, [fetchAppointments]);

  useEffect(() => { if (currentPage !== 1) { setCurrentPage(1); } }, [searchTerm, statusFilter, startDate, endDate]);

  const handleBookNewAppointment = async (bookingData: NewBookingData) => {
      try {
        const response = await tenantFetch('/api/appointment', { method: 'POST', body: JSON.stringify(bookingData) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to book appointment.');
        toast.success('Appointment successfully booked!');
        setIsBookAppointmentModalOpen(false);
        fetchAppointments();
      } catch (err: any) { toast.error(err.message); throw err; }
  };
  
  const handleEditAppointment = (appointment: AppointmentWithCustomer) => {
    if (appointment.status === 'Paid') {
      setSelectedAppointmentForBilling(appointment);
      setIsBillingModalOpen(true);
    } else {
      setSelectedAppointmentForEdit(appointment);
      setIsEditModalOpen(true);
    }
  };

  const handleUpdateAppointment = async (appointmentId: string, updateData: any) => {
    try {
      const response = await tenantFetch(`/api/appointment/${appointmentId}`, { method: 'PUT', body: JSON.stringify(updateData) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success('Appointment updated successfully!');
      setIsEditModalOpen(false);
      setSelectedAppointmentForEdit(null);
      if (updateData.status === 'Checked-Out') {
        setSelectedAppointmentForBilling(result.appointment);
        setIsBillingModalOpen(true);
      } else {
        fetchAppointments();
      }
    } catch (err: any) { toast.error(err.message); throw err; }
  };

  const handleFinalizeBill = async (finalPayload: FinalizeBillingPayload) => {
    if (!selectedAppointmentForBilling) { throw new Error("No appointment selected for billing."); }
    const isUpdating = !!selectedAppointmentForBilling.invoiceId;
    const url = isUpdating ? `/api/billing/${selectedAppointmentForBilling.invoiceId?._id}` : '/api/billing';
    const method = isUpdating ? 'PUT' : 'POST';
    try {
      const response = await tenantFetch(url, { method, body: JSON.stringify(finalPayload) });
      const result = await response.json();
      const invoiceData = result.data || result.invoice;
      if (!response.ok || !result.success || !invoiceData) { throw new Error(result.message || (isUpdating ? 'Failed to update invoice.' : 'Failed to create invoice.')); }
      return invoiceData;
    } catch (err: any) { throw err; }
  };

  const handleReprint = async (invoiceId: string) => {
    if (!businessDetails) {
      toast.error("Business details not loaded. Cannot print bill.");
      return;
    }
    toast.info("Preparing bill for printing...");
    try {
      const res = await tenantFetch(`/api/billing/${invoiceId}`);
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch invoice details.');
      }
      setInvoiceForPrint(result.invoice);
    } catch (err: any) {
      toast.error(err.message);
      setInvoiceForPrint(null);
    }
  };
  
  // =================================================================
  // THIS IS THE CRITICAL FIX
  // =================================================================
  useEffect(() => {
    if (invoiceForPrint) {
      // Add a small delay to ensure the portal content renders before printing
      const timer = setTimeout(() => {
        window.print();
        setInvoiceForPrint(null); // Clean up after print dialog is triggered
      }, 100); // 100ms is a safe delay

      // Cleanup function to clear the timeout if the component unmounts
      return () => clearTimeout(timer);
    }
  }, [invoiceForPrint]);


  const handleCloseBillingModal = () => {
    setIsBillingModalOpen(false);
    setSelectedAppointmentForBilling(null);
    fetchAppointments();
  };

  const handleFilterChange = (newStatus: string) => { setStatusFilter(newStatus); };
  const canCreateAppointments = session && (hasPermission(session.user.role.permissions, PERMISSIONS.APPOINTMENTS_MANAGE) || hasPermission(session.user.role.permissions, PERMISSIONS.APPOINTMENTS_CREATE));
  const canUpdateAppointments = session && (hasPermission(session.user.role.permissions, PERMISSIONS.APPOINTMENTS_MANAGE) || hasPermission(session.user.role.permissions, PERMISSIONS.APPOINTMENTS_UPDATE));
  const goToPage = (page: number) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };

  return (
    <>
      <div className="bg-gray-50/50 p-4 sm:p-6">
        {/* Your entire visible page UI is here */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Appointments</h1>
          {canCreateAppointments && (<button onClick={() => setIsBookAppointmentModalOpen(true)} className="w-full sm:w-auto px-4 py-2.5 bg-black text-white rounded-lg flex items-center justify-center gap-2 hover:bg-gray-800"><PlusIcon className="h-5 w-5" /><span>Book Appointment</span></button>)}
        </div>
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex-grow w-full md:flex-1"><input type="text" placeholder="Search by client or stylist..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/50" /></div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto"><div className="flex items-center gap-2"><label htmlFor="startDate" className="text-sm font-medium text-gray-700 shrink-0">From:</label><input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/50 text-sm w-full" /></div><div className="flex items-center gap-2"><label htmlFor="endDate" className="text-sm font-medium text-gray-700 shrink-0">To:</label><input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/50 text-sm w-full" min={startDate} /></div></div>
          <div className="w-full md:w-auto"><div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">{['All', 'Appointment', 'Checked-In', 'Checked-Out', 'Paid', 'Cancelled', 'No-Show'].map((status) => (<button key={status} onClick={() => handleFilterChange(status)} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${statusFilter === status ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>{status}</button>))}</div></div>
        </div>

        <div>
          {isLoading && (<div className="p-10 text-center text-gray-500">Loading appointments...</div>)}
          {!isLoading && allAppointments.length === 0 && (<div className="p-10 text-center text-gray-500">{searchTerm || statusFilter !== 'All' || startDate || endDate ? 'No appointments match criteria.' : 'No appointments scheduled.'}</div>)}
          {!isLoading && allAppointments.length > 0 && (
            isDesktop ? (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
                <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-6 py-3">Appointment Date & Time</th>
                      <th className="px-6 py-3">Client</th>
                      <th className="px-6 py-3">Service(s)</th>
                      <th className="px-6 py-3">Stylist</th>
                      <th className="px-6 py-3">Booking Time</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-2 py-3 text-center">Status</th>
                      <th className="px-6 py-3">Amount</th>
                      <th className="px-6 py-3">Staff</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allAppointments.map((appointment) => {
                      const customerName = appointment.customerId?.name || 'N/A';
                      const customerPhone = appointment.customerId?.phoneNumber || 'N/A';
                      const stylistName = appointment.stylistId?.name || 'N/A';
                      const allItemsDisplay = [...(appointment.serviceIds?.map(s => s.name) || []), ...(appointment.productIds?.map(p => p.name) || [])].join(', ') || 'N/A';
                      const billingStaffName = appointment.billingStaffId?.name || 'N/A';
                      const paymentSummary = appointment.paymentDetails ? Object.entries(appointment.paymentDetails).filter(([_, amount]) => amount > 0).map(([method, amount]) => `${method}: ₹${amount}`).join('<br />') || 'No payment' : '';
                      const isActionable = !['Cancelled', 'No-Show'].includes(appointment.status);
                      const isPaid = appointment.status === 'Paid';
                      return (
                        <tr key={appointment.id} className="bg-white border-b last:border-b-0 hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap"><div>{formatDateIST(appointment.appointmentDateTime)}</div><div className="text-xs text-gray-500">{formatTimeIST(appointment.appointmentDateTime)}</div></td>
                          <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap"><div>{customerName}</div><div className="text-xs text-gray-500 font-normal">{customerPhone}</div>{appointment.customerId?.isMembership && (<div className="text-xs text-yellow-600 font-semibold">Member</div>)}{appointment.invoiceId && ( <div className="mt-1 text-xs text-gray-500 font-mono" > Inv: {appointment.invoiceId.invoiceNumber} </div> )}{(appointment.actualDuration || appointment.estimatedDuration) && ( <div className="mt-1 flex items-center gap-1 text-xs text-gray-500"><ClockIcon className="w-3.5 h-3.5" /><span className={appointment.actualDuration ? 'font-semibold text-gray-700' : ''}>{formatDuration(appointment.actualDuration ?? appointment.estimatedDuration)}</span></div> )}</td>
                          <td className="px-6 py-4">{allItemsDisplay}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{stylistName}</td>
                          <td className="px-6 py-4 whitespace-nowrap"><div>{formatDateIST(appointment.createdAt)}</div><div className="text-xs text-gray-500">{formatTimeIST(appointment.createdAt)}</div></td>
                          <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${appointment.appointmentType === 'Online' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>{appointment.appointmentType}</span></td>
                          <td className="px-2 py-4 text-center"><span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getStatusColor(appointment.status)}`}>{appointment.status}</span></td>
                          <td className="px-6 py-4 whitespace-nowrap">{appointment.finalAmount != null ? (<div className="cursor-help" data-tooltip-id="app-tooltip" data-tooltip-html={`<b>Payment Split</b><br />${paymentSummary}`} data-tooltip-place="top"><div className="font-semibold text-green-600">₹{appointment.finalAmount.toFixed(2)}</div>{(appointment.membershipDiscount ?? 0) > 0 && (<div className="text-xs text-green-500">Saved ₹{appointment.membershipDiscount!.toFixed(2)}</div>)}</div>) : (<span className="text-gray-400">-</span>)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{billingStaffName}</td>
                          <td className="px-6 py-4 text-right"><div className="flex items-center justify-end gap-2">{isActionable && canUpdateAppointments ? (isPaid ? (<> {appointment.invoiceId && (<button onClick={() => handleReprint(appointment.invoiceId!._id)} className="p-1.5 text-gray-500 hover:text-black rounded-full hover:bg-gray-100 transition-colors" data-tooltip-id="app-tooltip" data-tooltip-content="Reprint Bill"><PrinterIcon className="w-4 h-4" /></button>)}<button onClick={() => handleEditAppointment(appointment)} disabled={appointment.isLocked} className="px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 whitespace-nowrap text-orange-800 bg-orange-100 hover:bg-orange-200 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed" data-tooltip-id="app-tooltip" data-tooltip-content={appointment.isLocked ? "Day is closed, bill cannot be corrected." : "Correct this bill"}><Cog6ToothIcon className="w-4 h-4" /> <span>Correct Bill</span></button> </>) : (<button onClick={() => handleEditAppointment(appointment)} className="px-3 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full hover:bg-blue-200 flex items-center gap-1 whitespace-nowrap"><PencilIcon className="w-3 h-3" /> Edit</button>)) : (!isActionable && <span className="px-3 py-1 text-xs text-gray-500 whitespace-nowrap">No Actions</span> )}</div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {allAppointments.map((appointment) => (
                  <AppointmentCard key={appointment.id} appointment={appointment} onEdit={handleEditAppointment} canUpdate={!!canUpdateAppointments} onReprint={handleReprint} />
                ))}
              </div>
            )
          )}
        </div>

        {totalPages > 1 && (
            <div className="px-4 py-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1 || isLoading} className="px-3 py-1 border rounded-md disabled:opacity-50 flex items-center"><ChevronLeftIcon className="h-4 w-4 mr-1" />Previous</button>
                <span className="whitespace-nowrap">Page <b>{currentPage}</b> of <b>{totalPages}</b></span>
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages || isLoading} className="px-3 py-1 border rounded-md disabled:opacity-50 flex items-center">Next<ChevronRightIcon className="h-4 w-4 ml-1" /></button>
            </div>
        )}
        
        <BookAppointmentForm isOpen={isBookAppointmentModalOpen} onClose={() => setIsBookAppointmentModalOpen(false)} onBookAppointment={handleBookNewAppointment} />
        {isEditModalOpen && selectedAppointmentForEdit && (<EditAppointmentForm isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setSelectedAppointmentForEdit(null); }} appointment={selectedAppointmentForEdit} onUpdateAppointment={handleUpdateAppointment} />)}
        {isBillingModalOpen && selectedAppointmentForBilling && (<BillingModal isOpen={isBillingModalOpen} onClose={handleCloseBillingModal} appointment={selectedAppointmentForBilling} customer={selectedAppointmentForBilling.customerId} stylist={selectedAppointmentForBilling.stylistId} onFinalizeAndPay={handleFinalizeBill} />)}
        <Tooltip id="app-tooltip" variant="dark" style={{ backgroundColor: '#2D3748', color: '#FFF', borderRadius: '6px', padding: '4px 8px', fontSize: '12px' }} />
      </div>

      {/* The portal renders this div directly into <body> so your CSS can find it */}
      {isClient && invoiceForPrint && createPortal(
        <div className="print-container">
          <Receipt 
            invoiceData={invoiceForPrint} 
            businessDetails={businessDetails} 
          />
        </div>,
        document.body
      )}
    </>
  );
}