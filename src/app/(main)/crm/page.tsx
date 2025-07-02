// FILE: /app/crm/page.tsx - COMPLETE FINAL VERSION

'use client';

import React from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useCrm } from './hooks/useCrm';
import { CustomerTable } from './components/CustomerTable';
import CrmCustomerDetailPanel from './components/CrmCustomerDetailPanel';
import AddEditCustomerModal from './components/AddEditCustomerModal';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export default function CrmPage() {

    const { data: session } = useSession();

  const {
    // Data State
    customers,
    pagination,
    isLoading,
    pageError,

    // UI State
    searchTerm,
    selectedCustomer,
    isDetailPanelOpen,
    isAddEditModalOpen,
    editingCustomer,
    // --- Get the new values from the final hook ---
    panelKey,
    isMembershipUpdating,

    // Handlers & Actions
    setSearchTerm,
    goToPage,
    refreshData,
    handleViewCustomerDetails,
    setIsDetailPanelOpen,
    handleDeleteCustomer,
    handleOpenAddModal,
    handleOpenEditModal,
    handleCloseAddEditModal,
    // --- Get the new handler ---
    handleGrantMembership,
  } = useCrm();

   const canCreateCustomers = session && hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_CREATE);
  const canUpdateCustomers = session && hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_UPDATE);
  const canDeleteCustomers = session && hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_DELETE);

  return (
    <div className="min-h-screen bg-gray-50/30">
      <main
        className={`flex-grow  md: transition-all duration-300 ${isDetailPanelOpen ? 'md:mr-[400px] lg:mr-[450px]' : 'mr-0'}`}
      >

        {/* Page Header */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
            <p className="text-sm text-gray-600">Manage your entire customer base.</p>
          </div>
        {canCreateCustomers && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-black rounded-lg shadow-sm hover:bg-gray-800 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              Add Customer
            </button>
          )}
        </header>

        {/* Main Content Area */}
        <div className="space-y-6">
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />

          {/* Conditional Rendering for Table/Messages */}
          {isLoading && <div className="p-10 text-center text-gray-500">Loading customers...</div>}

          {pageError && <div className="p-4 bg-red-100 text-red-700 rounded-lg text-sm">{pageError}</div>}

          {!isLoading && !pageError && customers.length === 0 && (
            <div className="py-16 text-center text-gray-500 bg-white rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold">No Customers Found</h3>
              <p>{searchTerm ? `No customers match your search for "${searchTerm}".` : "You haven't added any customers yet."}</p>
            </div>
          )}

             {!isLoading && !pageError && customers.length > 0 && (
          <CustomerTable
            customers={customers}
            pagination={pagination}
            onViewDetails={handleViewCustomerDetails}
            onEdit={canUpdateCustomers ? handleOpenEditModal : undefined}
            onDelete={canDeleteCustomers ? handleDeleteCustomer : undefined}
            onGoToPage={goToPage}
          />
        )}
        </div>
      </main>

      {/* Side Panels and Modals (Overlay Components) */}

      {/* --- THE FIX: ALL PROPS ARE NOW WIRED CORRECTLY --- */}
      <CrmCustomerDetailPanel
        key={panelKey} // Forces a full re-mount when the key changes
        customer={selectedCustomer}
        isOpen={isDetailPanelOpen}
        isUpdating={isMembershipUpdating} // Passes the loading state to the button
        onClose={() => setIsDetailPanelOpen(false)}
        onGrantMembership={handleGrantMembership} // Passes the centralized handler
      />
      {/* Mobile-only overlay to close the panel */}
      {isDetailPanelOpen && <div onClick={() => setIsDetailPanelOpen(false)} className="fixed inset-0 bg-black/30 z-30 md:hidden" />}

      <AddEditCustomerModal
        isOpen={isAddEditModalOpen}
        onClose={handleCloseAddEditModal}
        onSave={refreshData}
        customerToEdit={editingCustomer}
      />
    </div>
  );
}
