'use client';

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import {
  UserGroupIcon, UserPlusIcon, CheckBadgeIcon, NoSymbolIcon, PlusIcon,
  ChevronLeftIcon, ChevronRightIcon, GiftIcon, XMarkIcon, SparklesIcon, CalendarDaysIcon, TagIcon, PencilSquareIcon, TrashIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

// ===================================================================================
//  INTERFACES
// ===================================================================================
interface AppointmentHistoryItem { _id: string; id: string; service: string; date: string; status: string; services: string[]; totalAmount: number; stylistName: string; }
interface MembershipUIDetails { planName: string; status: string; startDate: string; endDate: string; }
interface CrmCustomer {
  id: string; _id: string; name: string; email: string; phoneNumber: string; createdAt?: string;
  status?: 'Active' | 'Inactive' | 'New';
  appointmentHistory?: AppointmentHistoryItem[];
  currentMembership?: MembershipUIDetails | null;
  loyaltyPoints?: number;
}
interface MembershipPlanFE { _id: string; id: string; name: string; price: number; durationDays: number; }
interface AddCustomerFormData { name: string; email: string; phoneNumber: string; }

// ===================================================================================
//  SUB-COMPONENTS
// ===================================================================================

// --- CRM Customer Detail Panel (Read-Only) ---
const CrmCustomerDetailPanel: React.FC<{customer: CrmCustomer | null, isOpen: boolean, onClose: () => void, onAddMembership: (customerId: string) => void}> = ({ customer, isOpen, onClose, onAddMembership }) => {
  const formatDate = (dateString?: string) => { if (!dateString) return 'N/A'; return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); };
  const panelClasses = `fixed top-0 right-0 h-full bg-white shadow-2xl transition-transform duration-300 ease-in-out z-40 w-full md:w-[400px] lg:w-[450px] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`;
  if (!isOpen && !customer) return <aside className={panelClasses}></aside>;
  return (<aside className={panelClasses} aria-hidden={!isOpen}>{customer ? (<div className="h-full flex flex-col"><div className="p-6 pb-4 border-b flex-shrink-0"><div className="flex justify-between items-start"><div><h3 className="text-xl font-bold text-gray-900 leading-tight">{customer.name}</h3><div className="mt-2">{customer.currentMembership ? (<span className="px-2 py-0.5 inline-flex text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 items-center gap-1"><SparklesIcon className="w-3.5 h-3.5" />Member</span>) : (<span className="px-2 py-0.5 inline-flex text-xs font-semibold rounded-full bg-gray-200 text-gray-700">Not a Member</span>)}</div></div><button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-full ml-4 flex-shrink-0"><XMarkIcon className="w-6 h-6" /></button></div></div><div className="flex-grow overflow-y-auto p-6 space-y-6"><div className="space-y-3"><div className="flex items-center gap-3 text-sm"><span className="font-medium text-gray-600 w-24">Activity Status:</span>{customer.status && (<span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${customer.status === 'Active' ? 'bg-green-100 text-green-800' : customer.status === 'Inactive' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{customer.status}</span>)}</div><div className="flex items-center gap-3 text-sm"><span className="font-medium text-gray-600 w-24">Loyalty Points:</span><span className="font-bold text-lg text-indigo-600">{customer.loyaltyPoints ?? 0}</span></div></div>{!customer.currentMembership && (<div className="pt-4 border-t"><button onClick={() => onAddMembership(customer.id)} className="w-full text-center py-2.5 px-4 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">+ Add Membership</button></div>)}<div><h4 className="text-base font-semibold text-gray-800 mb-3 border-t pt-4">Appointment History</h4><div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">{(!customer.appointmentHistory || customer.appointmentHistory.length === 0) ? (<p className="text-gray-500 text-sm py-4 text-center italic">No paid appointments found.</p>) : (customer.appointmentHistory.map(apt => (<div key={apt._id} className="p-3 bg-gray-100/70 rounded-lg text-sm"><div className="flex justify-between items-start"><p className="font-semibold">{formatDate(apt.date)}</p><p className="font-bold text-gray-800">₹{(apt.totalAmount || 0).toFixed(2)}</p></div><p className="text-xs text-gray-600">with {apt.stylistName}</p><div className="flex items-start gap-2 mt-2 pt-2 border-t text-xs text-gray-500"><TagIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /><span>{Array.isArray(apt.services) ? apt.services.join(', ') : 'Details unavailable'}</span></div></div>)))}</div></div></div></div>) : (<div className="p-6 h-full flex items-center justify-center text-center text-gray-500"><button onClick={onClose} className="absolute top-6 right-6 p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"><XMarkIcon className="w-6 h-6" /></button><p>Loading details...</p></div>)}</aside>);
};

