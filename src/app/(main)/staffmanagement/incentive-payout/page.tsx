'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '../../../../lib/permissions';
import { 
  TrashIcon, XMarkIcon, CheckIcon, NoSymbolIcon, ClockIcon, 
  BanknotesIcon, ArchiveBoxIcon, ArrowDownTrayIcon, TableCellsIcon 
} from '@heroicons/react/24/outline';
import { useStaff } from '../../../../context/StaffContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FaMoneyBillWave, FaRegCreditCard, FaWallet } from 'react-icons/fa';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import jsPDF from 'jspdf';
// FINAL FIX: Changed the import to a default import
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';


// --- Type Definitions ---
interface IStaff {
    _id: string;
    name: string;
    profilePhotoUrl?: string; 
    status?: 'active' | 'inactive';
}

interface IStaffMember {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

interface IPayout {
  _id:string;
  staff: IStaff;
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

interface PayoutCalculations {
  pendingRequests: IPayout[];
  historyRecords: IPayout[];
  approvedThisMonth: number;
  totalPendingValue: number;
}

// --- Main Component ---
export default function IncentivePayoutPage() {
  const [payouts, setPayouts] = useState<IPayout[]>([]);
  const { staffMembers } = useStaff();
  const [selectedStaffSummary, setSelectedStaffSummary] = useState<IStaffSummary | null>(null);
  
  const [historyDetail, setHistoryDetail] = useState<{ staff: IStaff; summary: IStaffSummary | null; } | null>(null);
  const [isHistoryDetailVisible, setIsHistoryDetailVisible] = useState(false);
  const [isHistorySummaryLoading, setIsHistorySummaryLoading] = useState(false);

  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  const { data: session } = useSession();
  
  const userPermissions = useMemo(() => session?.user?.role?.permissions || [], [session]);
  const canManage = useMemo(() => hasPermission(userPermissions, PERMISSIONS.STAFF_INCENTIVE_PAYOUT_MANAGE), [userPermissions]);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<TFormInputs>();
  const selectedStaffId = watch('staffId');

  // --- Data Fetching Hooks ---
  useEffect(() => {
    const fetchInitialData = async () => {
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
      } 
      finally { setIsLoading(false); }
    };
    fetchInitialData();
  }, [session]);

  useEffect(() => {
    if (selectedStaffId) {
      setIsSummaryLoading(true);
      const fetchSummary = async () => {
        try {
          const res = await fetch(`/api/incentive-payout/staff/${selectedStaffId}`);
          if (!res.ok) throw new Error('Failed to fetch summary');
          const data = await res.json();
          setSelectedStaffSummary(data);
        } catch (error) { 
          console.error("Failed to fetch staff summary:", error);
          setSelectedStaffSummary(null); 
        } 
        finally { setIsSummaryLoading(false); }
      };
      fetchSummary();
    } else {
      setSelectedStaffSummary(null);
    }
  }, [selectedStaffId]);

  // --- Handler Functions ---
  const handleNewRequestSubmit: SubmitHandler<TFormInputs> = async (data) => {
    try {
      const response = await fetch('/api/incentive-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: data.staffId, amount: Number(data.amount), reason: data.reason }),
      });
      if (!response.ok) throw new Error('Submission failed');
      const { payout: newPayout } = await response.json();
      setPayouts(prev => [newPayout, ...prev]);
      reset();
      setIsFormVisible(false);
    } catch (error) { console.error("Error submitting new payout request:", error); }
  };

