'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { format, startOfMonth, parseISO } from 'date-fns';
import { Loader2, AlertCircle, CalendarDays, TrendingUp, Wallet, ClipboardList, ArrowUpCircle, Tag, Package, Gift } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, TooltipProps } from 'recharts';
import { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

// --- TYPE DEFINITION ---
interface PerformanceData {
    summary: {
        totalSales: number;
        totalServiceSales: number;
        totalProductSales: number;
        totalPackageSales: number;
        totalGiftCardSales: number;
        totalCustomers: number;
    };
    dailyBreakdown: {
        date: string;
        serviceSale: number;
        productSale: number;
        packageSale: number;
        giftCardSale: number;
        customerCount: number;
        incentive: {
            target: number;
            rate: number;
            amount: number;
        };
    }[];
}

// --- UI HELPER COMPONENT ---
const SummaryCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    value: string;
    color: string;
}> = ({ icon, title, value, color }) => (
    <div className={`relative p-4 sm:p-5 rounded-2xl text-white shadow-lg overflow-hidden ${color} transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-xl`}>
        <div className="relative z-10">
            <p className="text-xs sm:text-sm text-white/90">{title}</p>
            <p className="text-xl sm:text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 text-white/60">
            {icon}
        </div>
        <div className="absolute w-20 h-20 sm:w-28 sm:h-28 bg-white/10 rounded-full -bottom-8 -right-8 sm:-bottom-10 sm:-right-10"></div>
    </div>
);

// ✅ FIX: This function now safely handles missing or invalid numbers, preventing "NaN".
const formatCurrency = (value: number | null | undefined) => {
    if (value == null || isNaN(value)) {
        return '₹0';
    }
    return `₹${Math.round(value).toLocaleString('en-IN')}`;
};

