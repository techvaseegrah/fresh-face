'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, getSession } from 'next-auth/react';
import { toast } from 'react-toastify';

// --- PERMISSION IMPORTS (ADDED) ---
import { hasPermission, PERMISSIONS } from '@/lib/permissions'; 
import { ShieldExclamationIcon } from '@heroicons/react/24/outline';

// --- TYPE DEFINITIONS ---
interface PnlData {
  totalRevenue: number;
  revenueBreakdown: { services: number; products: number; };
  totalExpenses: number;
  expensesBreakdown: { category: string; totalAmount: number; }[];
  netProfit: number;
}

// --- HELPER COMPONENTS ---
const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

const SummaryCard = ({ title, value, colorClass }: { title: string, value: number, colorClass: string }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
        <p className="text-sm text-gray-500">{title}</p>
        <p className={`text-3xl font-bold ${colorClass}`}>{formatCurrency(value)}</p>
    </div>
);

const BreakdownTable = ({ title, data, valueKey, labelKey }: { title: string, data: any[], valueKey: string, labelKey: string }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">{title}</h3>
        <div className="space-y-3">
            {data.length > 0 ? data.map(item => (
                <div key={item[labelKey]} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item[labelKey]}</span>
                    <span className="font-medium">{formatCurrency(item[valueKey])}</span>
                </div>
            )) : <p className="text-sm text-gray-500">No data for this period.</p>}
        </div>
    </div>
);


export default function PnlSummaryPage() {
    const { data: session, status: sessionStatus } = useSession();
    
    // --- PERMISSIONS LOGIC (ADDED) ---
    const userPermissions = session?.user?.role?.permissions || [];
    const canReadReport = hasPermission(userPermissions, PERMISSIONS.PROFIT_LOSS_READ);
    
    const [pnlData, setPnlData] = useState<PnlData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedDate, setSelectedDate] = useState({
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1
    });

    const tenantFetch = useCallback(async (url: string) => {
        const currentSession = await getSession();
        if (!currentSession?.user?.tenantId) throw new Error("Missing tenant ID");
        return fetch(url, { headers: { 'x-tenant-id': currentSession.user.tenantId } });
    }, []);

    useEffect(() => {
        // PERMISSION CHECK: Block API call if not authenticated or not permitted
        if (sessionStatus !== 'authenticated' || !canReadReport) {
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const { year, month } = selectedDate;
                const response = await tenantFetch(`/api/reconciliation/pnl-summary?year=${year}&month=${month}`);
                if (!response.ok) throw new Error("Failed to fetch P&L summary.");
                const data = await response.json();
                setPnlData(data);
            } catch (err) {
                if (err instanceof Error) toast.error(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [selectedDate, sessionStatus, tenantFetch, canReadReport]); // Added canReadReport to dependency array

    const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedDate(prev => ({ ...prev, [e.target.name]: parseInt(e.target.value, 10) }));
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

    const revenueForTable = pnlData ? [
        { name: 'From Services', value: pnlData.revenueBreakdown.services },
        { name: 'From Products', value: pnlData.revenueBreakdown.products },
    ] : [];

    // --- RENDER LOGIC FOR LOADING AND PERMISSIONS (ADDED) ---
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Profit & Loss Summary</h1>
                <div className="flex items-center gap-4 mt-4 md:mt-0">
                    <select name="month" value={selectedDate.month} onChange={handleDateChange} className="p-2 border rounded-md bg-white">
                        {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                    </select>
                    <select name="year" value={selectedDate.year} onChange={handleDateChange} className="p-2 border rounded-md bg-white">
                        {years.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                </div>
            </div>

            {isLoading ? <div className="text-center py-20">Loading Report...</div> : !pnlData ? <div className="text-center py-20 text-red-500">Could not load report data.</div> : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <SummaryCard title="TOTAL REVENUE" value={pnlData.totalRevenue} colorClass="text-green-600" />
                        <SummaryCard title="TOTAL EXPENSES" value={pnlData.totalExpenses} colorClass="text-red-600" />
                        <SummaryCard title="NET PROFIT / LOSS" value={pnlData.netProfit} colorClass={pnlData.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'} />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <BreakdownTable title="Revenue Breakdown" data={revenueForTable} valueKey="value" labelKey="name" />
                        <BreakdownTable title="Expenses Breakdown" data={pnlData.expensesBreakdown} valueKey="totalAmount" labelKey="category" />
                    </div>
                </div>
            )}
        </div>
    );
}