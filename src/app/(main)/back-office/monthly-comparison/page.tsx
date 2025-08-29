'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, getSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- PERMISSION IMPORTS ---
import { hasPermission, PERMISSIONS } from '@/lib/permissions'; 
import { ShieldExclamationIcon } from '@heroicons/react/24/outline';

// --- TYPE DEFINITIONS ---
interface MonthlySummary {
  month: string;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

// --- HELPER FUNCTIONS ---
const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
};

export default function MonthlyComparisonPage() {
    const { data: session, status: sessionStatus } = useSession();

    // --- PERMISSIONS LOGIC ---
    const userPermissions = session?.user?.role?.permissions || [];
    const canReadReport = hasPermission(userPermissions, PERMISSIONS.PROFIT_LOSS_READ);
    const canManageReport = hasPermission(userPermissions, PERMISSIONS.PROFIT_LOSS_MANAGE);

    const [reportData, setReportData] = useState<MonthlySummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);

    // Default to the last 3 months
    const today = new Date();
    const endDateDefault = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    const startDateDefault = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().split('T')[0];
    
    const [dateRange, setDateRange] = useState({ startDate: startDateDefault, endDate: endDateDefault });

    const tenantFetch = useCallback(async (url: string) => {
        const currentSession = await getSession();
        if (!currentSession?.user?.tenantId) throw new Error("Missing tenant ID");
        return fetch(url, { headers: { 'x-tenant-id': currentSession.user.tenantId } });
    }, []);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const { startDate, endDate } = dateRange;
            const response = await tenantFetch(`/api/reconciliation/monthly-comparison?startDate=${startDate}&endDate=${endDate}`);
            if (!response.ok) throw new Error("Failed to fetch comparison data.");
            const data = await response.json();
            setReportData(data);
        } catch (err) {
            if (err instanceof Error) toast.error(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [dateRange, tenantFetch]);

    useEffect(() => {
        // Fetch data only if authenticated and has at least read permission
        if (sessionStatus === 'authenticated' && canReadReport) {
            fetchData();
        } else if (sessionStatus !== 'loading') {
            // If not loading and not permitted, ensure loading is false
            setIsLoading(false);
        }
    }, [sessionStatus, fetchData, canReadReport]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDateRange(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleDownload = async (format: 'xlsx' | 'pdf') => {
        if (reportData.length === 0) {
            toast.warn("No data available to download.");
            return;
        }

        setIsDownloading(true);
        toast.info(`Generating your ${format.toUpperCase()} report...`);
        
        try {
            const { startDate, endDate } = dateRange;
            const url = `/api/reconciliation/monthly-comparison/download?startDate=${startDate}&endDate=${endDate}&format=${format}`;

            const response = await tenantFetch(url);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to generate the report.`);
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = downloadUrl;
            anchor.download = `Monthly_Comparison_${startDate}_to_${endDate}.${format}`;
            
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

    const metrics = [
        { key: 'totalRevenue', label: 'Total Revenue' },
        { key: 'totalExpenses', label: 'Total Expenses' },
        { key: 'netProfit', label: 'Net Profit / Loss' },
    ];

    // Handle loading and access denied states
    if (sessionStatus === 'loading') {
        return <div className="p-8 text-center text-gray-600">Loading user session...</div>;
    }

    if (sessionStatus === 'authenticated' && !canReadReport) {
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
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Monthly P&L Comparison</h1>
            
            {/* Filter and Action Bar */}
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-6 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <label>From:</label>
                    <input 
                        type="date" 
                        name="startDate" 
                        value={dateRange.startDate} 
                        onChange={handleDateChange} 
                        className="p-2 border rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={!canManageReport}
                        title={!canManageReport ? "You don't have permission to change report parameters" : ""}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <label>To:</label>
                    <input 
                        type="date" 
                        name="endDate" 
                        value={dateRange.endDate} 
                        onChange={handleDateChange} 
                        className="p-2 border rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={!canManageReport}
                        title={!canManageReport ? "You don't have permission to change report parameters" : ""}
                    />
                </div>
                <button 
                    onClick={fetchData} 
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    disabled={!canManageReport}
                    title={!canManageReport ? "You don't have permission to generate new reports" : ""}
                >
                    Generate Report
                </button>

                <div className="sm:ml-auto flex items-center gap-4">
                    <button 
                        onClick={() => handleDownload('xlsx')} 
                        disabled={isDownloading || isLoading || reportData.length === 0 || !canManageReport}
                        title={!canManageReport ? "You do not have permission to download reports." : ""}
                        className="bg-green-600 text-white px-3 py-2 rounded-md text-sm hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm4 0v2h8V6H6zm8 4H6v2h8v-2z" /></svg>
                        {isDownloading ? 'Generating...' : 'Excel'}
                    </button>
                    <button 
                        onClick={() => handleDownload('pdf')}
                        disabled={isDownloading || isLoading || reportData.length === 0 || !canManageReport}
                        title={!canManageReport ? "You do not have permission to download reports" : ""}
                        className="bg-red-600 text-white px-3 py-2 rounded-md text-sm hover:bg-red-700 disabled:bg-gray-400 flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2H6a2 2 0 01-2-2V4zm2 0v1h8V4H6zm0 3v1h8V7H6zm0 3v1h5v-1H6z" clipRule="evenodd" /></svg>
                        {isDownloading ? 'Generating...' : 'PDF'}
                    </button>
                </div>
            </div>
            
            {/* Comparison Table */}
            <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
                {isLoading ? <div className="text-center py-20">Loading Report...</div> : reportData.length === 0 ? <div className="text-center py-20 text-gray-500">No data found for this period.</div> : (
                    <table className="min-w-full">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Metric</th>
                                {reportData.map(monthData => (
                                    <th key={monthData.month} className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase">
                                        {formatMonth(monthData.month)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {metrics.map(metric => (
                                <tr key={metric.key} className={metric.key === 'netProfit' ? 'bg-gray-50 font-bold' : ''}>
                                    <td className="px-6 py-4 font-medium text-gray-800">{metric.label}</td>
                                    {reportData.map(monthData => (
                                        <td key={monthData.month} className={`px-6 py-4 text-right ${monthData[metric.key] < 0 ? 'text-red-600' : ''}`}>
                                            {formatCurrency(monthData[metric.key])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}