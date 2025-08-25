'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { Loader2, AlertCircle, IndianRupee, Gift, Target, CheckCircle, XCircle } from 'lucide-react';

const formatCurrency = (value: number) => `₹${value.toFixed(2)}`;

// --- Helper Component ---
const IncentiveCard: React.FC<{ title: string, data: any }> = ({ title, data }) => {
    if (!data || Object.keys(data).length === 0) {
        return (
             <div className="bg-white p-6 rounded-xl shadow-sm border">
                <h3 className="font-bold text-lg text-gray-800 mb-4">{title}</h3>
                <p className="text-center text-gray-500 py-8">No data available to calculate.</p>
            </div>
        );
    }

    const { target, achieved, isTargetMet, incentiveAmount, appliedRate } = data;
    
    return (
        <div className={`bg-white p-6 rounded-xl shadow-sm border-l-4 ${isTargetMet ? 'border-green-500' : 'border-red-500'}`}>
            <div className="flex justify-between items-start">
                <h3 className="font-bold text-lg text-gray-800">{title}</h3>
                 <span className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full ${isTargetMet ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                    {isTargetMet ? <CheckCircle size={14} className="mr-1" /> : <XCircle size={14} className="mr-1" />}
                    {isTargetMet ? 'Target Met' : 'Target Missed'}
                </span>
            </div>
            <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Target:</span> <span className="font-medium">{formatCurrency(target)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Achieved:</span> <span className="font-medium">{formatCurrency(achieved)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Applied Rate:</span> <span className="font-medium">{(appliedRate * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between items-center pt-3 mt-3 border-t">
                    <span className="text-gray-600 font-semibold">Incentive Earned:</span>
                    <span className="text-xl font-bold text-green-600">{formatCurrency(incentiveAmount)}</span>
                </div>
            </div>
        </div>
    );
};

// --- Main Page Component ---
export default function StaffIncentivesPage() {
    const { status } = useSession();
    const [incentiveData, setIncentiveData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [date, setDate] = useState<Date>(new Date());

    useEffect(() => {
        const fetchIncentives = async () => {
            if (status !== 'authenticated' || !date) return;

            setIsLoading(true);
            setError(null);
            
            const formattedDate = format(date, 'yyyy-MM-dd');
            
            try {
                const res = await fetch(`/api/staff/incentives?date=${formattedDate}`);
                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.error || "Failed to calculate incentives.");
                }
                setIncentiveData(data.data);
            } catch (err: any) {
                setError(err.message);
                setIncentiveData(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchIncentives();
    }, [status, date]);

    const totalIncentive = (incentiveData?.daily?.incentiveAmount || 0) + (incentiveData?.monthly?.incentiveAmount || 0);

    return (
        <div className="space-y-8 p-4 md:p-8">
            <header>
                <h1 className="text-3xl font-bold text-gray-900">My Incentives</h1>
                <p className="mt-1 text-md text-gray-600">View your calculated incentives for a specific day.</p>
            </header>

            <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-4">
                 <label htmlFor="incentive-date" className="font-medium text-sm">Select Date:</label>
                 <input 
                    id="incentive-date"
                    type="date"
                    value={format(date, 'yyyy-MM-dd')}
                    onChange={(e) => setDate(new Date(e.target.value))}
                    className="bg-gray-50 border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            {isLoading ? (
                <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-500" /></div>
            ) : error ? (
                <div className="text-red-600 bg-red-50 p-4 rounded-md flex items-center gap-2"><AlertCircle/> {error}</div>
            ) : (
                <>
                    <div className="bg-white p-6 rounded-xl shadow-sm border text-center">
                        <p className="text-sm text-gray-500">Total Incentive Earned on {format(date, 'dd MMM, yyyy')}</p>
                        <p className="text-4xl font-bold text-indigo-600 mt-2">{formatCurrency(totalIncentive)}</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <IncentiveCard title="Daily Incentive" data={incentiveData?.daily} />
                        <IncentiveCard title="Monthly Incentive (To Date)" data={incentiveData?.monthly} />
                    </div>
                </>
            )}
        </div>
    );
}