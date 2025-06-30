 'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';

// Define the shape of a single report item from your API
export interface DayEndReportHistoryItem {
  _id: string;
  closingDate: string;
  expected: { cash: number; card: number; upi: number; total: number; };
  actual: { totalCountedCash: number; card: number; upi: number; };
  discrepancy: { cash: number; card: number; upi: number; total: number; };
  notes?: string;
  closedBy: { name: string; };
  createdAt: string;
}

// A helper function to get sensible default dates (e.g., the last month)
const getInitialDates = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    
    // toISOString() gives 'YYYY-MM-DDTHH:mm:ss.sssZ', we just want the date part.
    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
    };
};

/**
 * Custom hook to manage the state and logic for fetching day-end closing history.
 */
export function useReportHistory() {
  const [reports, setReports] = useState<DayEndReportHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(getInitialDates());

  /**
   * Handler for updating the filter state when date inputs change.
   */
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  /**
   * A memoized function to fetch report history from the API.
   * It accepts the filters as an argument to avoid depending on state from its closure.
   */
  const fetchHistory = useCallback(async (currentFilters: { startDate: string, endDate: string }) => {
    setIsLoading(true);
    setError(null);
    
    // Use URLSearchParams to safely build the query string
    const queryParams = new URLSearchParams();
    if (currentFilters.startDate) queryParams.append('startDate', currentFilters.startDate);
    if (currentFilters.endDate) queryParams.append('endDate', currentFilters.endDate);
    
    try {
      const res = await fetch(`/api/reports/day-end-history?${queryParams.toString()}`);
      if (!res.ok) {
        // Try to parse the error message from the API response
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP error! Status: ${res.status}`);
      }
      
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch history');
      }
      
      // Assuming your API returns { success: true, data: [...] }
      setReports(data.data);
    } catch (e: any) {
      setError(e.message);
      toast.error(`Error: ${e.message}`);
      setReports([]); // Clear data on error to prevent showing stale data
    } finally {
      setIsLoading(false);
    }
  }, []); // The empty dependency array `[]` means this function is created only once.

  /**
   * Effect to trigger the initial data fetch when the component mounts.
   */
  useEffect(() => {
    // We pass the initial filter state to the stable fetchHistory function.
    fetchHistory(filters);
    // The dependency array ensures this effect runs if fetchHistory ever changes (it won't).
    // The eslint warning is satisfied.
  }, [fetchHistory]);

  /**
   * Handler for the form submission to apply filters.
   */
  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault(); // Prevent the browser's default form submission (page reload)
    
    // Basic validation
    if (new Date(filters.startDate) > new Date(filters.endDate)) {
        toast.error("Start date cannot be after end date.");
        return;
    }

    // Explicitly call fetchHistory with the LATEST filter state.
    fetchHistory(filters);
  };
  
  // Expose all the necessary state and handlers to the component.
  return {
    reports,
    isLoading,
    error,
    filters,
    handleFilterChange,
    handleApplyFilters,
  };
}