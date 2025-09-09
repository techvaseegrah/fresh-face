'use client';

import React, { useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import {
  Wallet, Plus, FileText, Hourglass, CheckCircle2, XCircle, BarChart, FileDown, X, Scale, Banknote,
} from 'lucide-react';
import Select from 'react-select'; // Import react-select
import { useStaff, StaffMember, AdvancePaymentType } from '../../../../context/StaffContext';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useSession } from 'next-auth/react';
import { PERMISSIONS, hasPermission } from '../../../../lib/permissions';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// A reusable Stat Card component (already responsive)
const StatCard = ({ icon, title, value, description }: { icon: React.ReactNode, title: string, value: string, description?: string }) => (
  <div className="bg-white p-5 rounded-xl shadow-md border border-gray-200/80 transition-all hover:shadow-lg hover:-translate-y-1">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <div className="text-gray-400">{icon}</div>
    </div>
    <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-800">{value}</p>
    {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
  </div>
);

const AdvancePayment: React.FC = () => {
   const { data: session } = useSession();
    const userPermissions = useMemo(() => session?.user?.role?.permissions || [], [session]);
    const canManageAdvance = useMemo(() => hasPermission(userPermissions, PERMISSIONS.STAFF_ADVANCE_MANAGE), [userPermissions]);
    const {
    staffMembers,
    advancePayments,
    loadingAdvancePayments,
    errorAdvancePayments,
    requestAdvance,
    updateAdvanceStatus,
  } = useStaff();

  const [showNewRequestForm, setShowNewRequestForm] = useState(false);
  const [formData, setFormData] = useState({ staffId: '', amount: 0, reason: '', repaymentPlan: 'One-time deduction' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [exportFilter, setExportFilter] = useState('this_month');

  const handleOpenDetails = (staffId: string) => { const staff = staffMembers.find(s => s.id === staffId); if (staff) { setSelectedStaff(staff); } };
  const handleCloseDetails = () => setSelectedStaff(null);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { const { name, value } = e.target; setFormData({ ...formData, [name]: name === 'amount' ? parseFloat(value) || 0 : value }); };
  
  // New handler for react-select component
  const handleStaffSelectChange = (selectedOption: { value: string; label: string } | null) => {
    setFormData({ ...formData, staffId: selectedOption ? selectedOption.value : '' });
  };


  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.staffId || formData.amount <= 0 || !formData.reason.trim()) {
      toast.error('Please fill all required fields: Staff, Amount, and Reason.');
      return;
    }
    setIsSubmitting(true);
    const submitPromise = requestAdvance({ ...formData });
    toast.promise(submitPromise, { pending: 'Submitting request...', success: 'Advance request submitted successfully!', error: 'Failed to submit request. Please try again.' });
    try {
      await submitPromise;
      setShowNewRequestForm(false);
      setFormData({ staffId: '', amount: 0, reason: '', repaymentPlan: 'One-time deduction' });
    } catch (error) {
      console.error('Failed to submit advance request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    const approvePromise = updateAdvanceStatus(id, 'approved');
    toast.promise(approvePromise, { pending: 'Approving advance...', success: 'Advance approved!', error: 'Failed to approve advance.' });
    approvePromise.catch(error => console.error('Failed to approve advance:', error));
  };

  const handleReject = async (id: string) => {
    const rejectPromise = updateAdvanceStatus(id, 'rejected');
    toast.promise(rejectPromise, { pending: 'Rejecting advance...', success: 'Advance rejected.', error: 'Failed to reject advance.' });
    rejectPromise.catch(error => console.error('Failed to reject advance:', error));
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

  let staffAdvanceHistory: AdvancePaymentType[] = [];
  let remainingSalary = 0;
  let totalAdvanceCount = 0;
  
  if (selectedStaff) {
    staffAdvanceHistory = advancePayments.filter(p => (typeof p.staffId === 'object' ? p.staffId.id : p.staffId) === selectedStaff.id).sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
    totalAdvanceCount = staffAdvanceHistory.filter(p => p.status === 'approved').length;
    
    const currentMonthApprovedAdvances = staffAdvanceHistory.filter(p => { 
        const approvedDate = p.approvedDate ? parseISO(p.approvedDate) : null; 
        return p.status === 'approved' && approvedDate && approvedDate >= startOfCurrentMonth && approvedDate <= endOfCurrentMonth; 
    }).reduce((sum, p) => sum + p.amount, 0);

    remainingSalary = (selectedStaff.salary || 0) - currentMonthApprovedAdvances;
  }

  const filteredHistoryPayments = useMemo(() => {
    const now = new Date();
    let start, end;

    if (exportFilter === 'this_month') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else if (exportFilter === 'last_month') {
      const lastMonthDate = subMonths(now, 1);
      start = startOfMonth(lastMonthDate);
      end = endOfMonth(lastMonthDate);
    } else { 
      return historyPayments;
    }

    return historyPayments.filter(p => {
      const processedDate = p.status === 'approved'
        ? (p.approvedDate ? parseISO(p.approvedDate) : null)
        : (p.updatedAt ? parseISO(p.updatedAt) : parseISO(p.requestDate)); 

      if (!processedDate) return false;
      
      return processedDate >= start && processedDate <= end;
    });
  }, [historyPayments, exportFilter]);

  const historyCardDescription = useMemo(() => {
    if (exportFilter === 'this_month') return `For ${format(now, 'MMMM yyyy')}`;
    if (exportFilter === 'last_month') return `For ${format(subMonths(now, 1), 'MMMM yyyy')}`;
    return 'Approved & Rejected (All Time)';
  }, [exportFilter, now]);


  const handleExportExcel = () => {
    const dataToExport = filteredHistoryPayments.map(payment => {
        const staff = staffMembers.find(s => s.id === (typeof payment.staffId === 'object' ? payment.staffId.id : payment.staffId));
        return {
            'Staff Name': staff?.name || 'N/A',
            'Staff ID': staff?.staffIdNumber || 'N/A',
            'Amount': payment.amount,
            'Status': payment.status,
            'Request Date': format(parseISO(payment.requestDate), 'dd MMM, yyyy'),
            'Processed Date': payment.approvedDate ? format(parseISO(payment.approvedDate), 'dd MMM, yyyy') : 'N/A',
            'Reason': payment.reason,
        };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Advance History');
    XLSX.writeFile(workbook, `Advance_History_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const tableData = filteredHistoryPayments.map(payment => {
        const staff = staffMembers.find(s => s.id === (typeof payment.staffId === 'object' ? payment.staffId.id : payment.staffId));
        return [
            staff?.name || 'N/A',
            `₹${payment.amount.toLocaleString('en-IN')}`,
            payment.status.charAt(0).toUpperCase() + payment.status.slice(1),
            format(parseISO(payment.requestDate), 'dd MMM, yyyy'),
            payment.approvedDate ? format(parseISO(payment.approvedDate), 'dd MMM, yyyy') : 'N/A',
        ];
    });
    autoTable(doc, {
        head: [['Staff', 'Amount', 'Status', 'Request Date', 'Processed Date']],
        body: tableData,
        didDrawPage: (data) => {
            doc.text('Advance Payment History', data.settings.margin.left, 15);
        }
    });
    doc.save(`Advance_History_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };
  
  // Format staff members for react-select
  const staffOptions = useMemo(() => 
    staffMembers
      .filter(s => s.status === 'active')
      .map(staff => ({
        value: staff.id,
        label: `${staff.name} (ID: ${staff.staffIdNumber})`
      })), [staffMembers]);


  if (loadingAdvancePayments) return <div className="flex items-center justify-center h-screen bg-slate-50 text-xl text-gray-600">Loading Advance Data...</div>;
  if (errorAdvancePayments) return <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg">{errorAdvancePayments}</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 min-h-screen font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 flex items-center gap-3">
            <Wallet className="text-indigo-500" /> Advance Payments
          </h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Manage and track all employee advance requests.</p>
        </div>
        <Button
          onClick={() => setShowNewRequestForm(!showNewRequestForm)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:px-5 bg-black text-white font-semibold rounded-xl shadow-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75 transition-all duration-300 transform hover:scale-105"
        >
          <Plus size={20} />
          New Request
        </Button>
      </div>

      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${showNewRequestForm ? 'max-h-[700px] opacity-100 mb-8' : 'max-h-0 opacity-0'}`}>
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-xl border border-gray-200/80">
          <h2 className="text-xl font-semibold mb-5 text-gray-800">New Advance Request Form</h2>
          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="staffId" className="block text-sm font-medium text-gray-600 mb-1">Staff Member*</label>
                <Select
                  id="staffId"
                  name="staffId"
                  options={staffOptions}
                  isClearable
                  isSearchable
                  placeholder="Search by name or ID..."
                  onChange={handleStaffSelectChange}
                  value={staffOptions.find(option => option.value === formData.staffId) || null}
                  // THIS IS THE FIX: Custom filter function
                  filterOption={(option, inputValue) => 
                    option.label.toLowerCase().includes(inputValue.toLowerCase())
                  }
                  styles={{
                    control: (base) => ({
                      ...base,
                      padding: '0.3rem',
                      borderColor: '#D1D5DB',
                      boxShadow: 'none',
                      '&:hover': {
                         borderColor: '#000'
                      }
                    }),
                    input: (base) => ({
                        ...base,
                        'input:focus': {
                            boxShadow: 'none',
                        },
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected ? '#000' : base.backgroundColor,
                       '&:hover': {
                         backgroundColor: '#f3f4f6',
                         color: '#111827'
                      }
                    })
                  }}
                />
              </div>
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-600 mb-1">Amount (₹)*</label>
                <input id="amount" name="amount" type="number" required min="1" step="0.01" value={formData.amount <= 0 ? '' : formData.amount} onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-gray-900"/>
              </div>
              <div className="md:col-span-2">
                 <label htmlFor="reason" className="block text-sm font-medium text-gray-600 mb-1">Reason for Advance*</label>
                 <textarea id="reason" name="reason" rows={3} required value={formData.reason} onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-gray-900 placeholder:text-gray-400"
                  placeholder="e.g., Medical emergency, family event..."/>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
              <Button type="button" onClick={() => setShowNewRequestForm(false)} disabled={isSubmitting} variant="outline">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} icon={<FileText size={16} />}>
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        </div>
      </div>
      
      {/* The rest of your component remains unchanged... */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <StatCard icon={<Hourglass size={24} />} title="Pending Requests" value={`${pendingPayments.length}`} description={`Totaling ₹${totalPendingAmount.toLocaleString('en-IN')}`} />
        <StatCard icon={<CheckCircle2 size={24} className="text-green-500"/>} title="Approved This Month" value={`₹${approvedThisMonthAmount.toLocaleString('en-IN')}`} description={format(now, 'MMMM yyyy')} />
        <StatCard icon={<BarChart size={24} />} title="History Records" value={`${filteredHistoryPayments.length}`} description={historyCardDescription} />
      </div>

      <div className="mb-10">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-700 mb-5">Pending Requests</h3>
        {pendingPayments.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {pendingPayments.map(payment => {
              const staffDetailsId = typeof payment.staffId === 'object' ? payment.staffId.id : payment.staffId;
              const staff = staffMembers.find(s => s.id === staffDetailsId);
              return (
                <div key={payment.id} className="bg-white rounded-xl shadow-md border border-gray-200/80 flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                  <div className="p-4 sm:p-5 flex items-center gap-4 border-b border-gray-200 cursor-pointer" onClick={() => staff && handleOpenDetails(staff.id)}>
                    <img className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-200" src={staff?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff?.name || 'S')}&background=random&color=fff`} alt={staff?.name} />
                    <div>
                      <p className="font-bold text-gray-800">{staff?.name}</p>
                      <p className="text-sm text-gray-500">{staff?.position}</p>
                      <p className="text-xs text-gray-400">ID: {staff?.staffIdNumber || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="p-4 sm:p-5 flex-grow space-y-3">
                    <div className="flex justify-between items-baseline"><span className="text-sm text-gray-500">Amount</span><span className="text-lg font-bold text-gray-900">₹{payment.amount.toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between items-baseline"><span className="text-sm text-gray-500">Request Date</span><span className="text-sm font-medium text-gray-700">{format(parseISO(payment.requestDate), 'dd MMM, yyyy')}</span></div>
                    <div><p className="text-sm text-gray-500 mb-1">Reason</p><p className="text-sm text-gray-700 bg-gray-100 p-2 rounded-md h-16 overflow-y-auto">{payment.reason}</p></div>
                  </div>
                  {canManageAdvance && (
                    <div className="p-3 sm:p-4 bg-gray-50/50 flex gap-3 rounded-b-xl">
                      <Button variant="success" className="w-full" icon={<CheckCircle2 size={16} />} onClick={() => handleApprove(payment.id)}>Approve</Button>
                      <Button variant="danger" className="w-full" icon={<XCircle size={16} />} onClick={() => handleReject(payment.id)}>Reject</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl shadow-md border border-gray-200/80 text-gray-500"><CheckCircle2 size={48} className="mx-auto text-green-400 mb-4" /><p className="font-semibold text-lg">All caught up!</p><p>There are no pending advance requests.</p></div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200/80">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center p-4 sm:p-6 border-b border-gray-200 gap-4">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-700">Advance History</h3>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <select value={exportFilter} onChange={(e) => setExportFilter(e.target.value)} className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black">
                    <option value="this_month">This Month</option><option value="last_month">Last Month</option><option value="all_time">All Time</option>
                </select>
                <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={filteredHistoryPayments.length === 0} title="Export to Excel">
                    <FileDown size={16} className="text-green-600" /><span className="hidden sm:inline ml-2">Excel</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={filteredHistoryPayments.length === 0} title="Download as PDF">
                    <FileDown size={16} className="text-red-600" /><span className="hidden sm:inline ml-2">PDF</span>
                </Button>
            </div>
        </div>
        
        <div className="overflow-x-auto hidden md:block">
          <table className="min-w-full">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Staff</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Request Date</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Processed Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredHistoryPayments.map((payment) => {
                const staffDetailsId = typeof payment.staffId === 'object' ? payment.staffId.id : payment.staffId;
                const staff = staffMembers.find(s => s.id === staffDetailsId);
                return (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => staff && handleOpenDetails(staff.id)}>
                      <div className="flex items-center"><img className="h-11 w-11 rounded-full object-cover" src={staff?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff?.name || '')}&background=random&color=fff`} alt={staff?.name} /><div className="ml-4"><div className="text-sm font-semibold text-gray-900">{staff?.name}</div><div className="text-sm text-gray-500">{staff?.position}</div><div className="text-xs text-gray-400">ID: {staff?.staffIdNumber || 'N/A'}</div></div></div>
                    </td>
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
                const staffDetailsId = typeof payment.staffId === 'object' ? payment.staffId.id : payment.staffId;
                const staff = staffMembers.find(s => s.id === staffDetailsId);
                return (
                    <div key={payment.id} className="p-4 active:bg-slate-50" onClick={() => staff && handleOpenDetails(staff.id)}>
                        <div className='flex justify-between items-start gap-3'>
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <img className="h-11 w-11 rounded-full object-cover flex-shrink-0" src={staff?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff?.name || '')}&background=random&color=fff`} alt={staff?.name} />
                                <div className="truncate"><p className="text-sm font-semibold text-gray-900 truncate">{staff?.name}</p><p className="text-xs text-gray-500 truncate">{staff?.position}</p></div>
                            </div>
                             <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${payment.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{payment.status}</span>
                        </div>
                        <div className='mt-4 pl-1 grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
                           <div><span className='text-xs text-gray-500 block'>Amount</span><span className='font-semibold text-gray-800'>₹{payment.amount.toLocaleString('en-IN')}</span></div>
                           <div><span className='text-xs text-gray-500 block'>Request Date</span><span className='text-gray-700'>{format(parseISO(payment.requestDate), 'dd MMM, yyyy')}</span></div>
                           <div className='col-span-2'><span className='text-xs text-gray-500 block'>Processed Date</span><span className='text-gray-700'>{payment.approvedDate ? format(parseISO(payment.approvedDate), 'dd MMM, yyyy') : 'N/A'}</span></div>
                        </div>
                    </div>
                );
            })}
             {filteredHistoryPayments.length === 0 && (<div className="text-center py-16 text-gray-500"><FileText size={40} className="mx-auto text-gray-300 mb-3" />No history available.</div>)}
            </div>
        </div>
      </div>

      {selectedStaff && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={handleCloseDetails}></div>
          <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-slate-50 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${selectedStaff ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-200 bg-white"><h2 className="text-lg sm:text-xl font-semibold text-gray-800">Employee Details</h2><button onClick={handleCloseDetails} className="p-2 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"><X size={24} /></button></div>
              <div className="flex-grow p-4 sm:p-6 overflow-y-auto">
                <div className="flex flex-col items-center mb-6 p-6 bg-white rounded-xl shadow-md border"><img className="h-24 w-24 rounded-full object-cover ring-4 ring-offset-2 ring-gray-300" src={selectedStaff.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedStaff.name)}&background=random&color=fff&size=128`} alt={selectedStaff.name} /><h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-4">{selectedStaff.name}</h3><p className="text-md text-gray-600">{selectedStaff.position}</p><p className="text-sm text-gray-500 mt-1">ID: {selectedStaff.staffIdNumber || 'N/A'}</p></div>
                <div className="grid grid-cols-2 gap-4 mb-6 sm:mb-8">
                    <div className="bg-white p-4 rounded-xl shadow-sm border text-center flex flex-col items-center justify-center"><Scale className="text-gray-500 mb-2" size={24} /><p className="text-xs sm:text-sm text-gray-500">Base Salary</p><p className="text-lg sm:text-2xl font-bold text-gray-800">₹{selectedStaff.salary?.toLocaleString('en-IN') || 'N/A'}</p></div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border text-center flex flex-col items-center justify-center"><Banknote className="text-green-500 mb-2" size={24} /><p className="text-xs sm:text-sm text-gray-500">Est. Remaining</p><p className="text-lg sm:text-2xl font-bold text-green-600">₹{remainingSalary.toLocaleString('en-IN')}</p></div>
                </div>
                <h4 className="text-lg font-semibold text-gray-800 mb-4 px-1">Advance History ({totalAdvanceCount} Approved)</h4>
                <div className="space-y-3 bg-white p-2 sm:p-4 rounded-xl shadow-sm border max-h-[40vh] overflow-y-auto">
                  {staffAdvanceHistory.length > 0 ? (
                    staffAdvanceHistory.map(adv => (
                      <div key={adv.id} className="flex items-center p-3 border-b last:border-b-0">
                        <div className={`mr-4 p-2 rounded-full ${adv.status === 'approved' ? 'bg-green-100 text-green-600' : adv.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>{adv.status === 'approved' ? <CheckCircle2 size={20} /> : adv.status === 'rejected' ? <XCircle size={20} /> : <Hourglass size={20} />}</div>
                        <div className='flex-grow min-w-0'><p className="font-bold text-gray-900 text-base sm:text-lg">₹{adv.amount.toLocaleString('en-IN')}</p><p className="text-xs text-gray-500 truncate" title={adv.reason}>Reason: <span className='italic'>{adv.reason}</span></p></div>
                        <div className='text-right ml-2 flex-shrink-0'><p className={`text-sm font-semibold capitalize ${adv.status === 'approved' ? 'text-green-700' : adv.status === 'rejected' ? 'text-red-700' : 'text-yellow-700'}`}>{adv.status}</p><p className="text-xs text-gray-500">{format(parseISO(adv.requestDate), 'dd MMM')}</p></div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 text-gray-500"><FileText size={40} className="mx-auto text-gray-300 mb-3" /><p className="font-semibold">No History Found</p><p className="text-sm">This staff member has no advance payment history.</p></div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
export default AdvancePayment;