  const handleStatusUpdate = async (payoutId: string, status: 'approved' | 'rejected') => {
    const originalPayouts = [...payouts];
    setPayouts(prev => prev.map(p => p._id === payoutId ? { ...p, status } : p));
    try {
      const response = await fetch(`/api/incentive-payout/${payoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Status update failed');
      const { payout: updatedPayout } = await response.json();
      setPayouts(prev => prev.map(p => p._id === payoutId ? updatedPayout : p));
    } catch (error) { 
        console.error("Error updating status:", error);
        setPayouts(originalPayouts); 
    }
  };
  
  const handleDelete = async (payoutId: string) => {
    if (!window.confirm("Are you sure? This action cannot be undone.")) return;
    const originalPayouts = [...payouts];
    setPayouts(payouts.filter(p => p._id !== payoutId));
    try {
      const response = await fetch(`/api/incentive-payout/${payoutId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Deletion failed');
    } catch (error) { 
        console.error("Error deleting payout:", error);
        setPayouts(originalPayouts); 
    }
  };

  const handleHistoryRowClick = async (staff: IStaff) => {
    setIsHistorySummaryLoading(true);
    setIsHistoryDetailVisible(true);
    setHistoryDetail({ staff, summary: null });
    try {
      const res = await fetch(`/api/incentive-payout/staff/${staff._id}`);
      if (!res.ok) throw new Error('Failed to fetch summary');
      const data = await res.json();
      setHistoryDetail({ staff, summary: data });
    } catch (error) {
      console.error("Error fetching staff summary:", error);
      setHistoryDetail({ staff, summary: null });
    } finally {
      setIsHistorySummaryLoading(false);
    }
  };

  const closeHistoryDetail = () => {
    setIsHistoryDetailVisible(false);
    setHistoryDetail(null);
  };
  
  const { pendingRequests, historyRecords, approvedThisMonth, totalPendingValue } = useMemo<PayoutCalculations>(() => {
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
    return { pendingRequests: pending, historyRecords: history, approvedThisMonth: totalApproved, totalPendingValue: totalPending };
  }, [payouts]);

  const filteredHistory = useMemo(() => {
    return historyRecords.filter(p => {
        if (!startDate || !endDate) return true;
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        const processedDate = p.processedDate ? new Date(p.processedDate) : new Date(p.createdAt);
        return processedDate >= startDate && processedDate <= endOfDay;
    });
  }, [historyRecords, startDate, endDate]);

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const totalAmount = filteredHistory.reduce((sum, p) => sum + p.amount, 0);

    doc.text("Payout History", 14, 15);

    // FINAL FIX: Changed the function call to use the imported autoTable function
    autoTable(doc, {
        startY: 20,
        head: [["Staff", "Amount", "Request Date", "Status", "Processed Date"]],
        body: filteredHistory.map(p => [
            p.staff.name,
            `₹${p.amount.toLocaleString()}`,
            new Date(p.createdAt).toLocaleDateString(),
            p.status,
            p.processedDate ? new Date(p.processedDate).toLocaleDateString() : 'N/A'
        ]),
        didDrawPage: (data) => {
            // This hook is used to get consistent positioning after the table
        }
    });

    // Get the y position of the last row to draw the total underneath
    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Amount: ₹${totalAmount.toLocaleString()}`, 14, finalY + 10);
    
    doc.save("payout-history.pdf");
  };

  const handleDownloadExcel = () => {
    const totalAmount = filteredHistory.reduce((sum, p) => sum + p.amount, 0);

    const dataToExport = filteredHistory.map(p => ({
        'Staff Name': p.staff.name,
        'Amount (₹)': p.amount,
        'Request Date': new Date(p.createdAt).toLocaleDateString(),
        'Status': p.status,
        'Processed Date': p.processedDate ? new Date(p.processedDate).toLocaleDateString() : 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);

    // Add total row at the bottom
    XLSX.utils.sheet_add_aoa(ws, [
      ["", "Total Amount:", totalAmount]
    ], { origin: -1 }); // -1 means append to the end

    const wb = { Sheets: { 'Payout History': ws }, SheetNames: ['Payout History'] };
    XLSX.writeFile(wb, "payout-history.xlsx");
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading Payout Data...</div>;
  }

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen font-sans">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Incentive Payouts</h1>
        {canManage && (
            <button onClick={() => setIsFormVisible(v => !v)} className="bg-black text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-gray-800 transition-colors">
            {isFormVisible ? 'Cancel' : '+ New Request'}
            </button>
        )}
      </header>

      <AnimatePresence>
        {isFormVisible && canManage && ( 
          <motion.section 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white p-6 rounded-lg shadow-md mb-8 overflow-hidden">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">New Payout Request Form</h2>
              <form onSubmit={handleSubmit(handleNewRequestSubmit)} className="space-y-4">
                  <div>
                  <label htmlFor="staffId" className="block text-sm font-medium text-gray-700">Staff Member*</label>
                  <select id="staffId" {...register('staffId', { required: 'Please select a staff member.' })} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                      <option value="">Select Staff...</option>
                      {staffMembers.filter((s: IStaffMember) => s.status === 'active').map((staff: IStaffMember) => (
                      <option key={staff.id} value={staff.id}>
                          {staff.name}
                      </option>
                      ))}
                  </select>
                  {errors.staffId && <span className="text-red-500 text-sm">{errors.staffId.message}</span>}
                  </div>
                  
                  {isSummaryLoading && <div className="text-center p-4">Loading Staff Balance...</div>}
                  
                  {selectedStaffSummary && !isSummaryLoading && (
                  <div className="grid grid-cols-3 gap-4 text-center p-4 bg-gray-100 rounded-lg">
                      <div><span className="text-sm text-gray-500">Total Earned</span><p className="font-bold text-green-600 text-lg">₹{selectedStaffSummary.totalEarned.toLocaleString()}</p></div>
                      <div><span className="text-sm text-gray-500">Total Paid</span><p className="font-bold text-red-600 text-lg">₹{selectedStaffSummary.totalPaid.toLocaleString()}</p></div>
                      <div><span className="text-sm text-gray-500">Balance</span><p className="font-bold text-blue-600 text-lg">₹{selectedStaffSummary.balance.toLocaleString()}</p></div>
                  </div>
                  )}

                  <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount (₹)*</label>
                  <input type="number" step="0.01" id="amount" {...register('amount', { required: 'Amount is required.', valueAsNumber: true, min: { value: 0.01, message: "Amount must be positive." }, max: { value: selectedStaffSummary ? selectedStaffSummary.balance : 0, message: "Amount cannot exceed available balance." }})} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
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
          </motion.section> 
        )}
      </AnimatePresence>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div whileHover={{ scale: 1.05, y: -5 }} className="bg-white p-5 rounded-lg shadow flex items-center space-x-4">
            <div className="bg-yellow-100 p-3 rounded-full"><ClockIcon className="h-6 w-6 text-yellow-500" /></div>
            <div>
                <h3 className="text-gray-500">Pending Requests</h3>
                <p className="text-3xl font-bold">{pendingRequests.length}</p>
                <span className="text-sm text-gray-400">Totaling ₹{totalPendingValue.toLocaleString()}</span>
            </div>
        </motion.div>
        <motion.div whileHover={{ scale: 1.05, y: -5 }} className="bg-white p-5 rounded-lg shadow flex items-center space-x-4">
            <div className="bg-green-100 p-3 rounded-full"><BanknotesIcon className="h-6 w-6 text-green-500" /></div>
            <div>
                <h3 className="text-gray-500">Approved This Month</h3>
                <p className="text-3xl font-bold">₹{approvedThisMonth.toLocaleString()}</p>
                <span className="text-sm text-gray-400">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            </div>
        </motion.div>
        <motion.div whileHover={{ scale: 1.05, y: -5 }} className="bg-white p-5 rounded-lg shadow flex items-center space-x-4">
            <div className="bg-blue-100 p-3 rounded-full"><ArchiveBoxIcon className="h-6 w-6 text-blue-500" /></div>
            <div>
                <h3 className="text-gray-500">Total History Records</h3>
                <p className="text-3xl font-bold">{historyRecords.length}</p>
                <span className="text-sm text-gray-400">Approved & Rejected</span>
            </div>
        </motion.div>
      </section>

      <main>
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
                    {canManage && (
                        <div className="flex items-center justify-end gap-3 pt-3 border-t mt-3">
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleStatusUpdate(p._id, 'approved')} className="bg-green-500 text-white px-4 py-1 rounded-lg hover:bg-green-600 flex items-center"><CheckIcon className="h-4 w-4 mr-1"/>Approve</motion.button>
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleStatusUpdate(p._id, 'rejected')} className="bg-red-500 text-white px-4 py-1 rounded-lg hover:bg-red-600 flex items-center"><NoSymbolIcon className="h-4 w-4 mr-1"/>Reject</motion.button>
                            <button onClick={() => handleDelete(p._id)} title="Delete Request" className="text-gray-500 hover:text-red-600 p-1"><TrashIcon className="h-5 w-5" /></button>
                        </div>
                    )}
                    </div>
                ))}
                </div>
            ) : ( <div className="text-center py-10 bg-white rounded-lg shadow-md"><p className="text-gray-500">All caught up! No pending payout requests.</p></div> )}
        </section>

        <section>
          <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
            <h2 className="text-2xl font-semibold text-gray-800">Payout History</h2>
            <div className="flex items-center space-x-2">
                <DatePicker selected={startDate} onChange={(date: Date | null) => setStartDate(date)} selectsStart startDate={startDate} endDate={endDate} placeholderText="Start Date" className="p-2 border border-gray-300 rounded-md shadow-sm w-32"/>
                <DatePicker selected={endDate} onChange={(date: Date | null) => setEndDate(date)} selectsEnd startDate={startDate} endDate={endDate} minDate={startDate || undefined} placeholderText="End Date" className="p-2 border border-gray-300 rounded-md shadow-sm w-32"/>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleDownloadPDF} title="Download PDF" className="p-2 bg-red-100 text-red-600 rounded-lg shadow hover:bg-red-200"><ArrowDownTrayIcon className="h-5 w-5"/></motion.button>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleDownloadExcel} title="Download Excel" className="p-2 bg-green-100 text-green-600 rounded-lg shadow hover:bg-green-200"><TableCellsIcon className="h-5 w-5"/></motion.button>
            </div>
          </div>
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
                {filteredHistory.map((p: IPayout) => (
                  <tr 
                    key={p._id} 
                    onClick={() => handleHistoryRowClick(p.staff)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                                <img className="h-10 w-10 rounded-full" src={p.staff.profilePhotoUrl || `https://ui-avatars.com/api/?name=${p.staff.name.replace(' ', '+')}&background=random`} alt={p.staff.name} />
                            </div>
                            <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{p.staff.name}</div>
                            </div>
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">₹{p.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{p.status}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap">{p.processedDate ? new Date(p.processedDate).toLocaleDateString() : 'N/A'}</td>
                    {canManage && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
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
      
      <AnimatePresence>
      {isHistoryDetailVisible && historyDetail && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={closeHistoryDetail}></motion.div>
          
          <motion.div 
            initial={{ x: "100%" }} 
            animate={{ x: 0 }} 
            exit={{ x: "100%" }} 
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 w-full max-w-md h-full bg-white shadow-xl z-50 p-6 overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b">
              <h2 className="text-xl font-bold text-gray-800">Employee Details</h2>
              <button onClick={closeHistoryDetail} className="text-gray-500 hover:text-gray-800"><XMarkIcon className="h-6 w-6" /></button>
            </div>

            <div className="text-center my-6">
                <img className="h-24 w-24 rounded-full mx-auto" src={historyDetail.staff.profilePhotoUrl || `https://ui-avatars.com/api/?name=${historyDetail.staff.name.replace(' ', '+')}&background=random&size=128`} alt={historyDetail.staff.name} />
              <h3 className="text-2xl font-semibold mt-3">{historyDetail.staff.name}</h3>
            </div>

            {isHistorySummaryLoading ? (
              <div className="text-center p-4">Loading Summary...</div>
            ) : historyDetail.summary ? (
              <div className="grid grid-cols-3 gap-4 text-center p-4 bg-gray-100 rounded-lg mb-6">
                <div className="flex flex-col items-center justify-center">
                  <FaMoneyBillWave className="text-green-500 text-2xl mb-1"/>
                  <span className="text-sm text-gray-500">Total Earned</span>
                  <p className="font-bold text-green-600 text-lg">₹{historyDetail.summary.totalEarned.toLocaleString()}</p>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <FaRegCreditCard className="text-red-500 text-2xl mb-1"/>
                  <span className="text-sm text-gray-500">Total Paid</span>
                  <p className="font-bold text-red-600 text-lg">₹{historyDetail.summary.totalPaid.toLocaleString()}</p>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <FaWallet className="text-blue-500 text-2xl mb-1"/>
                  <span className="text-sm text-gray-500">Balance</span>
                  <p className="font-bold text-blue-600 text-lg">₹{historyDetail.summary.balance.toLocaleString()}</p>
                </div>
              </div>
            ) : (
               <div className="text-center p-4 bg-gray-100 rounded-lg mb-6">Could not load financial summary.</div>
            )}
            
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Payout History ({historyRecords.filter(p => p.staff._id === historyDetail.staff._id).length})</h3>
              <div className="space-y-3">
                {historyRecords
                  .filter((p: IPayout) => p.staff._id === historyDetail.staff._id)
                  .map((payout: IPayout) => (
                    <div key={payout._id} className="bg-white border rounded-lg p-3">
                       <div className="flex justify-between items-center">
                          <p className="font-bold text-lg">₹{payout.amount.toLocaleString()}</p>
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${payout.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{payout.status}</span>
                       </div>
                       <p className="text-sm text-gray-600 mt-1">Reason: {payout.reason}</p>
                       <p className="text-xs text-gray-400 mt-2">
                          {payout.processedDate ? `Processed: ${new Date(payout.processedDate).toLocaleDateString()}`: `Requested: ${new Date(payout.createdAt).toLocaleDateString()}`}
                       </p>
                    </div>
                  ))
                }
              </div>
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </div>
  );
}