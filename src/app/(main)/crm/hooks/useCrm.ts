// FILE: /app/crm/hooks/useCrm.ts - FINAL VERSION

'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { CrmCustomer, PaginationInfo } from '../types';

export function useCrm() {
  // Data state
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ currentPage: 1, totalPages: 1, totalCustomers: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // UI State for Modals and Panels
  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomer | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CrmCustomer | null>(null);

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPagination(prev => ({ ...prev, currentPage: 1 }));
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchCustomers = useCallback(async (page = 1) => {
    setIsLoading(true);
    setPageError(null);
    try {
      const response = await fetch(`/api/customer?page=${page}&limit=10&search=${debouncedSearchTerm}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Failed to fetch customers');
      setCustomers(data.customers);
      setPagination(data.pagination);
    } catch (err: any) {
      setPageError(err.message);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchTerm]);

  useEffect(() => {
    fetchCustomers(pagination.currentPage);
  }, [fetchCustomers, pagination.currentPage]);
  
  const refreshData = () => {
    fetchCustomers(pagination.currentPage);
  };

  const fetchCustomerDetails = async (customerId: string): Promise<CrmCustomer | null> => {
    try {
        const response = await fetch(`/api/customer/${customerId}`);
        const apiResponse = await response.json();
        if (!response.ok || !apiResponse.success) {
            throw new Error(apiResponse.message || 'Failed to fetch details');
        }
        return apiResponse.customer;
    } catch (error: any) {
        toast.error(`Error loading details: ${error.message}`);
        return null;
    }
  };

  const handleDeleteCustomer = async (customerId: string, customerName: string) => {
    if (!confirm(`Are you sure you want to deactivate ${customerName}? Their history will be saved.`)) return;
    try {
      const response = await fetch(`/api/customer/${customerId}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to deactivate customer.');
      toast.success('Customer deactivated successfully.');
      refreshData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // --- UI HANDLERS ---

  const handleViewCustomerDetails = useCallback(async (customer: CrmCustomer) => {
    if (isDetailPanelOpen && selectedCustomer?.id === customer.id) {
        setIsDetailPanelOpen(false);
        return;
    }
    setIsDetailPanelOpen(true);
    setSelectedCustomer(null); // Show loading state in panel
    const detailedData = await fetchCustomerDetails(customer.id);
    setSelectedCustomer(detailedData);
  }, [isDetailPanelOpen, selectedCustomer]);
  
  const handleOpenAddModal = () => { setEditingCustomer(null); setIsAddEditModalOpen(true); };
  const handleOpenEditModal = (customer: CrmCustomer) => { setEditingCustomer(customer); setIsAddEditModalOpen(true); };
  const handleCloseAddEditModal = () => { setIsAddEditModalOpen(false); setEditingCustomer(null); };

  /**
   * THE CORE FIX IS HERE.
   * This function now takes only the customer's ID, then re-fetches the
   * complete, rich details to ensure the UI is updated with fresh, consistent data.
   */
  const handleMembershipUpdated = async (customerId: string) => {
    toast.success('Membership status updated!');

    // Re-fetch the full details using the existing reliable function.
    const freshDetailedData = await fetchCustomerDetails(customerId);

    if (freshDetailedData) {
      // Update the panel with the new complete data.
      setSelectedCustomer(freshDetailedData);

      // Update the customer in the main table list in the background.
      setCustomers(prevCustomers =>
        prevCustomers.map(c =>
          c.id === customerId ? freshDetailedData : c
        )
      );
    } else {
      // Fallback: If fetching details fails, refresh the entire list.
      refreshData();
    }
  };

  const goToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= pagination.totalPages) {
        setPagination(prev => ({ ...prev, currentPage: pageNumber }));
    }
  };

  return {
    // State
    customers,
    pagination,
    isLoading,
    pageError,
    searchTerm,
    selectedCustomer,
    isDetailPanelOpen,
    isAddEditModalOpen,
    editingCustomer,
    
    // Handlers
    setSearchTerm,
    goToPage,
    refreshData,
    handleViewCustomerDetails,
    setIsDetailPanelOpen,
    handleDeleteCustomer,
    handleOpenAddModal,
    handleOpenEditModal,
    handleCloseAddEditModal,
    handleMembershipUpdated,
  };
}