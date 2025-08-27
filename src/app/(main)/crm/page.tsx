// FILE: /app/crm/page.tsx - COMPLETE, MULTI-TENANT & MOBILE-RESPONSIVE

'use client';

import React, { useState } from 'react';
import { PlusIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useCrm } from './hooks/useCrm';
import { CustomerTable } from './components/CustomerTable';
import CrmCustomerDetailPanel from './components/CrmCustomerDetailPanel';
import AddEditCustomerModal from './components/AddEditCustomerModal';
import { useSession, getSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import CustomerImportModal from '@/components/admin/CustomerImportModal';
import { toast } from 'react-toastify';

export default function CrmPage() {
  const { data: session } = useSession();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // This custom hook is assumed to be updated for multi-tenancy
  const {
    customers, pagination, isLoading, pageError, searchTerm, selectedCustomer, isDetailPanelOpen, isAddEditModalOpen, editingCustomer, panelKey, isMembershipUpdating,
    filters, setSearchTerm, goToPage, refreshData, handleViewCustomerDetails, setIsDetailPanelOpen, handleDeleteCustomer, handleOpenAddModal, handleOpenEditModal,
    handleCloseAddEditModal, handleGrantMembership, handleFilterChange, applyFilters, clearFilters,
  } = useCrm();

  // --- PERMISSION CHECKS ---
  const canCreateCustomers = session && hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_CREATE);
  const canImportCustomers = session && hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_IMPORT);
  const canExportCustomers = session && hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_EXPORT);
  const canUpdateCustomers = session && hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_UPDATE);
  const canDeleteCustomers = session && hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_DELETE);
  
  const handleImportSuccess = (report: any) => {
    const successMessage = `Import complete: ${report.successfulImports} imported, ${report.failedImports} failed.`;
    toast.success(successMessage, { autoClose: 10000 });
    if (report.failedImports > 0) {
      console.error("Customer Import Errors:", report.errors);
      toast.error("Some customers failed to import. Check console for details.", { autoClose: false });
    }
    refreshData();
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const session = await getSession();
      if (!session?.user?.tenantId) {
        throw new Error("Your session is invalid. Please log in again.");
      }

      const response = await fetch('/api/customer/export', {
        headers: {
          'x-tenant-id': session.user.tenantId,
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to start export.' }));
        throw new Error(errorData.message || 'An unknown error occurred.');
      }
      
      const disposition = response.headers.get('Content-Disposition');
      let filename = 'Customers.xlsx';
      if (disposition && disposition.includes('attachment')) {
        const filenameMatch = /filename="([^"]+)"/.exec(disposition);
        if (filenameMatch && filenameMatch[1]) { filename = filenameMatch[1]; }
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/30 p-4 sm:p-6">
      <main className={`flex-grow transition-all duration-300 ${isDetailPanelOpen ? 'md:mr-[400px] lg:mr-[450px]' : 'mr-0'}`}>
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
            <p className="text-sm text-gray-600 mt-1">Manage your entire customer base.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end w-full sm:w-auto">
            {canExportCustomers && (
              <button onClick={handleExportAll} disabled={isExporting} className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-wait">
                {isExporting ? 'Exporting...' : ( <><ArrowDownTrayIcon className="w-5 h-5" /> Export All </>)}
              </button>
            )}
            {canImportCustomers && (
              <button onClick={() => setIsImportModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700 transition-colors">Import</button>
            )}
            {canCreateCustomers && (
              <button onClick={handleOpenAddModal} className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-black rounded-lg shadow-sm hover:bg-gray-800 transition-colors">
                <PlusIcon className="w-5 h-5" /> Add
              </button>
            )}
          </div>
        </header>

        <div className="space-y-6">
          <input type="text" placeholder="Search by name, email, or phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"/>

          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="filter-status" className="block text-sm font-medium text-gray-700">Status</label>
                <select id="filter-status" value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                  <option value="">All</option>
                  <option value="Active">Active (Visited in last 2 months)</option>
                  <option value="Inactive">Inactive (Visited over 2 months ago)</option>
                  <option value="Non-returning">Non-returning (Custom)</option>
                  <option value="New">New (No visits yet)</option>
                </select>
              </div>
              <div>
                <label htmlFor="filter-member" className="block text-sm font-medium text-gray-700">Membership</label>
                <select id="filter-member" value={filters.isMember} onChange={(e) => handleFilterChange('isMember', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                  <option value="">Any</option><option value="true">Member</option><option value="false">Not a Member</option>
                </select>
              </div>
              <div>
                <label htmlFor="filter-gender" className="block text-sm font-medium text-gray-700">Gender</label>
                <select id="filter-gender" value={filters.gender} onChange={(e) => handleFilterChange('gender', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                  <option value="">All</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="filter-birthday" className="block text-sm font-medium text-gray-700">Birthday Month</label>
                <select id="filter-birthday" value={filters.birthdayMonth} onChange={(e) => handleFilterChange('birthdayMonth', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                   <option value="">Any</option>
                   {Array.from({ length: 12 }, (_, i) => (<option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>))}
                </select>
              </div>
            </div>
            
            {filters.status === 'Non-returning' && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                <label htmlFor="filter-non-returning-days" className="block text-sm font-medium text-gray-700">
                  Find customers who have not returned in the last (days)
                </label>
                <input
                  type="number"
                  id="filter-non-returning-days"
                  value={filters.nonReturningDays}
                  onChange={(e) => handleFilterChange('nonReturningDays', e.target.value)}
                  className="mt-1 block w-full sm:w-1/2 md:w-1/4 pl-3 pr-2 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  placeholder="e.g., 90"
                />
              </div>
            )}
            
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div>
                  <label htmlFor="filter-visit-from" className="block text-sm font-medium text-gray-700">Last Visit From</label>
                  <input type="date" id="filter-visit-from" value={filters.lastVisitFrom} onChange={(e) => handleFilterChange('lastVisitFrom', e.target.value)} className="mt-1 block w-full pl-3 pr-2 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md" />
               </div>
               <div>
                  <label htmlFor="filter-visit-to" className="block text-sm font-medium text-gray-700">Last Visit To</label>
                  <input type="date" id="filter-visit-to" value={filters.lastVisitTo} onChange={(e) => handleFilterChange('lastVisitTo', e.target.value)} className="mt-1 block w-full pl-3 pr-2 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md" />
               </div>
            </div>
            
            <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-3">
              <button onClick={clearFilters} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">Clear</button>
              <button onClick={applyFilters} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700">Apply Filters</button>
            </div>
          </div>

          {isLoading && <div className="p-10 text-center text-gray-500">Loading customers...</div>}
          {pageError && <div className="p-4 bg-red-100 text-red-700 rounded-lg text-sm">{pageError}</div>}
          
          {!isLoading && !pageError && customers.length === 0 && (
            <div className="py-16 text-center text-gray-500 bg-white rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold">No Customers Found</h3>
              <p>{searchTerm || Object.values(filters).some(v => v) ? `No customers match your search or filter criteria.` : "You haven't added any customers yet."}</p>
            </div>
          )}

          {/* This container makes the table scrollable on mobile without breaking the page layout */}
          {!isLoading && !pageError && customers.length > 0 && (
             <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-gray-200">
                <CustomerTable customers={customers} pagination={pagination} onViewDetails={handleViewCustomerDetails} onEdit={canUpdateCustomers ? handleOpenEditModal : undefined} onDelete={canDeleteCustomers ? handleDeleteCustomer : undefined} onGoToPage={goToPage} />
             </div>
          )}
        </div>
      </main>

      <CrmCustomerDetailPanel key={panelKey} customer={selectedCustomer} isOpen={isDetailPanelOpen} isUpdating={isMembershipUpdating} onClose={() => setIsDetailPanelOpen(false)} onGrantMembership={handleGrantMembership} />
      {isDetailPanelOpen && <div onClick={() => setIsDetailPanelOpen(false)} className="fixed inset-0 bg-black/30 z-30 md:hidden" />}
      <AddEditCustomerModal isOpen={isAddEditModalOpen} onClose={handleCloseAddEditModal} onSave={refreshData} customerToEdit={editingCustomer} />
      <CustomerImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImportSuccess={handleImportSuccess} />
    </div>
  );
}