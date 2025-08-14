'use client';

import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useSession, getSession } from 'next-auth/react'; // 1. IMPORT getSession
import { useCallback } from 'react'; // 2. IMPORT useCallback
import { toast } from 'react-toastify'; // Import toast for error handling
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { useReportHistory } from './hooks/useReportHistory'; // Correct path to your hook
import { FilterBar } from './components/FilterBar';
import { ReportList } from './components/ReportList';

export default function DayEndHistoryPage() {
  const { data: session } = useSession();

  // 3. DEFINE THE tenantFetch HELPER FUNCTION
  const tenantFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const currentSession = await getSession(); 
    if (!currentSession?.user?.tenantId) {
      toast.error("Session error: Tenant not found. Please log in again.");
      throw new Error("Missing tenant ID in session");
    }
    const headers = {
      ...options.headers,
      'Content-Type': 'application/json',
      'x-tenant-id': currentSession.user.tenantId,
    };
    return fetch(url, { ...options, headers });
  }, []);
  // ----------------------------------------------------------------------

  // 4. PASS tenantFetch TO THE useReportHistory HOOK
  const {
    reports,
    isLoading,
    error,
    filters,
    handleFilterChange,
    handleApplyFilters,
  } = useReportHistory(tenantFetch); // <-- This is the crucial fix

  // Permission check
  const canReadDayEnd = session && (hasPermission(session.user.role.permissions, PERMISSIONS.DAYEND_READ) || hasPermission(session.user.role.permissions, PERMISSIONS.DAYEND_MANAGE));

  // A better loading/permission flow
  if (!session) {
      return <div className="p-6 bg-gray-50 min-h-screen">Loading session...</div>;
  }

  if (!canReadDayEnd) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <p className="text-red-500 font-semibold">Access Denied: You do not have permission to view day-end history.</p>
      </div>
    );
  }

  const renderContent = () => {
    if (isLoading) {
      return <div className="p-8 text-center text-gray-500">Loading history...</div>;
    }
    if (error) {
      return <div className="p-8 text-center text-red-600">Error: {error}</div>;
    }
    if (reports.length === 0) {
      return (
        <div className="p-8 text-center text-gray-500">
          <h3 className="font-semibold text-lg">No Reports Found</h3>
          <p>No closing reports match the selected criteria.</p>
        </div>
      );
    }
    return <ReportList reports={reports} />;
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <header className="mb-8">
        <Link href="/DayendClosing" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-2 mb-2">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Day-end Closing
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Closing History</h1>
        <p className="mt-1 text-sm text-gray-600">Review past day-end financial reconciliation reports.</p>
      </header>

      <FilterBar 
        filters={filters}
        onFilterChange={handleFilterChange}
        onSubmit={handleApplyFilters}
        isLoading={isLoading}
      />
      
      <main className="mt-6 bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        {renderContent()}
      </main>
    </div>
  );
}