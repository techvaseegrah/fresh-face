// FILE: /app/crm/hooks/useCrm.ts - COMPLETE & MULTI-TENANT

'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { CrmCustomer, PaginationInfo } from '../types';
import { getSession } from 'next-auth/react'; // 1. Import getSession

interface CrmFilters {
  status: string;
  isMember: string;
  lastVisitFrom: string;
  lastVisitTo: string;
  gender: string;
  birthdayMonth: string;
  nonReturningDays: string;
}

const initialFilters: CrmFilters = {
  status: '',
  isMember: '',
  lastVisitFrom: '',
  lastVisitTo: '',
  gender: '',
  birthdayMonth: '',
  nonReturningDays: '90',
};

export function useCrm() {
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ currentPage: 1, totalPages: 1, totalCustomers: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filters, setFilters] = useState<CrmFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<CrmFilters>(initialFilters);
  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomer | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CrmCustomer | null>(null);
  const [panelKey, setPanelKey] = useState(0);
  const [isMembershipUpdating, setIsMembershipUpdating] = useState(false);
  
  // 2. Create the tenant-aware fetch helper function
  const tenantFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const session = await getSession();
    if (!session?.user?.tenantId) {
      throw new Error("Your session is invalid. Please log in again.");
    }
    const headers = { ...options.headers, 'x-tenant-id': session.user.tenantId };
    if (options.body) {
      (headers as any)['Content-Type'] = 'application/json';
    }
    return fetch(url, { ...options, headers });
  }, []);

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
    const params = new URLSearchParams({ page: String(page), limit: '10', search: debouncedSearchTerm });
    Object.entries(appliedFilters).forEach(([key, value]) => { if (value) { params.append(key, value); } });

    try {
      // 3. Use the tenantFetch helper
      const response = await tenantFetch(`/api/customer?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch customers');
      setCustomers(data.customers);
      setPagination(data.pagination);
    } catch (err: any) {
      setPageError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchTerm, appliedFilters, tenantFetch]); // 4. Add tenantFetch to dependencies

  useEffect(() => { fetchCustomers(pagination.currentPage); }, [fetchCustomers, pagination.currentPage, debouncedSearchTerm, appliedFilters]);
  
  const handleFilterChange = (filterName: keyof CrmFilters, value: string) => { setFilters(prev => ({ ...prev, [filterName]: value })); };
  const applyFilters = () => { setPagination(prev => ({ ...prev, currentPage: 1 })); setAppliedFilters(filters); };
  const clearFilters = () => { setFilters(initialFilters); setAppliedFilters(initialFilters); setPagination(prev => ({ ...prev, currentPage: 1 })); };
  const refreshData = () => { fetchCustomers(pagination.currentPage); };

  const fetchCustomerDetails = useCallback(async (customerId: string): Promise<CrmCustomer | null> => {
    try {
        // 3. Use the tenantFetch helper
        const response = await tenantFetch(`/api/customer/${customerId}`, { cache: 'no-store' });
        const apiResponse = await response.json();
        if (!response.ok) { throw new Error(apiResponse.message || 'Failed to fetch details'); }
        return apiResponse.customer;
    } catch (error: any) { toast.error(`Error loading details: ${error.message}`); return null; }
  }, [tenantFetch]); // 4. Add tenantFetch to dependencies

  const handleDeleteCustomer = useCallback(async (customerId: string, customerName: string) => {
    if (!confirm(`Are you sure you want to deactivate ${customerName}? Their history will be saved.`)) return;
    try {
      // 3. Use the tenantFetch helper
      const response = await tenantFetch(`/api/customer/${customerId}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to deactivate customer.');
      toast.success('Customer deactivated successfully.');
      refreshData();
    } catch (err: any) { toast.error(err.message); }
  }, [refreshData, tenantFetch]); // 4. Add tenantFetch to dependencies

  const handleViewCustomerDetails = useCallback(async (customer: CrmCustomer) => {
    if (isDetailPanelOpen && selectedCustomer?._id === customer._id) { setIsDetailPanelOpen(false); return; }
    setPanelKey(prevKey => prevKey + 1); setIsDetailPanelOpen(true); setSelectedCustomer(null);
    const detailedData = await fetchCustomerDetails(customer._id);
    setSelectedCustomer(detailedData);
  }, [isDetailPanelOpen, selectedCustomer, fetchCustomerDetails]);
  
  const handleOpenAddModal = () => { setEditingCustomer(null); setIsAddEditModalOpen(true); };
  const handleOpenEditModal = (customer: CrmCustomer) => { setEditingCustomer(customer); setIsAddEditModalOpen(true); };
  const handleCloseAddEditModal = () => { setIsAddEditModalOpen(false); setEditingCustomer(null); };

  const handleGrantMembership = useCallback(async (customerId: string, barcode: string) => {
    setIsMembershipUpdating(true);
    try {
      // 3. Use the tenantFetch helper
      const response = await tenantFetch(`/api/customer/${customerId}/toggle-membership`, {
        method: 'POST',
        body: JSON.stringify({ isMembership: true, membershipBarcode: barcode }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.customer) throw new Error(result.message || 'Failed to grant membership.');
      toast.success(`Membership granted successfully with barcode: ${result.customer.membershipBarcode}`);
      const freshCustomerData = result.customer;
      setSelectedCustomer(freshCustomerData);
      setCustomers(prev => prev.map(c => (c._id === customerId ? freshCustomerData : c)));
      setPanelKey(prevKey => prevKey + 1);
    } catch (err: any) { toast.error(err.message); } finally { setIsMembershipUpdating(false); }
  }, [tenantFetch]); // 4. Add tenantFetch to dependencies

  const goToPage = (pageNumber: number) => { if (pageNumber >= 1 && pageNumber <= pagination.totalPages) { setPagination(prev => ({ ...prev, currentPage: pageNumber })); } };

  return {
    customers, pagination, isLoading, pageError, searchTerm, selectedCustomer, isDetailPanelOpen, isAddEditModalOpen, editingCustomer, panelKey, isMembershipUpdating,
    filters, setSearchTerm, goToPage, refreshData, handleViewCustomerDetails, setIsDetailPanelOpen, handleDeleteCustomer, handleOpenAddModal, handleOpenEditModal,
    handleCloseAddEditModal, handleGrantMembership, handleFilterChange, applyFilters, clearFilters,
  };
}