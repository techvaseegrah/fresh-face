'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession, getSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { IDailyReconciliation } from '@/models/DailyReconciliation'; // Your existing type import

// PERMISSION & ICON IMPORTS
import { hasPermission, PERMISSIONS } from '@/lib/permissions'; 
import { ShieldExclamationIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

// --- Helper Functions ---
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (dateString: Date) => {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const DiffCell = ({ value }: { value: number }) => (
  <td className={`px-4 py-3 text-center font-semibold ${value !== 0 ? 'text-red-600' : 'text-green-700'}`}>
    {formatCurrency(value)}
  </td>
);

export default function ReconciliationHistoryPage() {
  const { data: session, status: sessionStatus } = useSession();

  const userPermissions = session?.user?.role?.permissions || [];
  const canReadReconciliation = hasPermission(userPermissions, PERMISSIONS.RECONCILIATION_READ);

  const [reports, setReports] = useState<IDailyReconciliation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null); // State for expandable rows

  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  const [dateRange, setDateRange] = useState({ startDate: firstDayOfMonth, endDate: lastDayOfMonth });
  
  const tenantFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const currentSession = await getSession();
    if (!currentSession?.user?.tenantId) {
      toast.error("Session error: Tenant not found.");
      throw new Error("Missing tenant ID in session");
    }
    const headers = { ...options.headers, 'x-tenant-id': currentSession.user.tenantId };
    return fetch(url, { ...options, headers });
  }, []);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const { startDate, endDate } = dateRange;
      const response = await tenantFetch(`/api/reconciliation/history?startDate=${startDate}&endDate=${endDate}`);
      if (!response.ok) throw new Error("Failed to fetch reconciliation history.");
      const data = await response.json();
      setReports(data);
    } catch (err) {
      if (err instanceof Error) toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, tenantFetch]);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && canReadReconciliation) {
      fetchHistory();
    } else if (sessionStatus !== 'loading') {
      setIsLoading(false);
    }
  }, [sessionStatus, fetchHistory, canReadReconciliation]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateRange(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleDownload = async (format: 'xlsx' | 'pdf') => {
    // IMPORTANT: Remember to update the backend download API to include remarks columns.
    if (reports.length === 0) {
      toast.warn("No data available to download.");
      return;
    }
    setIsDownloading(true);
    toast.info(`Generating your ${format.toUpperCase()} report...`);
    try {
      const { startDate, endDate } = dateRange;
      const url = `/api/reconciliation/download?startDate=${startDate}&endDate=${endDate}&format=${format}`;
      const response = await tenantFetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to generate the ${format.toUpperCase()} report.`);
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `Reconciliation_Report_${startDate}_to_${endDate}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(anchor);
    } catch (err) {
      if (err instanceof Error) toast.error(err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRowClick = (reportId: string) => {
    setExpandedRow(currentId => (currentId === reportId ? null : reportId));
  };
  
  if (sessionStatus === 'loading') {
    return <div className="p-8 text-center text-gray-600">Loading session...</div>;
  }
  
  if (sessionStatus === 'authenticated' && !canReadReconciliation) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)] bg-gray-50 p-4">
        <div className="text-center bg-white p-10 rounded-xl shadow-md border border-red-200">
          <ShieldExclamationIcon className="mx-auto h-16 w-16 text-red-400" />
          <h1 className="mt-4 text-2xl font-bold text-gray-800">Access Denied</h1>
          <p className="mt-2 text-gray-600">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-screen-xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Reconciliation History</h1>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label htmlFor="startDate" className="font-semibold">From:</label>
              <input type="date" name="startDate" value={dateRange.startDate} onChange={handleDateChange} className="p-2 border rounded-md" />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="endDate" className="font-semibold">To:</label>
              <input type="date" name="endDate" value={dateRange.endDate} onChange={handleDateChange} className="p-2 border rounded-md" />
            </div>
            <button onClick={fetchHistory} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
              Apply Filter
            </button>
            
            <div className="sm:ml-auto flex items-center gap-4">
              <button 
                onClick={() => handleDownload('xlsx')} 
                disabled={isDownloading || isLoading || reports.length === 0}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm4 0v2h8V6H6zm8 4H6v2h8v-2z" /></svg>
                {isDownloading ? 'Generating...' : 'Download Excel'}
              </button>
              <button 
                onClick={() => handleDownload('pdf')}
                disabled={isDownloading || isLoading || reports.length === 0}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2H6a2 2 0 01-2-2V4zm2 0v1h8V4H6zm0 3v1h8V7H6zm0 3v1h5v-1H6z" clipRule="evenodd" /></svg>
                {isDownloading ? 'Generating...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-20">Loading history...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-20 text-gray-500">No reports found for the selected date range.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="w-12 px-4 py-3"></th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Total Sales</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Cash (System)</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Expenses</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Closing Cash</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase bg-red-50">Cash Diff</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase bg-red-50">GPay Diff</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase bg-red-50">Card Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reports.map((report) => {
                  const isExpanded = expandedRow === (report._id as string);
                  return (
                    <React.Fragment key={report._id as string}>
                      <tr onClick={() => handleRowClick(report._id as string)} className="hover:bg-gray-50 cursor-pointer">
                        <td className="px-4 py-3 text-center">
                          <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">{formatDate(report.date)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(report.software.total)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(report.software.cash)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(report.cash.expenses)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(report.cash.closingCash)}</td>
                        <DiffCell value={report.differences.cashDiff} />
                        <DiffCell value={report.differences.gpayDiff} />
                        <DiffCell value={report.differences.cardDiff} />
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={9} className="p-4">
                            {(report.bank.bankRemarks || report.cash.cashRemarks) ? (
                              <div className="bg-white p-3 rounded-md border border-gray-200">
                                <h4 className="font-semibold text-sm text-gray-700 mb-2">Remarks:</h4>
                                {report.bank.bankRemarks && (
                                  <div className="mb-2">
                                    <p className="text-xs font-bold text-purple-700">Bank Deposit:</p>
                                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{report.bank.bankRemarks}</p>
                                  </div>
                                )}
                                {report.cash.cashRemarks && (
                                  <div>
                                    <p className="text-xs font-bold text-pink-700">Cash Reconciliation:</p>
                                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{report.cash.cashRemarks}</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center text-sm text-gray-500">No remarks were added for this day.</div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}