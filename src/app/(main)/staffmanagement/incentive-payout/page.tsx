'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '../../../../lib/permissions';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useStaff, StaffMember } from '../../../../context/StaffContext';

// --- Type Definitions ---
interface IPayout {
  _id: string;
  staff: {
      id: string;
      name: string;
  };
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedDate?: string;
}

interface IStaffSummary {
  totalEarned: number;
  totalPaid: number;
  balance: number;
}

type TFormInputs = {
  staffId: string;
  amount: number;
  reason: string;
};

// --- Main Component ---
export default function IncentivePayoutPage() {
  const [payouts, setPayouts] = useState<IPayout[]>([]);
  const { staffMembers } = useStaff();
  const [selectedStaffSummary, setSelectedStaffSummary] = useState<IStaffSummary | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  
  const { data: session } = useSession();
  
  // ✅ --- PERMISSIONS LOGIC ---
  // This correctly checks if the logged-in user has the rights to manage payouts.
  // This is why you see the "Approve" and "Reject" buttons as an administrator.
  const userPermissions = useMemo(() => session?.user?.role?.permissions || [], [session]);
  const canManage = useMemo(() => hasPermission(userPermissions, PERMISSIONS.STAFF_INCENTIVE_PAYOUT_MANAGE), [userPermissions]);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<TFormInputs>();
  const selectedStaffId = watch('staffId');

  // --- Data Fetching Hooks ---
  useEffect(() => {
    // Fetches the initial list of all payout requests when the component loads
    const fetchInitialData = async () => {
      // Don't fetch until the session is ready
      if (!session) return;
      
      setIsLoading(true);
      try {
        const payoutsRes = await fetch('/api/incentive-payout');
        if (payoutsRes.ok) {
            const payoutsData = await payoutsRes.json();
            setPayouts(Array.isArray(payoutsData) ? payoutsData : []);
        } else {
            console.error("API Error fetching payouts:", await payoutsRes.text());
            setPayouts([]);
        }
      } catch (error) { 
        console.error("Network or parsing error fetching initial data:", error); 
        setPayouts([]);
      } finally { 
        setIsLoading(false); 
      }
    };
    fetchInitialData();
  }, [session]); // This effect re-runs if the session changes

  useEffect(() => {
    // Fetches the summary (balance, etc.) for a specific staff member when selected
    if (selectedStaffId) {
      setIsSummaryLoading(true);
      const fetchSummary = async () => {
        try {
          const res = await fetch(`/api/incentive-payout/staff/${selectedStaffId}`);
          if (!res.ok) {
            throw new Error('Failed to fetch summary');
          }
          const data = await res.json();
          setSelectedStaffSummary(data);
        } catch (error) {
          console.error("Failed to fetch staff summary:", error);
          setSelectedStaffSummary(null);
        } finally {
          setIsSummaryLoading(false);
        }
      };
      fetchSummary();
    } else {
      setSelectedStaffSummary(null); // Clear summary if no staff is selected
    }
  }, [selectedStaffId]);

  // --- Handler Functions ---
  const handleNewRequestSubmit: SubmitHandler<TFormInputs> = async (data) => {
    try {
      const response = await fetch('/api/incentive-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          staffId: data.staffId, 
          amount: Number(data.amount),
          reason: data.reason,
        }),
      });
      if (!response.ok) throw new Error('Submission failed');
      const { payout: newPayout } = await response.json();
      setPayouts(prev => [newPayout, ...prev]);
      reset(); // Reset form fields
      setIsFormVisible(false); // Hide the form
    } catch (error) {
      console.error("Error submitting new payout request:", error);
    }
  };

  const handleStatusUpdate = async (payoutId: string, status: 'approved' | 'rejected') => {
    const originalPayouts = [...payouts];
    // Optimistic UI update for instant feedback
    setPayouts(prev => prev.map(p => p._id === payoutId ? { ...p, status } : p));
    try {
      const response = await fetch(`/api/incentive-payout/${payoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Status update failed');
      const { payout: updatedPayout } = await response.json();
      // Replace the optimistic update with the final data from the server
      setPayouts(prev => prev.map(p => p._id === payoutId ? updatedPayout : p));
    } catch (error) {
      console.error("Error updating status:", error);
      setPayouts(originalPayouts); // Revert on failure
    }
  };
  
  const handleDelete = async (payoutId: string) => {
    if (!window.confirm("Are you sure you want to delete this payout request? This action cannot be undone.")) return;
    const originalPayouts = [...payouts];
    setPayouts(payouts.filter(p => p._id !== payoutId));
    try {
      const response = await fetch(`/api/incentive-payout/${payoutId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Deletion failed');
    } catch (error) {
      console.error("Error deleting payout:", error);
      setPayouts(originalPayouts); // Revert on failure
    }
  };

  // --- Memoized Calculations for Dashboard Display ---
  const { pendingRequests, historyRecords, approvedThisMonth, totalPendingValue } = useMemo(() => {
    const pending = payouts.filter(p => p.status === 'pending');
    const history = payouts.filter(p => p.status !== 'pending');
    
    const now = new Date();
    const approved = payouts.filter(p => {
        if (p.status !== 'approved' || !p.processedDate) return false;
        const processed = new Date(p.processedDate);
        return processed.getFullYear() === now.getFullYear() && processed.getMonth() === now.getMonth();
    });

    const totalApproved = approved.reduce((sum, p) => sum + p.amount, 0);
    const totalPending = pending.reduce((sum, p) => sum + p.amount, 0);
    
    return { 
        pendingRequests: pending, 
        historyRecords: history, 
        approvedThisMonth: totalApproved, 
        totalPendingValue: totalPending 
    };
  }, [payouts]);

  if (isLoading) {
    return <div className="p-8 text-center">Loading Payout Data...</div>;
  }

  // --- JSX Rendering ---
  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen font-sans">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Incentive Payouts</h1>
        {/* The "New Request" button only shows for users with management permissions */}
        {canManage && (
            <button onClick={() => setIsFormVisible(v => !v)} className="bg-black text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-gray-800 transition-colors">
            {isFormVisible ? 'Cancel' : '+ New Request'}
            </button>
        )}
      </header>

      {/* The form for creating a new payout request */}
      {isFormVisible && canManage && (
        <section className="bg-white p-6 rounded-lg shadow-md mb-8 animate-fade-in-down">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">New Payout Request Form</h2>
          <form onSubmit={handleSubmit(handleNewRequestSubmit)} className="space-y-4">
            <div>
              <label htmlFor="staffId" className="block text-sm font-medium text-gray-700">Staff Member*</label>
              <select id="staffId" {...register('staffId', { required: 'Please select a staff member.' })} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                <option value="">Select Staff...</option>
                {staffMembers.filter(s => s.status === 'active').map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name} (ID: {staff.staffIdNumber})
                  </option>
                ))}
              </select>
              {errors.staffId && <span className="text-red-500 text-sm">{errors.staffId.message}</span>}
            </div>
            
            {isSummaryLoading && <div className="text-center p-4">Loading Staff Balance...</div>}
            
            {/* This is the informational box showing the staff member's balance */}
            {selectedStaffSummary && !isSummaryLoading && (
              <div className="grid grid-cols-3 gap-4 text-center p-4 bg-gray-100 rounded-lg">
                <div><span className="text-sm text-gray-500">Total Earned</span><p className="font-bold text-green-600 text-lg">₹{selectedStaffSummary.totalEarned.toLocaleString()}</p></div>
                <div><span className="text-sm text-gray-500">Total Paid</span><p className="font-bold text-red-600 text-lg">₹{selectedStaffSummary.totalPaid.toLocaleString()}</p></div>
                <div><span className="text-sm text-gray-500">Balance</span><p className="font-bold text-blue-600 text-lg">₹{selectedStaffSummary.balance.toLocaleString()}</p></div>
              </div>
            )}

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount (₹)*</label>
              <input 
                type="number" 
                step="0.01" 
                id="amount" 
                {...register('amount', { 
                  required: 'Amount is required.', 
                  valueAsNumber: true,
                  min: { value: 0.01, message: "Amount must be positive." },
                  // ✅ --- BALANCE VALIDATION ---
                  // This is the improvement you requested. It prevents claiming more than the available balance.
                  // This allows for partial claims (e.g., claiming 100 out of a 500 balance).
                  max: {
                    value: selectedStaffSummary ? selectedStaffSummary.balance : 0,
                    message: "Amount cannot exceed the available balance."
                  }
                })} 
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" 
              />
              {errors.amount && <span className="text-red-500 text-sm">{errors.amount.message}</span>}
            </div>

            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700">Reason*</label>
              <textarea id="reason" {...register('reason', { required: 'Reason is required.' })} rows={3} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"></textarea>
              {errors.reason && <span className="text-red-500 text-sm">{errors.reason.message}</span>}
            </div>

            <div className="flex justify-end space-x-3">
              <button type="button" onClick={() => { reset(); setIsFormVisible(false); }} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Submit Request</button>
            </div>
          </form>
        </section>
      )}

      {/* Summary Dashboard Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-lg shadow"><h3 className="text-gray-500">Pending Requests</h3><p className="text-3xl font-bold">{pendingRequests.length}</p><span className="text-sm text-gray-400">Totaling ₹{totalPendingValue.toLocaleString()}</span></div>
        <div className="bg-white p-5 rounded-lg shadow"><h3 className="text-gray-500">Approved This Month</h3><p className="text-3xl font-bold">₹{approvedThisMonth.toLocaleString()}</p><span className="text-sm text-gray-400">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</span></div>
        <div className="bg-white p-5 rounded-lg shadow"><h3 className="text-gray-500">Total History Records</h3><p className="text-3xl font-bold">{historyRecords.length}</p><span className="text-sm text-gray-400">Approved & Rejected</span></div>
      </section>

      <main>
        {/* Pending Requests List */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Pending Requests</h2>
          {pendingRequests.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingRequests.map((p: IPayout) => (
                <div key={p._id} className="bg-white p-5 rounded-lg shadow-md space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-lg">{p.staff.name}</div>
                    <div className="text-xl font-semibold my-2">₹{p.amount.toLocaleString()}</div>
                    <p className="text-gray-600 bg-gray-50 p-2 rounded">{p.reason}</p>
                    <div className="text-sm text-gray-500 mt-2">Requested: {new Date(p.createdAt).toLocaleDateString()}</div>
                  </div>
                  {/* ✅ --- CONDITIONAL BUTTONS ---
                      These buttons ONLY render if `canManage` is true, based on your role. */}
                  {canManage && (
                    <div className="flex items-center justify-end gap-3 pt-3 border-t mt-3">
                        <button onClick={() => handleStatusUpdate(p._id, 'approved')} className="bg-green-500 text-white px-4 py-1 rounded-lg hover:bg-green-600">Approve</button>
                        <button onClick={() => handleStatusUpdate(p._id, 'rejected')} className="bg-red-500 text-white px-4 py-1 rounded-lg hover:bg-red-600">Reject</button>
                        <button onClick={() => handleDelete(p._id)} title="Delete Request" className="text-gray-500 hover:text-red-600 p-1"><TrashIcon className="h-5 w-5" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : ( <div className="text-center py-10 bg-white rounded-lg shadow-md"><p className="text-gray-500">All caught up! No pending payout requests.</p></div> )}
        </section>

        {/* Payout History Table */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Payout History</h2>
          <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processed Date</th>
                  {canManage && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {historyRecords.map((p: IPayout) => (
                  <tr key={p._id}>
                    <td className="px-6 py-4 whitespace-nowrap">{p.staff.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">₹{p.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{p.status}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap">{p.processedDate ? new Date(p.processedDate).toLocaleDateString() : 'N/A'}</td>
                    {canManage && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button onClick={() => handleDelete(p._id)} title="Delete Request" className="text-gray-500 hover:text-red-600 p-1"><TrashIcon className="h-5 w-5" /></button>
                        </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}