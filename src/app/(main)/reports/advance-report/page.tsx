'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Wallet, FileText, Hourglass, CheckCircle2, XCircle, BarChart, FileDown, X, Scale, Banknote,
} from 'lucide-react';
import { useSession } from 'next-auth/react'; // Import useSession
import { StaffProvider, useStaff, StaffMember, AdvancePaymentType } from '../../../../context/StaffContext';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { hasPermission, PERMISSIONS } from '../../../../lib/permissions'; // Import permissions helpers

const StatCard = ({ icon, title, value, description }: { icon: React.ReactNode, title: string, value: string, description?: string }) => (
  <div className="bg-white p-5 rounded-xl shadow-md border border-gray-200/80">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <div className="text-gray-400">{icon}</div>
    </div>
    <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-800">{value}</p>
    {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
  </div>
);

const AdvanceReport = () => {
  // --- ADDED: Get session and permissions like in the gift card example ---
  const { data: session, status } = useSession();
  const userPermissions = session?.user?.role?.permissions || [];

  const { staffMembers, advancePayments, loadingAdvancePayments, errorAdvancePayments } = useStaff();
  
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(new Date());
  const [appliedDateRange, setAppliedDateRange] = useState({
    start: startOfMonth(new Date()),
    end: new Date(),
  });

  const handleOpenDetails = (staffId: string) => { const staff = staffMembers.find(s => s.id === staffId); if (staff) { setSelectedStaff(staff); } };
  const handleCloseDetails = () => setSelectedStaff(null);
  
  const handleFetchReport = () => {
    setAppliedDateRange({ start: startOfDay(startDate), end: endOfDay(endDate) });
  };

  const pendingPayments = useMemo(() => advancePayments.filter((p) => p.status === 'pending'), [advancePayments]);
  const historyPayments = useMemo(() => advancePayments.filter((p) => p.status !== 'pending').sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()), [advancePayments]);
  
  const now = new Date();
  const startOfCurrentMonth = startOfMonth(now);
  const endOfCurrentMonth = endOfMonth(now);
  
  const totalPendingAmount = useMemo(() => pendingPayments.reduce((sum, p) => sum + p.amount, 0), [pendingPayments]);
  
  const approvedThisMonthAmount = useMemo(() => advancePayments
    .filter(p => { 
        const approvedDate = p.approvedDate ? parseISO(p.approvedDate) : null; 
        return p.status === 'approved' && approvedDate && approvedDate >= startOfCurrentMonth && approvedDate <= endOfCurrentMonth; 
    })
    .reduce((sum, p) => sum + p.amount, 0), [advancePayments, startOfCurrentMonth, endOfCurrentMonth]);

  const filteredHistoryPayments = useMemo(() => {
    if (!appliedDateRange.start || !appliedDateRange.end) {
      return [];
    }
    return historyPayments.filter(p => {
      const processedDate = p.status === 'approved'
        ? (p.approvedDate ? parseISO(p.approvedDate) : null)
        : (p.updatedAt ? parseISO(p.updatedAt) : parseISO(p.requestDate)); 
      if (!processedDate) return false;
      return processedDate >= appliedDateRange.start && processedDate <= appliedDateRange.end;
    });
  }, [historyPayments, appliedDateRange]);
  
  const historyCardDescription = useMemo(() => {
     if (!appliedDateRange.start || !appliedDateRange.end) return "No date range selected";
     return `For ${format(appliedDateRange.start, 'dd MMM yyyy')} to ${format(appliedDateRange.end, 'dd MMM yyyy')}`;
  }, [appliedDateRange]);

  let staffAdvanceHistory: AdvancePaymentType[] = [];
  if (selectedStaff) {
    staffAdvanceHistory = advancePayments.filter(p => (typeof p.staffId === 'object' ? p.staffId.id : p.staffId) === selectedStaff.id).sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }

  const handleExportExcel = () => {
    const dataToExport = filteredHistoryPayments.map(payment => ({
        'Staff Name': staffMembers.find(s => s.id === (typeof payment.staffId === 'object' ? payment.staffId.id : payment.staffId))?.name || 'N/A',
        'Staff ID': staffMembers.find(s => s.id === (typeof payment.staffId === 'object' ? payment.staffId.id : payment.staffId))?.staffIdNumber || 'N/A',
        'Amount': payment.amount, 'Status': payment.status,
        'Request Date': format(parseISO(payment.requestDate), 'dd MMM, yyyy'),
        'Processed Date': payment.approvedDate ? format(parseISO(payment.approvedDate), 'dd MMM, yyyy') : 'N/A', 'Reason': payment.reason,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Advance History');
    XLSX.writeFile(workbook, `Advance_History_Report.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const tableData = filteredHistoryPayments.map(payment => {
      const staff = staffMembers.find(s => s.id === (typeof payment.staffId === 'object' ? payment.staffId.id : payment.staffId));
      return [
          staff?.name || 'N/A', `₹${payment.amount.toLocaleString('en-IN')}`, payment.status.charAt(0).toUpperCase() + payment.status.slice(1),
          format(parseISO(payment.requestDate), 'dd MMM, yyyy'), payment.approvedDate ? format(parseISO(payment.approvedDate), 'dd MMM, yyyy') : 'N/A',
      ];
    });
    autoTable(doc, { head: [['Staff', 'Amount', 'Status', 'Request Date', 'Processed Date']], body: tableData, didDrawPage: (data) => { doc.text('Advance Payment History', data.settings.margin.left, 15); } });
    doc.save(`Advance_History_Report.pdf`);
  };
  
  // --- ADDED: Handle loading and unauthorized states ---
  if (status === "loading" || loadingAdvancePayments) {
    return <div className="flex items-center justify-center h-96 text-xl text-gray-600">Loading Report Data...</div>;
  }

  // Check for permission to view the report page itself
  if (status === "unauthenticated" || !hasPermission(userPermissions, PERMISSIONS.REPORT_ADVANCE_READ)) {
    return (
        <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
                <p className="mt-2 text-gray-600">You do not have permission to view this report.</p>
            </div>
        </div>
    );
  }

  if (errorAdvancePayments) return <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg">{errorAdvancePayments}</div>;

  return (
    <div className="font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Advance Payments Report
          </h1>
          <p className="text-gray-500 mt-1 text-sm">View and track all employee advance requests.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="text-sm font-medium text-gray-600">From:</span>
            <input 
              type="date"
              value={format(startDate, 'yyyy-MM-dd')}
              onChange={(e) => setStartDate(parseISO(e.target.value))}
              className="p-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <span className="text-sm font-medium text-gray-600">To:</span>
             <input 
              type="date"
              value={format(endDate, 'yyyy-MM-dd')}
              onChange={(e) => setEndDate(parseISO(e.target.value))}
              className="p-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <Button 
              onClick={handleFetchReport}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Fetch Report
            </Button>
        </div>
      </div>
      
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <StatCard icon={<Hourglass size={24} />} title="Pending Requests" value={`${pendingPayments.length}`} description={`Totaling ₹${totalPendingAmount.toLocaleString('en-IN')}`} />
          <StatCard icon={<CheckCircle2 size={24} className="text-green-500"/>} title="Approved This Month" value={`₹${approvedThisMonthAmount.toLocaleString('en-IN')}`} description={format(now, 'MMMM yyyy')} />
          <StatCard icon={<BarChart size={24} />} title="History Records" value={`${filteredHistoryPayments.length}`} description={historyCardDescription} />
        </div>
        
        <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200/80">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center p-4 sm:p-6 border-b border-gray-200 gap-4">
              <h3 className="text-xl font-bold text-gray-700">Advance History</h3>
              {/* --- MODIFIED: Permission check for export buttons using hasPermission --- */}
              {hasPermission(userPermissions, PERMISSIONS.REPORT_ADVANCE_MANAGE) && (
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={filteredHistoryPayments.length === 0} title="Export to Excel">
                        <FileDown size={16} className="text-green-600" /><span className="hidden sm:inline ml-2">Excel</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={filteredHistoryPayments.length === 0} title="Download as PDF">
                        <FileDown size={16} className="text-red-600" /><span className="hidden sm:inline ml-2">PDF</span>
                    </Button>
                </div>
              )}
          </div>
          
          <div className="overflow-x-auto hidden md:block">
            <table className="min-w-full">
              <thead className="bg-slate-100"><tr><th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Staff</th><th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th><th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Request Date</th><th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th><th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Processed Date</th></tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredHistoryPayments.map((payment) => {
                  const staff = staffMembers.find(s => s.id === (typeof payment.staffId === 'object' ? payment.staffId.id : payment.staffId));
                  return (
                    <tr key={payment.id} className="hover:bg-slate-50 transition-all duration-200 hover:-translate-y-0.5">
                      <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => staff && handleOpenDetails(staff.id)}><div className="flex items-center"><img className="h-11 w-11 rounded-full object-cover" src={staff?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff?.name || '')}&background=random&color=fff`} alt={staff?.name} /><div className="ml-4"><div className="text-sm font-semibold text-gray-900">{staff?.name}</div><div className="text-sm text-gray-500">{staff?.position}</div><div className="text-xs text-gray-400">ID: {staff?.staffIdNumber || 'N/A'}</div></div></div></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">₹{payment.amount.toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{format(parseISO(payment.requestDate), 'dd MMM, yyyy')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center"><span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${payment.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{payment.status}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{payment.approvedDate ? format(parseISO(payment.approvedDate), 'dd MMM, yyyy') : 'N/A'}</td>
                    </tr>
                  );
                })}
                {filteredHistoryPayments.length === 0 && (<tr><td colSpan={5} className="text-center py-16 text-gray-500">No advance payment history for the selected period.</td></tr>)}
              </tbody>
            </table>
          </div>
          
          <div className="block md:hidden">
            <div className='divide-y divide-gray-200'>
            {filteredHistoryPayments.map((payment) => {
              const staff = staffMembers.find(s => s.id === (typeof payment.staffId === 'object' ? payment.staffId.id : payment.staffId));
              return (
                <div key={payment.id} className="p-4 active:bg-slate-50" onClick={() => staff && handleOpenDetails(staff.id)}>
                  <div className='flex justify-between items-start gap-3'><div className="flex items-center gap-3 flex-1 min-w-0"><img className="h-11 w-11 rounded-full object-cover flex-shrink-0" src={staff?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff?.name || '')}&background=random&color=fff`} alt={staff?.name} /><div className="truncate"><p className="text-sm font-semibold text-gray-900 truncate">{staff?.name}</p><p className="text-xs text-gray-500 truncate">{staff?.position}</p></div></div><span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${payment.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{payment.status}</span></div>
                  <div className='mt-4 pl-1 grid grid-cols-2 gap-x-4 gap-y-2 text-sm'><div><span className='text-xs text-gray-500 block'>Amount</span><span className='font-semibold text-gray-800'>₹{payment.amount.toLocaleString('en-IN')}</span></div><div><span className='text-xs text-gray-500 block'>Request Date</span><span className='text-gray-700'>{format(parseISO(payment.requestDate), 'dd MMM, yyyy')}</span></div><div className='col-span-2'><span className='text-xs text-gray-500 block'>Processed Date</span><span className='text-gray-700'>{payment.approvedDate ? format(parseISO(payment.approvedDate), 'dd MMM, yyyy') : 'N/A'}</span></div></div>
                </div>
              );
            })}
             {filteredHistoryPayments.length === 0 && (<div className="text-center py-16 text-gray-500"><FileText size={40} className="mx-auto text-gray-300 mb-3" />No history available for the selected period.</div>)}
            </div>
          </div>
        </div>
        {selectedStaff && ( <>{/* ... modal JSX ... */} </> )}
      </Card>
    </div>
  );
};

export default function AdvanceReportPage() {
  return (
    <StaffProvider>
      <AdvanceReport />
    </StaffProvider>
  );
}