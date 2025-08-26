'use client';

import React, { useState, useEffect } from 'react';
// MODIFIED: Get the full session object to access tenantId
import { useSession } from 'next-auth/react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Loader2, AlertCircle, IndianRupee, Gift, Target, CheckCircle, XCircle, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';

// --- (Helper Functions and Components like formatCurrency, IncentiveCard, DashboardCard remain unchanged) ---

const formatCurrency = (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) {
        return '₹0.00';
    }
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const IncentiveCard: React.FC<{ title: string, data: any, icon: React.ReactNode }> = ({ title, data, icon }) => {
    if (!data || Object.keys(data).length === 0) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-md border transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-xl">
                <div className="flex items-center gap-4 mb-4">
                    <div className="bg-gray-100 text-gray-600 p-3 rounded-full">{icon}</div>
                    <h3 className="font-bold text-lg text-gray-800">{title}</h3>
                </div>
                <div className="text-center text-gray-500 py-10">
                    <p>No data available to calculate.</p>
                </div>
            </div>
        );
    }

    const { target, achieved, isTargetMet, incentiveAmount, appliedRate } = data;

    return (
        <div className={`bg-white p-6 rounded-xl shadow-md border-l-8 ${isTargetMet ? 'border-green-500' : 'border-red-500'} transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-xl`}>
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${isTargetMet ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {icon}
                    </div>
                    <div>
                        <h3 className="font-bold text-xl text-gray-800">{title}</h3>
                        <span className={`flex items-center text-xs font-semibold mt-1 ${isTargetMet ? 'text-green-700' : 'text-red-700'}`}>
                            {isTargetMet ? <CheckCircle size={14} className="mr-1" /> : <XCircle size={14} className="mr-1" />}
                            {isTargetMet ? 'Target Met' : 'Target Missed'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="space-y-3 text-sm my-6">
                <div className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                    <span className="text-gray-500 flex items-center"><Target size={16} className="mr-2"/>Target</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(target)}</span>
                </div>
                <div className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                    <span className="text-gray-500 flex items-center"><CheckCircle size={16} className="mr-2"/>Achieved</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(achieved)}</span>
                </div>
                <div className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                    <span className="text-gray-500 flex items-center"><Gift size={16} className="mr-2"/>Applied Rate</span>
                    <span className="font-semibold text-gray-900">{(appliedRate * 100).toFixed(0)}%</span>
                </div>
            </div>
            
            <div className="text-center pt-4 mt-4 border-t">
                <p className="text-gray-600 font-semibold mb-1">Incentive Earned</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(incentiveAmount)}</p>
            </div>
        </div>
    );
};

const DashboardCard: React.FC<{ title: string, amount: number, period: string, icon: React.ReactNode }> = ({ title, amount, period, icon }) => (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-2xl shadow-lg flex flex-col justify-between h-full transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-xl">
        <div>
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-indigo-200">{title}</h2>
                <span className="text-indigo-200">{icon}</span>
            </div>
            <p className="text-4xl font-extrabold my-2 tracking-tight">{formatCurrency(amount)}</p>
        </div>
        <p className="text-indigo-200 font-light mt-2">{period}</p>
    </div>
);


// --- Main Page Component ---
export default function StaffIncentivesPage() {
    // MODIFIED: Get the full session object to use the tenantId
    const { data: session, status } = useSession();
    const [dailyIncentiveData, setDailyIncentiveData] = useState<any>(null);
    const [monthlyTotal, setMonthlyTotal] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [date, setDate] = useState<Date>(new Date());

    useEffect(() => {
        // --- MODIFIED: This function now fetches total monthly incentive from your dashboard API ---
        const fetchMonthlyTotal = async () => {
             if (!session?.user?.tenantId) return;

             try {
                // Using the API route from your StaffDashboardPage
                const res = await fetch(`/api/stafflogin-dashboard`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-tenant-id': session.user.tenantId,
                    },
                });
                const data = await res.json();
                 if (!res.ok || !data.success) {
                    throw new Error(data.error || "Failed to fetch monthly total.");
                }
                // Set the total from the API response
                setMonthlyTotal(data.data?.incentives?.totalEarned || 0);
             } catch (err) {
                console.error("Could not fetch monthly total:", err);
                setMonthlyTotal(0); // Reset on error
             }
        };

        const fetchDailyIncentives = async () => {
            if (!date) return;
            setIsLoading(true);
            setError(null);
            const formattedDate = format(date, 'yyyy-MM-dd');
            try {
                const res = await fetch(`/api/staff/incentives?date=${formattedDate}`);
                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.error || "Failed to fetch daily incentives.");
                }
                setDailyIncentiveData(data.data);
            } catch (err: any) {
                setError(err.message);
                setDailyIncentiveData(null);
            } finally {
                setIsLoading(false);
            }
        };
        
        if (status === 'authenticated') {
            fetchDailyIncentives();
            fetchMonthlyTotal();
        }

    }, [status, session, date]);

    const totalIncentiveForDay = (dailyIncentiveData?.daily?.incentiveAmount || 0) + (dailyIncentiveData?.monthly?.incentiveAmount || 0);

    return (
        <div className="bg-gray-50 min-h-screen p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">My Incentives</h1>
                        <p className="mt-1 text-md text-gray-600">Your daily and monthly performance rewards.</p>
                    </div>
                     <div className="mt-4 md:mt-0 bg-white p-3 rounded-xl shadow-md border flex items-center gap-3">
                        <CalendarIcon className="text-gray-500"/>
                        <input 
                            type="date"
                            value={format(date, 'yyyy-MM-dd')}
                            onChange={(e) => setDate(new Date(e.target.value))}
                            className="bg-transparent border-none rounded-lg text-md font-semibold text-gray-800 focus:outline-none focus:ring-0"
                        />
                    </div>
                </header>

                {isLoading ? (
                    <div className="flex justify-center items-center py-40">
                        <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
                    </div>
                ) : error ? (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-6 rounded-xl flex items-center gap-4 shadow-md">
                        <AlertCircle className="h-8 w-8"/>
                        <div>
                            <p className="font-bold">Error</p>
                            <p>{error}</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* --- Dashboard Section --- */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           <DashboardCard 
                                title="Total Incentive This Month"
                                amount={monthlyTotal}
                                period={`For ${format(date, 'MMMM yyyy')}`}
                                icon={<TrendingUp size={28} />}
                           />
                           <DashboardCard 
                                title="Incentive Earned Today"
                                amount={totalIncentiveForDay}
                                period={`On ${format(date, 'dd MMMM, yyyy')}`}
                                icon={<IndianRupee size={28} />}
                           />
                        </div>

                        {/* --- Incentive Details --- */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <IncentiveCard 
                                title="Daily Incentive" 
                                data={dailyIncentiveData?.daily}
                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                            />
                            <IncentiveCard 
                                title="Monthly Incentive (To Date)" 
                                data={dailyIncentiveData?.monthly}
                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}