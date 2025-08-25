'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, AlertCircle, IndianRupee, Wallet, PlusCircle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function StaffPayoutsPage() {
    const { data: session, status } = useSession(); // ✅ THE FIX: Get the session object
    const [history, setHistory] = useState<any[]>([]);
    const [balance, setBalance] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    const fetchData = async () => {
        // ✅ THE FIX: Make sure session and tenantId are available
        if (status !== 'authenticated' || !session?.user?.tenantId) return;
        setIsLoading(true);
        setError(null);
        
        // ✅ THE FIX: Add headers with tenantId to API requests
        const headers = { 'x-tenant-id': session.user.tenantId };

        try {
            const [historyRes, balanceRes] = await Promise.all([
                fetch('/api/staff/payouts', { headers }),
                fetch('/api/staff/payouts?action=balance', { headers })
            ]);
            const historyData = await historyRes.json();
            const balanceData = await balanceRes.json();
            if (!historyRes.ok || !historyData.success) throw new Error(historyData.error || 'Failed to load history.');
            if (!balanceRes.ok || !balanceData.success) throw new Error(balanceData.error || 'Failed to load balance.');
            
            setHistory(historyData.data);
            setBalance(balanceData.data.balance);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'authenticated') {
            fetchData();
        }
    }, [status, session]); // ✅ THE FIX: Add session to dependency array
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // ✅ THE FIX: Ensure session and tenantId are available before submitting
        if (!session?.user?.tenantId) {
            setFormError('Could not identify tenant. Please re-login.');
            return;
        }
        setIsSubmitting(true);
        setFormError(null);
        try {
            const res = await fetch('/api/staff/payouts', {
                method: 'POST',
                // ✅ THE FIX: Add headers to the POST request
                headers: { 
                    'Content-Type': 'application/json',
                    'x-tenant-id': session.user.tenantId,
                },
                body: JSON.stringify({ amount: Number(amount), reason })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Request failed.');
            }
            // Success
            setAmount('');
            setReason('');
            setShowForm(false);
            fetchData(); // Refresh all data
        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // ... (getStatusChip and JSX remain unchanged) ...
    const getStatusChip = (payoutStatus: string) => {
        switch (payoutStatus) {
            case 'approved': return <span className="flex items-center text-xs font-semibold px-2 py-1 rounded-full text-green-700 bg-green-100"><CheckCircle size={14} className="mr-1" />Approved</span>;
            case 'rejected': return <span className="flex items-center text-xs font-semibold px-2 py-1 rounded-full text-red-700 bg-red-100"><XCircle size={14} className="mr-1" />Rejected</span>;
            default: return <span className="flex items-center text-xs font-semibold px-2 py-1 rounded-full text-yellow-700 bg-yellow-100"><Clock size={14} className="mr-1" />Pending</span>;
        }
    };

    return (
        <div className="space-y-8 p-4 md:p-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center">
                 <div>
                    <h1 className="text-3xl font-bold text-gray-900">My Payouts</h1>
                    <p className="mt-1 text-md text-gray-600">Request payouts from your incentive balance.</p>
                </div>
                 <button onClick={() => setShowForm(!showForm)} className="mt-4 md:mt-0 bg-black text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-gray-800 transition-colors flex items-center gap-2">
                    <PlusCircle size={18} /> {showForm ? 'Cancel' : 'New Payout Request'}
                </button>
            </header>

            {isLoading ? <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-500" /></div> : error ? <div className="text-red-600 bg-red-50 p-4 rounded-md flex items-center gap-2"><AlertCircle/> {error}</div> : (
                <>
                    <div className="bg-white p-6 rounded-xl shadow-sm border text-center">
                        <p className="text-sm text-gray-500 flex items-center justify-center gap-2"><Wallet/> Available Balance</p>
                        <p className="text-4xl font-bold text-indigo-600 mt-2">{formatCurrency(balance)}</p>
                    </div>

                    {showForm && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border">
                             <h2 className="text-xl font-semibold mb-4">New Request Form</h2>
                             <form onSubmit={handleSubmit} className="space-y-4">
                                {formError && <div className="text-red-600 text-sm p-3 bg-red-50 rounded-md">{formError}</div>}
                                <div>
                                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                                    <input type="number" id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                                </div>
                                <div>
                                    <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">Reason for Request</label>
                                    <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} className="w-full p-2 border border-gray-300 rounded-md shadow-sm"></textarea>
                                </div>
                                <div className="text-right">
                                    <button type="submit" disabled={isSubmitting} className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300">
                                        {isSubmitting ? 'Submitting...' : 'Submit Request'}
                                    </button>
                                </div>
                             </form>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border">
                        <h2 className="text-xl font-semibold p-6 border-b">Request History</h2>
                        <div className="space-y-4 p-6">
                            {history.length === 0 ? <p className="text-center text-gray-500 py-8">No payout requests found.</p> : history.map(p => (
                                <div key={p._id} className="p-4 border rounded-lg">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-lg text-gray-800">{formatCurrency(p.amount)}</p>
                                            <p className="text-sm text-gray-600 mt-1">{p.reason}</p>
                                        </div>
                                        {getStatusChip(p.status)}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-3">Requested on {format(new Date(p.createdAt), 'dd MMM, yyyy')}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}