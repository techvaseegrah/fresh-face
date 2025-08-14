'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';

// Interface definition remains the same
export interface DayEndReportHistoryItem {
  _id: string;
  closingDate: string;
  openingBalance: number;
  pettyCash: { total: number };
  expectedTotals: { cash: number; card: number; upi: number; other: number; total: number; };
  actualTotals: { totalCountedCash: number; card: number; upi: number; other: number; total: number};
  discrepancies: { cash: number; card: number; upi: number; total: number; };
  notes?: string;
  closedBy: { name: string; };
  createdAt: string;
}

const getInitialDates = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    
    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
    };
};

// 1. UPDATE THE HOOK SIGNATURE TO ACCEPT tenantFetch
export function useReportHistory(tenantFetch: (url: string, options?: RequestInit) => Promise<Response>) {
  const [reports, setReports] = useState<DayEndReportHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(getInitialDates());

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // 2. UPDATE fetchHistory TO USE THE PASSED-IN tenantFetch
  const fetchHistory = useCallback(async (currentFilters: { startDate: string, endDate: string }) => {
    // A guard clause to prevent API calls if tenantFetch isn't ready/available
    if (!tenantFetch) {
        setIsLoading(false);
        setError("API client is not ready.");
        return;
    }

    setIsLoading(true);
    setError(null);
    
    const queryParams = new URLSearchParams();
    if (currentFilters.startDate) queryParams.append('startDate', currentFilters.startDate);
    if (currentFilters.endDate) queryParams.append('endDate', currentFilters.endDate);
    
    try {
      // Use the tenantFetch function for the API call
      const res = await tenantFetch(`/api/reports/day-end-history?${queryParams.toString()}`);
      
      // The rest of the logic remains the same, as tenantFetch handles header/auth logic
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP error! Status: ${res.status}`);
      }
      
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch history');
      }
      
      setReports(data.data);
    } catch (e: any) {
      setError(e.message);
      toast.error(`Error: ${e.message}`);
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  // 3. ADD tenantFetch TO THE DEPENDENCY ARRAY
  }, [tenantFetch]);

  useEffect(() => {
    fetchHistory(filters);
  }, [fetchHistory]); // This dependency is correct

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(filters.startDate) > new Date(filters.endDate)) {
        toast.error("Start date cannot be after end date.");
        return;
    }
    fetchHistory(filters);
  };
  
  return {
    reports,
    isLoading,
    error,
    filters,
    handleFilterChange,
    handleApplyFilters,
  };
}