// --- MAIN PERFORMANCE PAGE ---
export default function StaffPerformancePage() {
    const { status } = useSession();
    const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState<Date>(new Date());

    useEffect(() => {
        const fetchData = async () => {
            if (status !== 'authenticated' || !startDate || !endDate) return;
            if (startDate > endDate) {
                setError("Start date cannot be after the end date.");
                return;
            }
            setIsLoading(true);
            setError(null);
            const formattedStartDate = format(startDate, 'yyyy-MM-dd');
            const formattedEndDate = format(endDate, 'yyyy-MM-dd');

            try {
                const res = await fetch(`/api/staff/performance?startDate=${formattedStartDate}&endDate=${formattedEndDate}`);
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || "Failed to fetch performance data from server.");
                }
                const data = await res.json();
                setPerformanceData(data.data);

            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [status, startDate, endDate]);

    const chartData = useMemo(() => {
        return performanceData?.dailyBreakdown.map(day => ({
            name: format(parseISO(day.date), 'dd MMM'),
            Services: day.serviceSale,
            Products: day.productSale,
            Packages: day.packageSale,
            GiftCards: day.giftCardSale,
        })).reverse() || [];
    }, [performanceData]);

    const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
                    <p className="label font-bold text-gray-800">{label}</p>
                    {payload.map((pld, index) => (
                        <p key={index} style={{ color: pld.color }} className="text-sm">
                            {`${pld.name}: ${formatCurrency(pld.value as number || 0)}`}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };


    return (
        <div className="bg-gray-50 min-h-screen space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-8">
            <header className="flex flex-col space-y-4 lg:flex-row lg:justify-between lg:items-center lg:space-y-0">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                        My Performance 
                        <span className="text-2xl">👋</span>
                    </h1>
                    <p className="mt-1 text-sm sm:text-md text-gray-600">Your sales and customer metrics at a glance.</p>
                </div>
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:gap-3">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                        <label className="font-medium text-sm text-gray-700">Date Range:</label>
                    </div>
                    <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:gap-3">
                        <input 
                            type="date" 
                            value={format(startDate, 'yyyy-MM-dd')} 
                            onChange={(e) => setStartDate(new Date(e.target.value))} 
                            className="bg-gray-100 border-transparent rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
                        />
                        <span className="text-gray-500 text-center sm:text-left">to</span>
                        <input 
                            type="date" 
                            value={format(endDate, 'yyyy-MM-dd')} 
                            onChange={(e) => setEndDate(new Date(e.target.value))} 
                            className="bg-gray-100 border-transparent rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
                        />
                    </div>
                </div>
            </header>

            {isLoading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-indigo-600" /></div>
            ) : error ? (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md flex items-center gap-3"><AlertCircle className="h-6 w-6"/><p className="font-semibold text-sm sm:text-base">{error}</p></div>
            ) : !performanceData || performanceData.dailyBreakdown.length === 0 ? (
                <div className="text-center py-20 text-gray-500"><p className="text-sm sm:text-base">No performance data found for the selected period.</p></div>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 sm:gap-6">
                        <SummaryCard
                            title="Total Sales"
                            value={formatCurrency(performanceData.summary.totalSales)}
                            icon={<Wallet size={20} className="sm:w-6 sm:h-6" />}
                            color="bg-gradient-to-br from-pink-500 to-rose-500"
                        />
                         <SummaryCard
                            title="Customers Served"
                            value={performanceData.summary.totalCustomers.toString()}
                            icon={<ClipboardList size={20} className="sm:w-6 sm:h-6" />}
                            color="bg-gradient-to-br from-cyan-400 to-sky-500"
                        />
                         <SummaryCard
                            title="Service Sales"
                            value={formatCurrency(performanceData.summary.totalServiceSales)}
                            icon={<ArrowUpCircle size={20} className="sm:w-6 sm:h-6" />}
                            color="bg-gradient-to-br from-violet-500 to-purple-500"
                        />
                         <SummaryCard
                            title="Product Sales"
                            value={formatCurrency(performanceData.summary.totalProductSales)}
                            icon={<Tag size={20} className="sm:w-6 sm:h-6" />}
                            color="bg-gradient-to-br from-orange-400 to-amber-500"
                        />
                        <SummaryCard
                            title="Package Sales"
                            value={formatCurrency(performanceData.summary.totalPackageSales)}
                            icon={<Package size={20} className="sm:w-6 sm:h-6" />}
                            color="bg-gradient-to-br from-amber-500 to-yellow-500"
                        />
                        <SummaryCard
                            title="Gift Card Sales"
                            value={formatCurrency(performanceData.summary.totalGiftCardSales)}
                            icon={<Gift size={20} className="sm:w-6 sm:h-6" />}
                            color="bg-gradient-to-br from-lime-500 to-green-500"
                        />
                    </div>
                    
                    <main className="space-y-4 sm:space-y-6">
                        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
                            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2 sm:gap-3">
                                <TrendingUp className="text-indigo-600 w-5 h-5 sm:w-6 sm:h-6" />
                                Sales Trend
                            </h2>
                            <div style={{ width: '100%', height: 250 }} className="sm:h-[300px]">
                                <ResponsiveContainer>
                                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }} className="sm:ml-0">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                        <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 10 }} className="sm:text-xs" />
                                        <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} className="sm:text-xs" tickFormatter={(value: number) => `₹${Number(value) / 1000}k`} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(239, 246, 255, 0.5)' }} />
                                        <Legend wrapperStyle={{ fontSize: '12px' }} className="sm:text-sm"/>
                                        <Bar dataKey="Services" fill="#6366F1" name="Service Sales" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Products" fill="#A855F7" name="Product Sales" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Packages" fill="#F59E0B" name="Package Sales" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="GiftCards" fill="#84CC16" name="Gift Card Sales" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 p-4 sm:p-6 border-b border-gray-200">Daily Breakdown</h2>
                            <div className="overflow-x-auto max-h-[400px]">
                                <table className="min-w-full">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Service Sales</th>
                                            <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Sales</th>
                                            <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Package Sales</th>
                                            <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Gift Card Sales</th>
                                            <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Customers</th>
                                            <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Incentive</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {performanceData.dailyBreakdown.map((day) => (
                                            <tr key={day.date} className="hover:bg-gray-50 transition-colors duration-200">
                                                <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">{format(parseISO(day.date), 'dd MMM, yyyy')}</td>
                                                <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600 text-right">{formatCurrency(day.serviceSale)}</td>
                                                <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600 text-right">{formatCurrency(day.productSale)}</td>
                                                <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600 text-right">{formatCurrency(day.packageSale)}</td>
                                                <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600 text-right">{formatCurrency(day.giftCardSale)}</td>
                                                <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600 text-center">{day.customerCount}</td>
                                                <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-bold text-green-600 text-right">{formatCurrency(day.incentive.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </main>
                </>
            )}
        </div>
    );
}