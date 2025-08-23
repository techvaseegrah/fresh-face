'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import ReportFilters from '@/app/(main)/telecalling/reports/components/ReportFilters';
import ReportTable from '@/app/(main)/telecalling/reports/components/ReportTable';
import LoadingSpinner from '@/components/LoadingSpinner';

// Define the structure of a single log entry.
// Exporting it allows other components in this feature (like ReportTable) to use the same type.
export interface TelecallingLog {
  _id: string;
  clientName: string;
  phoneNumber: string;
  callerName: string;
  lastVisitDate: string;
  outcome: string;
  createdAt: string; // The time of the telecall
  notes?: string;
}

export default function TelecallingReportPage() {
  // 1. --- STATE MANAGEMENT ---
  const { data: session } = useSession();
  const [logs, setLogs] = useState<TelecallingLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize filters with a default 7-day range for a better user experience.
  const [filters, setFilters] = useState(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7); // Set start date to 7 days ago
    return { startDate, endDate, outcome: 'All' };
  });

  // 2. --- DATA FETCHING LOGIC ---
  // A memoized function to fetch data from our new API endpoint.
  // It rebuilds and runs only when the session or filters change.
  const fetchLogs = useCallback(async () => {
    if (!session) return; // Don't fetch if the user session isn't loaded yet.

    setIsLoading(true);
    setError(null);

    // Build the query string from our filter state.
    const params = new URLSearchParams({
      startDate: format(filters.startDate, 'yyyy-MM-dd'),
      endDate: format(filters.endDate, 'yyyy-MM-dd'),
      outcome: filters.outcome,
    });

    try {
      const response = await fetch(`/api/telecalling/log?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': session.user.tenantId, // Crucial for multi-tenant apps
        },
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to fetch telecalling reports.');
      }
      
      const data = await response.json();
      setLogs(data);

    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsLoading(false); // Ensure loading is turned off, even if there's an error.
    }
  }, [session, filters]); // Dependencies for useCallback

  // Effect to trigger the fetch function when the component mounts or when fetchLogs changes.
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 3. --- RENDER LOGIC ---
  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Telecalling Reports</h1>
          <p className="mt-1 text-gray-500">Analyze call outcomes and team performance based on selected filters.</p>
        </div>
        
        {/* Filters Component */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
          <ReportFilters filters={filters} onFiltersChange={setFilters} />
        </div>

        {/* Data Table / Loading / Error Section */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center items-center h-64"><LoadingSpinner /></div>
          ) : error ? (
            <div className="text-center text-red-500 p-8">{error}</div>
          ) : (
            <ReportTable logs={logs} />
          )}
        </div>
      </div>
    </div>
  );
}