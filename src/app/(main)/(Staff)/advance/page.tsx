'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, AlertCircle, Wallet, Coins } from 'lucide-react';
import { toast } from 'react-toastify';

// Type definition for the advance history items
type AdvanceHistoryItem = {
    id: string;
    amount: number;
    date: string;
    status: 'Approved' | 'Pending' | 'Rejected' | string;
};

export default function RequestAdvancePage() {
    const { data: session } = useSession();
    const router = useRouter();

    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [history, setHistory] = useState<AdvanceHistoryItem[]>([]);
    const [salaryInfo, setSalaryInfo] = useState({ base: 0, remaining: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAdvanceData = async () => {
            if (!session?.user?.tenantId) {
                return;
            }
            
            setIsLoading(true);
            try {
                const response = await fetch('/api/staff/get-advance-data', {
                    headers: {
                        'x-tenant-id': session.user.tenantId,
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Failed to load your advance data.');
                }

                const data = await response.json();
                
                setHistory(data.history || []);
                setSalaryInfo(data.salary || { base: 0, remaining: 0 });

            } catch (err: any) {
                toast.error(err.message || 'An unknown error occurred.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAdvanceData();
    }, [session]);


    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!session?.user?.tenantId) {
            toast.error("Your session has expired. Please log in again.");
            return;
        }
        if (!reason || reason.trim() === '') {
            toast.error("A reason for the advance is required.");
            setError("A reason for the advance is required.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/staff/advance-request', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-tenant-id': session.user.tenantId,
                },
                body: JSON.stringify({ amount: Number(amount), reason }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to submit the request.');
            }

            toast.success('Advance request submitted successfully!');
            
            setShowRequestForm(false);
            const newRequest: AdvanceHistoryItem = {
                id: Date.now().toString(),
                amount: Number(amount),
                date: new Date().toLocaleDateString('en-US'),
                status: 'Pending',
            };
            setHistory(prevHistory => [newRequest, ...prevHistory]);
            setAmount('');
            setReason('');

        } catch (err: any) {
            const msg = err.message || 'An unexpected error occurred.';
            setError(msg);
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadgeClass = (status: string) => {
        const lowerCaseStatus = status.toLowerCase();
        switch (lowerCaseStatus) {
            case 'approved':
                return 'bg-green-100 text-green-800';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'rejected':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                 <div>
                    <h1 className="text-2xl font-bold text-gray-800">My Advances</h1>
                    <p className="mt-1 text-md text-gray-500">Request an advance from your salary.</p>
                </div>
                 {!showRequestForm && (
                     <button
                        onClick={() => setShowRequestForm(true)}
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-800 transition-transform transform hover:scale-105 duration-200"
                    >
                        New Advance Request
                    </button>
                 )}
            </header>
            
            {/* --- START: MODIFIED SALARY CARDS SECTION --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                {/* Base Salary Card */}
                <div className="relative p-6 rounded-2xl text-white overflow-hidden transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-[1.03] hover:shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                    <div className="absolute top-0 right-0 h-24 w-24 -m-4 bg-white/20 rounded-full flex items-center justify-center">
                       <div className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center opacity-75">
                         <Wallet size={28} />
                       </div>
                    </div>
                    <p className="text-sm font-light">Base Salary</p>
                    <p className="text-3xl font-bold mt-2">₹{salaryInfo.base.toLocaleString()}</p>
                </div>

                {/* Est. Remaining Card */}
                <div className="relative p-6 rounded-2xl text-white overflow-hidden transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-[1.03] hover:shadow-lg bg-gradient-to-br from-green-400 to-teal-500">
                     <div className="absolute top-0 right-0 h-24 w-24 -m-4 bg-white/20 rounded-full flex items-center justify-center">
                       <div className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center opacity-75">
                         <Coins size={28} />
                       </div>
                    </div>
                    <p className="text-sm font-light">Est. Remaining</p>
                    <p className="text-3xl font-bold mt-2">₹{salaryInfo.remaining.toLocaleString()}</p>
                </div>
            </div>
            {/* --- END: MODIFIED SALARY CARDS SECTION --- */}


            {showRequestForm && (
                 <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-gray-800">New Advance Request Form</h2>
                        <button
                            onClick={() => setShowRequestForm(false)}
                            className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && <div className="text-red-600 bg-red-50 p-3 rounded-md text-sm flex items-center gap-2"><AlertCircle size={16}/> {error}</div>}
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                            <input
                                type="number"
                                id="amount"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                required
                                placeholder="e.g., 2000"
                                className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">Reason for Request</label>
                            <textarea
                                id="reason"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                required
                                rows={4}
                                placeholder="This reason is for admin reference."
                                className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                         <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={isSubmitting || !session}
                                className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center gap-2"
                            >
                                {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
                                {isSubmitting ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 pt-4 flex items-center gap-2">
                    <Wallet size={24} />
                    Advance History
                </h2>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                   {isLoading ? (
                       <p className="text-center text-gray-500 py-4">Loading history...</p>
                   ) : (
                       <div className="space-y-3">
                           {history.length > 0 ? history.map((item) => (
                               <div key={item.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] hover:shadow-md cursor-pointer">
                                   <div>
                                       <p className="font-bold text-lg text-gray-800">₹{item.amount.toLocaleString()}</p>
                                       <p className="text-sm text-gray-500">{item.date}</p>
                                   </div>
                                   <div>
                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(item.status)}`}>
                                           {item.status}
                                       </span>
                                   </div>
                               </div>
                           )) : (
                               <p className="text-center text-gray-500 py-4">No advance requests found.</p>
                           )}
                       </div>
                   )}
                </div>
            </div>
        </div>
    );
}