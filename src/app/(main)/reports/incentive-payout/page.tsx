'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import {
  XMarkIcon, BanknotesIcon, ArchiveBoxIcon, ArrowDownTrayIcon, TableCellsIcon
} from '@heroicons/react/24/outline';
import { useStaff, StaffProvider } from '../../../../context/StaffContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FaMoneyBillWave, FaRegCreditCard, FaWallet } from 'react-icons/fa';
import { format, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';

// --- Type Definitions ---
interface IStaff {
    _id: string; name: string; staffIdNumber?: string; profilePhotoUrl?: string;
}
interface IPayout {
  _id:string; staff: IStaff; amount: number; reason: string; status: 'pending' | 'approved' | 'rejected'; createdAt: string; processedDate?: string;
}
interface IStaffSummary {
  totalEarned: number; totalPaid: number; balance: number;
}

// --- Main Read-Only Report Component ---
const IncentivePayoutReport = () => {
  const [payouts, setPayouts] = useState<IPayout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [historyDetail, setHistoryDetail] = useState<{ staff: IStaff; summary: IStaffSummary | null; } | null>(null);
  const [isHistoryDetailVisible, setIsHistoryDetailVisible] = useState(false);
  const [isHistorySummaryLoading, setIsHistorySummaryLoading] = useState(false);
  
  const [startDate, setStartDate] = useState<Date | null>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date | null>(() => new Date());
  
  const [appliedDateRange, setAppliedDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    end: new Date(),
  });

  const { data: session } = useSession();

  useEffect(() => {
    const fetchPayouts = async () => {
      if (!session) return;
      setIsLoading(true);
      try {
        const res = await fetch('/api/incentive-payout');
        if (res.ok) {
            const data = await res.json();
            setPayouts(Array.isArray(data) ? data : []);
        } else { setPayouts([]); }
      } catch (error) { setPayouts([]); }
      finally { setIsLoading(false); }
    };
    fetchPayouts();
  }, [session]);

  const handleFetchReport = () => {
    if (!startDate || !endDate) return; 
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    setAppliedDateRange({ start: startDate, end: endOfDay });
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
      setHistoryDetail({ staff, summary: null });
    } finally {
      setIsHistorySummaryLoading(false);
    }
  };
  
  const closeHistoryDetail = () => {
    setIsHistoryDetailVisible(false);
    setHistoryDetail(null);
  };

  const { pendingRequests, historyRecords, approvedThisMonth, totalPendingValue, processedThisMonthCount } = useMemo(() => {
    const pending = []; const history = []; let approvedThisMonthValue = 0; const processedThisMonthItems = [];
    const now = new Date(); const currentYear = now.getFullYear(); const currentMonth = now.getMonth();
    for (const p of payouts) {
      if (p.status === 'pending') { pending.push(p); } else {
        history.push(p);
        if (p.processedDate) {
          const processed = new Date(p.processedDate);
          if (processed.getFullYear() === currentYear && processed.getMonth() === currentMonth) {
            processedThisMonthItems.push(p);
            if (p.status === 'approved') { approvedThisMonthValue += p.amount; }
          }
        }
      }
    }
    return {
      pendingRequests: pending, historyRecords: history, approvedThisMonth: approvedThisMonthValue,
      totalPendingValue: pending.reduce((sum, p) => sum + p.amount, 0),
      processedThisMonthCount: processedThisMonthItems.length
    };
  }, [payouts]);

  const filteredHistory = useMemo(() => {
    return historyRecords.filter(p => {
        const recordDate = p.processedDate ? new Date(p.processedDate) : new Date(p.createdAt);
        return recordDate >= appliedDateRange.start && recordDate <= appliedDateRange.end;
    });
  }, [historyRecords, appliedDateRange]);

  // --- THIS IS THE FIX: Restored full download logic ---
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const totalAmount = filteredHistory.reduce((sum, p) => sum + p.amount, 0);

    doc.text("Payout History", 14, 15);
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
    });

    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Amount: ₹${totalAmount.toLocaleString()}`, 14, finalY + 10);
    doc.save("payout-history.pdf");
  };

  // --- THIS IS THE FIX: Restored full download logic ---
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
    XLSX.utils.sheet_add_aoa(ws, [[""], ["Total Amount:", totalAmount]], { origin: -1 });
    const wb = { Sheets: { 'Payout History': ws }, SheetNames: ['Payout History'] };
    XLSX.writeFile(wb, "payout-history.xlsx");
  };

  if (isLoading) { return <div className="p-8 text-center">Loading Payout Report...</div>; }

  return (
    <div className="font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Incentive Payout Report</h1>
          <p className="text-gray-500 mt-1 text-sm">View and filter historical incentive payouts.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="text-sm font-medium text-gray-600">From:</span>
          <input 
            type="date"
            value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
            onChange={(e) => setStartDate(e.target.value ? parseISO(e.target.value) : null)}
            className="p-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <span className="text-sm font-medium text-gray-600">To:</span>
          <input 
            type="date"
            value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
            onChange={(e) => setEndDate(e.target.value ? parseISO(e.target.value) : null)}
            min={startDate ? format(startDate, 'yyyy-MM-dd') : undefined}
            className="p-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <Button onClick={handleFetchReport} className="bg-purple-600 hover:bg-purple-700 text-white" disabled={!startDate || !endDate}>Fetch Report</Button>
        </div>
      </div>

      <Card>
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div whileHover={{ scale: 1.05, y: -5 }} className="bg-white p-5 rounded-lg shadow flex items-center space-x-4">
            <div className="bg-yellow-100 p-3 rounded-full"><BanknotesIcon className="h-6 w-6 text-yellow-500" /></div>
            <div><h3 className="text-gray-500">Pending Requests</h3><p className="text-3xl font-bold">{pendingRequests.length}</p><span className="text-sm text-gray-400">Totaling ₹{totalPendingValue.toLocaleString()}</span></div>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05, y: -5 }} className="bg-white p-5 rounded-lg shadow flex items-center space-x-4">
              <div className="bg-green-100 p-3 rounded-full"><BanknotesIcon className="h-6 w-6 text-green-500" /></div>
              <div><h3 className="text-gray-500">Approved This Month</h3><p className="text-3xl font-bold">₹{approvedThisMonth.toLocaleString()}</p><span className="text-sm text-gray-400">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</span></div>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05, y: -5 }} className="bg-white p-5 rounded-lg shadow flex items-center space-x-4">
              <div className="bg-blue-100 p-3 rounded-full"><ArchiveBoxIcon className="h-6 w-6 text-blue-500" /></div>
              <div><h3 className="text-gray-500">History Records (This Month)</h3><p className="text-3xl font-bold">{processedThisMonthCount}</p><span className="text-sm text-gray-400">Approved & Rejected</span></div>
          </motion.div>
        </section>

        <section>
          <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
            <h2 className="text-2xl font-semibold text-gray-800">Payout History</h2>
            <div className="flex items-center space-x-2">
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleDownloadPDF} disabled={filteredHistory.length === 0} title="Download PDF" className="p-2 bg-red-100 text-red-600 rounded-lg shadow hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"><ArrowDownTrayIcon className="h-5 w-5"/></motion.button>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleDownloadExcel} disabled={filteredHistory.length === 0} title="Download Excel" className="p-2 bg-green-100 text-green-600 rounded-lg shadow hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"><TableCellsIcon className="h-5 w-5"/></motion.button>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request Date</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processed Date</th></tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredHistory.length > 0 ? filteredHistory.map((p: IPayout) => (
                  <tr key={p._id} onClick={() => handleHistoryRowClick(p.staff)} className="hover:bg-gray-50 cursor-pointer transition-all duration-200 hover:-translate-y-0.5">
                    <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><div className="flex-shrink-0 h-10 w-10"><img className="h-10 w-10 rounded-full" src={p.staff.profilePhotoUrl || `https://ui-avatars.com/api/?name=${p.staff.name.replace(' ', '+')}&background=random`} alt={p.staff.name} /></div><div className="ml-4"><div className="text-sm font-medium text-gray-900">{p.staff.name}</div><div className="text-xs text-gray-500">{p.staff.staffIdNumber}</div></div></div></td>
                    <td className="px-6 py-4 whitespace-nowrap">₹{p.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{p.status}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap">{p.processedDate ? new Date(p.processedDate).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                )) : ( <tr><td colSpan={5} className="text-center py-10 text-gray-500">No payout history for the selected period.</td></tr> )}
              </tbody>
            </table>
          </div>
        </section>

        <AnimatePresence>
            {isHistoryDetailVisible && historyDetail && ( <>{/* ... Side Panel Modal JSX ... */} </> )}
        </AnimatePresence>
      </Card>
    </div>
  );
}

// --- Page Wrapper for Context ---
export default function IncentivePayoutReportPage() {
  return (
    <StaffProvider>
      <IncentivePayoutReport />
    </StaffProvider>
  );
}