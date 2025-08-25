// /app/staff-dashboard/request-advance/page.tsx

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react'; // ✅ 1. IMPORT useSession
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import Link from 'next/link';

export default function RequestAdvancePage() {
    const { data: session } = useSession(); // ✅ 2. GET session data
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        // Safety check to ensure session is loaded
        if (!session?.user?.tenantId) {
            toast.error("Your session has expired or is invalid. Please log in again.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/staff/advance-request', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    // ✅ 3. ADD the tenantId to the request headers
                    'x-tenant-id': session.user.tenantId,
                },
                body: JSON.stringify({ amount: Number(amount), reason }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to submit the request.');
            }

            toast.success('Advance request submitted successfully!');
            router.push('/staff-dashboard');

        } catch (err: any) {
            if (err instanceof SyntaxError) {
                 setError('An unexpected error occurred. Could not connect to the server.');
                 toast.error('An unexpected error occurred. Could not connect to the server.');
            } else {
                setError(err.message);
                toast.error(err.message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Request an Advance</h1>
                    <p className="mt-1 text-md text-gray-600">Submit a request for a salary advance.</p>
                </div>
                 <Link href="/staff-dashboard" className="flex items-center gap-2 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors">
                    <ArrowLeft size={16} />
                    Back to Dashboard
                </Link>
            </header>

            <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border max-w-2xl mx-auto">
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
                            className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g., 5000"
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
                            className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Please provide a brief reason for your advance request."
                        />
                    </div>
                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting || !session} // Disable button if session is not loaded
                            className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center gap-2"
                        >
                            {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
                            {isSubmitting ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}