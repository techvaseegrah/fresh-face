'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion, Variants } from 'framer-motion'; 
import { 
    Loader2, 
    AlertCircle, 
    Wallet, 
    PlusCircle, 
    Clock, 
    CheckCircle, 
    XCircle, 
    TrendingUp,
    TrendingDown
} from 'lucide-react';
import { format } from 'date-fns';


// ===================================================================
// StatCard Component (No changes needed here)
// ===================================================================
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
}

const cardVariants: Variants = {
  hover: {
    scale: 1.05,
    y: -5,
    transition: { type: "spring", stiffness: 300, damping: 15 },
  },
};

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, gradient }) => {
  return (
    <motion.div
      variants={cardVariants}
      whileHover="hover"
      className={`relative p-6 rounded-2xl text-white shadow-lg overflow-hidden bg-gradient-to-br ${gradient}`}
    >
      <div className="absolute top-0 right-0 -m-4 w-24 h-24 bg-white/10 rounded-full" />
      <div className="absolute top-4 right-4 w-12 h-12 flex items-center justify-center bg-white/20 rounded-full">
        {icon}
      </div>
      <div className="relative z-10">
        <p className="text-sm font-medium uppercase opacity-90">{title}</p>
        <p className="text-4xl font-bold mt-2">{value}</p>
      </div>
    </motion.div>
  );
};

// Helper function to format currency
const formatCurrency = (value: number | null | undefined) => {
    if (typeof value !== 'number') return '₹0.00';
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Interface for payout history items
interface Payout {
    _id: string;
    amount: number;
    reason: string;
    status: 'approved' | 'rejected' | 'pending';
    createdAt: string;
}

export default function StaffPayoutsPage() {
    const { data: session, status } = useSession();
    const [history, setHistory] = useState<Payout[]>([]);
    
    // States for the dashboard cards
    const [totalEarned, setTotalEarned] = useState(0);
    const [totalPaid, setTotalPaid] = useState(0);
    const [balance, setBalance] = useState(0);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    // ✅ MODIFIED: Simplified and corrected data fetching logic
    const fetchData = async () => {
        if (status !== 'authenticated') return;
        setIsLoading(true);
        setError(null);
        
        try {
            // A single API call now gets all the data we need
            const res = await fetch('/api/staff/payouts');
            const result = await res.json();

            if (!res.ok || !result.success) {
                throw new Error(result.error || 'Failed to load payout data.');
            }
            
            // Set all state from the single response object
            setHistory(result.data.history);
            setTotalEarned(result.data.summary.totalEarned);
            setTotalPaid(result.data.summary.totalPaid);
            setBalance(result.data.summary.balance);

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
    }, [status]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setFormError(null);
        try {
            const res = await fetch('/api/staff/payouts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: Number(amount), reason })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Request failed.');
            }
            setAmount('');
            setReason('');
            setShowForm(false);
            fetchData(); // Refresh all data after successful submission
        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const getStatusChip = (payoutStatus: string) => {
        switch (payoutStatus) {
            case 'approved': return <span className="flex items-center text-xs font-semibold px-2 py-1 rounded-full text-green-700 bg-green-100"><CheckCircle size={14} className="mr-1" />Approved</span>;
            case 'rejected': return <span className="flex items-center text-xs font-semibold px-2 py-1 rounded-full text-red-700 bg-red-100"><XCircle size={14} className="mr-1" />Rejected</span>;
            default: return <span className="flex items-center text-xs font-semibold px-2 py-1 rounded-full text-yellow-700 bg-yellow-100"><Clock size={14} className="mr-1" />Pending</span>;
        }
    };

    if (status === 'loading') {
        return <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-500" /></div>;
    }

    return (
        <div className="space-y-8 p-4 md:p-8 bg-gray-50 min-h-screen">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center">
                 <div>
                    <h1 className="text-3xl font-bold text-gray-900">My Payouts</h1>
                    <p className="mt-1 text-md text-gray-600">Request and track your incentive payouts.</p>
                </div>
                 <button onClick={() => setShowForm(!showForm)} className="mt-4 md:mt-0 bg-black text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-gray-800 transition-colors flex items-center gap-2">
                    <PlusCircle size={18} /> {showForm ? 'Cancel Request' : 'New Payout Request'}
                </button>
            </header>

            {isLoading ? <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-500" /></div> : error ? <div className="text-red-600 bg-red-50 p-4 rounded-md flex items-center gap-2"><AlertCircle/> {error}</div> : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard
                            title="Total Earned"
                            value={formatCurrency(totalEarned)}
                            icon={<TrendingUp size={28} />}
                            gradient="from-green-500 to-emerald-500"
                        />
                        <StatCard
                            title="Total Paid"
                            value={formatCurrency(totalPaid)}
                            icon={<TrendingDown size={28} />}
                            gradient="from-pink-500 to-red-500"
                        />
                        <StatCard
                            title="Available Balance"
                            value={formatCurrency(balance)}
                            icon={<Wallet size={28} />}
                            gradient="from-violet-500 to-purple-600"
                        />
                    </div>

                    {showForm && (
                        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-xl shadow-sm border">
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
                        </motion.div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border">
                        <h2 className="text-xl font-semibold p-6 border-b">Request History</h2>
                        <div className="space-y-4 p-6">
                            {history.length === 0 ? <p className="text-center text-gray-500 py-8">No payout requests found.</p> : history.map((p: Payout) => (
                                <div key={p._id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
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