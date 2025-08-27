'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import ReportFilters from '@/app/(main)/telecalling/reports/components/ReportFilters';
import ReportTable from '@/app/(main)/telecalling/reports/components/ReportTable';
import LoadingSpinner from '@/components/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';

export interface TelecallingLog {
  _id: string;
  clientName: string;
  phoneNumber: string;
  callerName: string;
  lastVisitDate: string;
  outcome: string;
  createdAt: string;
  notes?: string;
}

const ITEMS_PER_PAGE = 10;

const defaultPagination = {
  currentPage: 1,
  totalPages: 1,
  totalResults: 0,
};

export default function TelecallingReportPage() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<TelecallingLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [pagination, setPagination] = useState(defaultPagination);

  const [filters, setFilters] = useState(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    return { startDate, endDate, outcome: 'All' };
  });

  const fetchLogs = useCallback(async () => {
    if (!session) return;

    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      startDate: format(filters.startDate, 'yyyy-MM-dd'),
      endDate: format(filters.endDate, 'yyyy-MM-dd'),
      outcome: filters.outcome,
      page: pagination.currentPage.toString(),
      limit: ITEMS_PER_PAGE.toString(),
    });

    try {
      const response = await fetch(`/api/telecalling/log?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': session.user.tenantId,
        },
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to fetch telecalling reports.');
      }
      
      const data = await response.json();
      
      setLogs(data.logs || []);
      setPagination(data.pagination || defaultPagination);

    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [session, filters, pagination.currentPage]); 

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);
  
  const handlePageChange = (newPage: number) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setPagination(prev => ({ ...prev, currentPage: newPage }));
  };
  
  const handleFilterChange = (newFilters: any) => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setFilters(newFilters);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Telecalling Reports</h1>
          <p className="mt-1 text-gray-500">Analyze call outcomes and team performance based on selected filters.</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
          <ReportFilters filters={filters} onFiltersChange={handleFilterChange} />
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center items-center h-64"><LoadingSpinner /></div>
          ) : error ? (
            <div className="text-center text-red-500 p-8">{error}</div>
          ) : (
            <>
              {/* === THE ONLY CHANGE IS ON THIS LINE === */}
              {/* We now pass the `filters` state down to the table component */}
              <ReportTable logs={logs} filters={filters} />
              
              <div className="p-4 border-t bg-gray-50">
                <Pagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}