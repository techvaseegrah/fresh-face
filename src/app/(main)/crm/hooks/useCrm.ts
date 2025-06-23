// FILE: /app/crm/hooks/useCrm.ts - (COMPLETE, FINAL, AND DEFINITIVE VERSION)

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
  const [panelKey, setPanelKey] = useState(0);
  const [isMembershipUpdating, setIsMembershipUpdating] = useState(false);

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
        const response = await fetch(`/api/customer/${customerId}`, { cache: 'no-store' });
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

  const handleViewCustomerDetails = useCallback(async (customer: CrmCustomer) => {
    if (isDetailPanelOpen && selectedCustomer?.id === customer.id) {
        setIsDetailPanelOpen(false);
        return;
    }
    setPanelKey(prevKey => prevKey + 1); 
    setIsDetailPanelOpen(true);
    setSelectedCustomer(null);
    const detailedData = await fetchCustomerDetails(customer.id);
    setSelectedCustomer(detailedData);
  }, [isDetailPanelOpen, selectedCustomer]);
  
  const handleOpenAddModal = () => { setEditingCustomer(null); setIsAddEditModalOpen(true); };
  const handleOpenEditModal = (customer: CrmCustomer) => { setEditingCustomer(customer); setIsAddEditModalOpen(true); };
  const handleCloseAddEditModal = () => { setIsAddEditModalOpen(false); setEditingCustomer(null); };

  /**
   * THE FINAL, SIMPLIFIED LOGIC
   * This function performs the update and uses the fresh, complete data
   * returned directly from the POST request, eliminating the race condition.
   */
  const handleGrantMembership = async (customerId: string) => {
    setIsMembershipUpdating(true);
    try {
      const response = await fetch(`/api/customer/${customerId}/toggle-membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMembership: true }),
      });

      const result = await response.json();
      if (!result.success || !result.customer) {
        throw new Error(result.message || 'Failed to grant membership.');
      }
      
      toast.success('Membership granted successfully!');
      
      // --- THE FIX ---
      // No more `fetchCustomerDetails` call. We use the fresh customer
      // object that our improved POST API just returned to us.
      const freshCustomerData = result.customer;

      // Update the panel with the new complete data.
      setSelectedCustomer(freshCustomerData);

      // Update the customer in the main table list in the background.
      setCustomers(prev =>
        prev.map(c => (c.id === customerId ? freshCustomerData : c))
      );
      
      // Force a re-mount of the panel for ultimate reliability.
      setPanelKey(prevKey => prevKey + 1);

    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsMembershipUpdating(false);
    }
  };

  const goToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= pagination.totalPages) {
        setPagination(prev => ({ ...prev, currentPage: pageNumber }));
    }
  };

  return {
    // State
    customers, pagination, isLoading, pageError, searchTerm, selectedCustomer,
    isDetailPanelOpen, isAddEditModalOpen, editingCustomer, panelKey, isMembershipUpdating,
    // Handlers
    setSearchTerm, goToPage, refreshData, handleViewCustomerDetails, setIsDetailPanelOpen,
    handleDeleteCustomer, handleOpenAddModal, handleOpenEditModal,
    handleCloseAddEditModal, handleGrantMembership,
  };
}