'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { format, startOfMonth } from 'date-fns';
import { Loader2, AlertCircle, IndianRupee, Users, ShoppingBag, BarChart2, CalendarDays, Gift } from 'lucide-react';

// ✅ ADDED TYPE: Define the shape of the API data for type safety.
interface PerformanceData {
    summary: {
        totalSales: number;
        totalServiceSales: number;
        totalProductSales: number;
        totalCustomers: number;
    };
    dailyBreakdown: {
        date: string;
        serviceSale: number;
        productSale: number;
        customerCount: number;
        incentive: {
            target: number;
            rate: number;
            amount: number;
        };
    }[];
}

// --- Helper Components (Unchanged) ---
const StatCard: React.FC<{ icon: React.ReactNode; title: string; value: string; }> = ({ icon, title, value }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border flex items-center gap-5">
        <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-lg">{icon}</div>
        <div>
            <p className="text-sm text-gray-500 font-medium">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

const formatCurrency = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

// --- Main Performance Page ---
export default function StaffPerformancePage() {
    const { status } = useSession();
    // ✅ ADDED TYPE: Changed useState<any> to useState<PerformanceData | null>
    const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState<Date>(new Date());

    useEffect(() => {
        const fetchData = async () => {
            if (status !== 'authenticated' || !startDate || !endDate) return;
            if (startDate > endDate) { setError("Start date cannot be after the end date."); return; }
            setIsLoading(true); setError(null);
            const formattedStartDate = format(startDate, 'yyyy-MM-dd');
            const formattedEndDate = format(endDate, 'yyyy-MM-dd');
            
            try {
                const res = await fetch(`/api/staff/performance?startDate=${formattedStartDate}&endDate=${formattedEndDate}`);
                const data = await res.json();
                // This error handling is excellent, no changes needed here.
                if (!res.ok) { // Check for non-2xx status codes
                    throw new Error(data.error || "Failed to fetch performance data from server.");
                }
                setPerformanceData(data.data);
            } catch (err: any) { 
                setError(err.message); 
            } finally { 
                setIsLoading(false); 
            }
        };
        fetchData();
    }, [status, startDate, endDate]);

    // --- The rest of your JSX rendering is unchanged, but now it's type-safe! ---
    return (
        <div className="space-y-8 p-4 md:p-8">
            <header>
                <h1 className="text-3xl font-bold text-gray-900">My Performance</h1>
                <p className="mt-1 text-md text-gray-600">Your sales and customer metrics for the selected period.</p>
            </header>

            <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-col md:flex-row items-center gap-4">
                <div className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-gray-500" /><label className="font-medium text-sm">Date Range:</label></div>
                <input type="date" value={format(startDate, 'yyyy-MM-dd')} onChange={(e) => setStartDate(new Date(e.target.value))} className="bg-gray-50 border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                <span className="text-gray-500">to</span>
                <input type="date" value={format(endDate, 'yyyy-MM-dd')} onChange={(e) => setEndDate(new Date(e.target.value))} className="bg-gray-50 border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            </div>

            {isLoading ? <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-500" /></div> : error ? <div className="text-red-600 bg-red-50 p-4 rounded-md flex items-center gap-2"><AlertCircle/> {error}</div> : !performanceData ? <div className="text-center py-20 text-gray-500">No performance data found.</div> : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard icon={<IndianRupee size={24}/>} title="Total Sales" value={formatCurrency(performanceData.summary.totalSales)} />
                        <StatCard icon={<Users size={24}/>} title="Customers Served" value={performanceData.summary.totalCustomers.toString()} />
                        <StatCard icon={<BarChart2 size={24}/>} title="Service Sales" value={formatCurrency(performanceData.summary.totalServiceSales)} />
                        <StatCard icon={<ShoppingBag size={24}/>} title="Product Sales" value={formatCurrency(performanceData.summary.totalProductSales)} />
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border">
                        <h2 className="text-xl font-semibold p-6 border-b">Daily Breakdown</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Service Sales</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Product Sales</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Customers</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Target</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rate</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Incentive</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {/* No 'any' needed here anymore! */}
                                    {performanceData.dailyBreakdown.map((day) => (
                                        <tr key={day.date}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{format(new Date(day.date), 'dd MMM, yyyy')}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">{formatCurrency(day.serviceSale)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">{formatCurrency(day.productSale)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">{day.customerCount}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatCurrency(day.incentive.target)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{(day.incentive.rate * 100).toFixed(0)}%</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600 text-right">{formatCurrency(day.incentive.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}