// --- Add/Edit Customer Modal ---
interface AddEditCustomerModalProps { isOpen: boolean; onClose: () => void; onSave: () => void; customerToEdit: CrmCustomer | null; }
const AddEditCustomerModal: React.FC<AddEditCustomerModalProps> = ({ isOpen, onClose, onSave, customerToEdit }) => {
  const [formData, setFormData] = useState({ name: '', email: '', phoneNumber: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditMode = !!customerToEdit;
  useEffect(() => { if (isOpen) { if (isEditMode) { setFormData({ name: customerToEdit.name, email: customerToEdit.email, phoneNumber: customerToEdit.phoneNumber }); } else { setFormData({ name: '', email: '', phoneNumber: '' }); } setFormError(null); setIsSubmitting(false); } }, [isOpen, customerToEdit, isEditMode]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { setFormData(prev => ({ ...prev, [e.target.name]: e.target.value })); };
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setFormError(null); setIsSubmitting(true);
    const apiEndpoint = isEditMode ? `/api/customer/${customerToEdit?._id}` : '/api/customer';
    const method = isEditMode ? 'PUT' : 'POST';
    try {
      const response = await fetch(apiEndpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to save customer.');
      toast.success(`Customer ${isEditMode ? 'updated' : 'added'} successfully!`);
      onSave();
    } catch (error: any) { setFormError(error.message); }
    finally { setIsSubmitting(false); }
  };
  if (!isOpen) return null;
  return (<div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex justify-center items-center p-4"><div className="bg-white p-6 md:p-8 rounded-xl shadow-2xl w-full max-w-md"><div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-semibold">{isEditMode ? 'Edit Customer' : 'Add New Customer'}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-6 h-6" /></button></div>{formError && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">{formError}</div>}<form onSubmit={handleSubmit} className="space-y-4"><div><label htmlFor="name" className="block text-sm mb-1">Full Name</label><input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="w-full px-3 py-2 border rounded-md"/></div><div><label htmlFor="email" className="block text-sm mb-1">Email</label><input type="email" name="email" id="email" value={formData.email} onChange={handleChange} required className="w-full px-3 py-2 border rounded-md"/></div><div><label htmlFor="phoneNumber" className="block text-sm mb-1">Phone</label><input type="tel" name="phoneNumber" id="phoneNumber" value={formData.phoneNumber} onChange={handleChange} required className="w-full px-3 py-2 border rounded-md"/></div><div className="mt-8 flex justify-end gap-3"><button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 border rounded-md" disabled={isSubmitting}>Cancel</button><button type="submit" className="px-4 py-2 text-white bg-black rounded-md" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Customer'}</button></div></form></div></div>);
};

// --- StatCard Component ---
const StatCard: React.FC<{title: string, value: string, icon?: React.ReactNode}> = ({ title, value, icon }) => ( <div className="bg-white p-5 rounded-xl shadow-sm"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-500 truncate">{title}</p><p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p></div>{icon && <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">{icon}</div>}</div></div> );

// ===================================================================================
//  MAIN CRM PAGE COMPONENT
// ===================================================================================
export default function CrmPage() {
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCustomerCount, setTotalCustomerCount] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomer | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CrmCustomer | null>(null);
  const [isAddMembershipModalOpen, setIsAddMembershipModalOpen] = useState(false);
  const [customerToAddMembershipTo, setCustomerToAddMembershipTo] = useState<CrmCustomer | null>(null);
  const [availableMembershipPlans, setAvailableMembershipPlans] = useState<MembershipPlanFE[]>([]);
  const [isMembershipPlansLoading, setIsMembershipPlansLoading] = useState(false);
  const [selectedPlanIdForNewMembership, setSelectedPlanIdForNewMembership] = useState<string>('');
  const [addMembershipError, setAddMembershipError] = useState<string | null>(null);
  const [isAddingMembership, setIsAddingMembership] = useState(false);

  useEffect(() => { const handler = setTimeout(() => { setDebouncedSearchTerm(searchTerm); setCurrentPage(1); }, 500); return () => clearTimeout(handler); }, [searchTerm]);

  const fetchCustomers = useCallback(async (pageToFetch = 1) => {
    setIsLoading(true); setPageError(null);
    try {
      const response = await fetch(`/api/customer?page=${pageToFetch}&limit=${itemsPerPage}&search=${debouncedSearchTerm}`);
      const apiResponse = await response.json();
      if (!response.ok || !apiResponse.success) throw new Error(apiResponse.message || 'Failed to fetch customers');
      setCustomers(apiResponse.customers);
      setCurrentPage(apiResponse.pagination.currentPage);
      setTotalPages(apiResponse.pagination.totalPages);
      setTotalCustomerCount(apiResponse.pagination.totalCustomers);
    } catch (err: any) { setPageError(err.message); }
    finally { setIsLoading(false); }
  }, [itemsPerPage, debouncedSearchTerm]);

  useEffect(() => { fetchCustomers(currentPage); }, [fetchCustomers, currentPage]);

  const fetchCustomerDetails = async (customerId: string): Promise<CrmCustomer | null> => {
    const response = await fetch(`/api/customer/${customerId}`);
    const apiResponse = await response.json();
    if (!response.ok || !apiResponse.success) throw new Error(apiResponse.message || 'Failed to fetch details');
    return apiResponse.customer;
  };

  const handleViewCustomerDetails = useCallback(async (customer: CrmCustomer) => {
    if (isDetailPanelOpen && selectedCustomer?.id === customer.id) { setIsDetailPanelOpen(false); return; }
    setIsDetailPanelOpen(true); setSelectedCustomer(null);
    try { const detailedData = await fetchCustomerDetails(customer.id); setSelectedCustomer(detailedData); }
    catch (error: any) { setPageError("Error loading details: " + error.message); setIsDetailPanelOpen(false); }
  }, [isDetailPanelOpen, selectedCustomer]);
  
  const handleOpenAddModal = () => { setEditingCustomer(null); setIsAddEditModalOpen(true); };
  const handleOpenEditModal = (customer: CrmCustomer) => { setEditingCustomer(customer); setIsAddEditModalOpen(true); };
  const handleCloseModal = () => { setIsAddEditModalOpen(false); setEditingCustomer(null); };
  const handleSaveAndRefresh = () => { handleCloseModal(); fetchCustomers(currentPage); if (selectedCustomer) { fetchCustomerDetails(selectedCustomer.id).then(setSelectedCustomer); } };

  const handleDeleteCustomer = async (customerId: string, customerName: string) => {
    if (!confirm(`Are you sure you want to deactivate ${customerName}? Their history will be saved.`)) return;
    try {
      const response = await fetch(`/api/customer/${customerId}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to deactivate customer.');
      toast.success('Customer deactivated successfully.');
      fetchCustomers(currentPage);
    } catch (err: any) { toast.error(err.message); }
  };

  const closeDetailPanel = () => { setIsDetailPanelOpen(false); setSelectedCustomer(null); };
  
  const handleOpenAddMembershipForCustomer = async (customerId: string) => {
    const cust = customers.find(c => c.id === customerId) || selectedCustomer;
    if (!cust) return;
    setCustomerToAddMembershipTo(cust); setIsMembershipPlansLoading(true); setAddMembershipError(null);
    try {
      const res = await fetch('/api/membership-plans');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to fetch plans');
      setAvailableMembershipPlans(data.plans); setIsAddMembershipModalOpen(true);
    } catch (e: any) { setAddMembershipError("Error: " + e.message); }
    finally { setIsMembershipPlansLoading(false); }
  };
  const handleCloseAddMembershipModal = () => { setIsAddMembershipModalOpen(false); setCustomerToAddMembershipTo(null); setSelectedPlanIdForNewMembership(''); setAddMembershipError(null); };
  const handleConfirmAndSubmitMembership = async () => {
    if (!customerToAddMembershipTo || !selectedPlanIdForNewMembership) return;
    setIsAddingMembership(true); setAddMembershipError(null);
    try {
      const response = await fetch('/api/customer-membership', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: customerToAddMembershipTo.id, membershipPlanId: selectedPlanIdForNewMembership }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to add membership.");
      toast.success("Membership added successfully!"); handleCloseAddMembershipModal();
      if (selectedCustomer?.id === customerToAddMembershipTo.id) {
          const refreshedData = await fetchCustomerDetails(customerToAddMembershipTo.id);
          setSelectedCustomer(refreshedData);
      }
      await fetchCustomers(currentPage);
    } catch (error: any) { setAddMembershipError("Error: " + error.message); }
    finally { setIsAddingMembership(false); }
  };
  
  const goToPage = (pageNumber: number) => { if (pageNumber >= 1 && pageNumber <= totalPages) { setCurrentPage(pageNumber); } };

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className={`flex-grow p-4 md:p-8 transition-all duration-300 ${isDetailPanelOpen ? 'md:mr-[400px] lg:mr-[450px]' : 'mr-0'}`}>
        <div className="flex justify-between items-center mb-8"><div><h1 className="text-3xl font-bold">Customers</h1><p className="text-sm text-gray-600">Manage customer data.</p></div><button onClick={handleOpenAddModal} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-black rounded-lg"><PlusIcon className="w-5 h-5"/>Add Customer</button></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">{/* Stat Cards */}</div>
        {pageError && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">{pageError}</div>}
        <div className="mb-6"><input type="text" placeholder="Search customers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-3 border rounded-lg"/></div>
        
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {isLoading && <div className="p-10 text-center">Loading...</div>}
          {!isLoading && pageError && <div className="p-10 text-center text-red-600">Error: {pageError}</div>}
          {!isLoading && !pageError && customers.length === 0 && ( <div className="p-10 text-center">{searchTerm ? "No customers match." : "No customers found."}</div> )}
          {!isLoading && !pageError && customers.length > 0 && (
            <>
              <div className="overflow-x-auto"><table className="w-full text-sm text-left table-fixed"><thead className="text-xs text-gray-500 uppercase bg-gray-50"><tr><th scope ='col'className="px-6 py-3 w-1/4">Customer</th><th scope="col" className="px-6 py-3 w-1/4">Status</th>
        <th scope="col" className="px-6 py-3 w-1/4">Joined</th>
        <th scope="col" className="px-6 py-3 w-1/4 text-right">Actions</th></tr></thead><tbody className="divide-y">{customers.map((customer) => {
                const getStatusClasses = (status?: string) => { switch (status) { case 'Active': return 'bg-green-100 text-green-800'; case 'Inactive': return 'bg-red-100 text-red-800'; case 'New': return 'bg-blue-100 text-blue-800'; default: return 'bg-gray-100 text-gray-800'; }};
                const formatDate = (dateStr?: string) => { if (!dateStr) return 'N/A'; return new Date(dateStr).toLocaleDateString(); };
                return (
                  <tr key={customer.id}>
                    <td className="px-6 py-4 font-medium cursor-pointer" onClick={() => handleViewCustomerDetails(customer)}><div>{customer.name}</div><div className="text-xs font-normal text-gray-500">{customer.phoneNumber}</div></td>
                    <td className="px-6 py-4 cursor-pointer" onClick={() => handleViewCustomerDetails(customer)}><span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${getStatusClasses(customer.status)}`}>{customer.status}</span></td>
                    <td className="px-6 py-4 text-sm cursor-pointer" onClick={() => handleViewCustomerDetails(customer)}>{formatDate(customer.createdAt)}</td>
                    <td className="px-6 py-4 text-right"><div className="flex justify-end items-center space-x-4"><button onClick={(e) => { e.stopPropagation(); handleOpenEditModal(customer); }} className="font-medium text-indigo-600 hover:text-indigo-900 flex items-center gap-1"><PencilSquareIcon className="w-4 h-4"/>Edit</button><button onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer.id, customer.name); }} className="font-medium text-red-600 hover:text-red-900 flex items-center gap-1"><TrashIcon className="w-4 h-4"/>Delete</button></div></td>
                  </tr>
                );
              })}</tbody>
              </table>
              </div>
              {totalPages > 1 && (<div className="px-6 py-4 border-t flex items-center justify-between"><p>Showing <b>{(currentPage - 1) * itemsPerPage + 1}</b>-<b>{Math.min(currentPage * itemsPerPage, totalCustomerCount)}</b> of <b>{totalCustomerCount}</b></p><div className="flex items-center gap-1"><button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} className="p-2 disabled:opacity-50"><ChevronLeftIcon className="h-5 w-5"/></button><span>Page {currentPage} of {totalPages}</span><button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages} className="p-2 disabled:opacity-50"><ChevronRightIcon className="h-5 w-5"/></button></div></div>)}
            </>
          )}
        </div>
      </div>
      
      <CrmCustomerDetailPanel customer={selectedCustomer} isOpen={isDetailPanelOpen} onClose={closeDetailPanel} onAddMembership={handleOpenAddMembershipForCustomer} />
      {isDetailPanelOpen && (<div onClick={closeDetailPanel} className="fixed inset-0 bg-black/30 z-30 md:hidden"/>)}
      
      <AddEditCustomerModal isOpen={isAddEditModalOpen} onClose={handleCloseModal} onSave={handleSaveAndRefresh} customerToEdit={editingCustomer} />
      
      {isAddMembershipModalOpen && customerToAddMembershipTo && (<div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4"><div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg text-black"><div className="flex justify-between items-center mb-4"><h3 className="text-xl font-semibold">Add Membership to {customerToAddMembershipTo.name}</h3><button onClick={handleCloseAddMembershipModal} className="p-1 text-gray-500 hover:text-gray-700 rounded-full"><XMarkIcon className="w-5 h-5" /></button></div>{addMembershipError && <div className="my-2 p-2 bg-red-100 text-red-700 text-sm rounded">{addMembershipError}</div>}{isMembershipPlansLoading ? <p className="text-center py-4">Loading plans...</p> : availableMembershipPlans.length > 0 ? (<div className="space-y-4"><div><label htmlFor="membershipPlanSelect" className="block text-sm font-medium">Select Plan:</label><select id="membershipPlanSelect" value={selectedPlanIdForNewMembership} onChange={(e) => setSelectedPlanIdForNewMembership(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 border-gray-300 rounded-md"><option value="" disabled>-- Choose a plan --</option>{availableMembershipPlans.map(plan => ( <option key={plan._id} value={plan._id}>{plan.name} - ₹{plan.price.toFixed(2)}</option> ))}</select></div><div className="flex justify-end space-x-3 pt-3"><button type="button" onClick={handleCloseAddMembershipModal} className="px-4 py-2 text-sm bg-gray-100 border rounded-md" disabled={isAddingMembership}>Cancel</button><button type="button" onClick={handleConfirmAndSubmitMembership} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md disabled:opacity-50" disabled={isAddingMembership || !selectedPlanIdForNewMembership}>{isAddingMembership ? 'Adding...' : 'Confirm'}</button></div></div>) : <p className="text-center py-4">No plans available.</p>}</div></div>)}
    </div>
  );
}