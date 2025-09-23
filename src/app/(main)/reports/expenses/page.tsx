'use client';

import React, { useState, useEffect, useMemo, Fragment, ElementType } from 'react';
import { useSession } from 'next-auth/react';
// --- MODIFICATION: Added startOfMonth and endOfMonth ---
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Loader2, FileText, FileSpreadsheet, Eye, Banknote, ClipboardList, ArrowUpCircle, Tag, X } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Dialog, Transition } from '@headlessui/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { hasPermission, PERMISSIONS } from '../../../../lib/permissions'; // Path to your permissions file

// --- Interfaces ---
interface IExpense {
  _id: string; category: string; subCategory: string; description: string;
  amount: number; date: string; frequency: 'Regular' | 'Once';
  paymentMethod: string; billUrl?: string;
}

// --- Reusable Components (Unchanged from your original code) ---
const DashboardCard = ({ title, value, icon: Icon, colorClass, formatAsCurrency = false }: { title: string, value: string | number, icon: ElementType, colorClass: string, formatAsCurrency?: boolean }) => (
    <div className={`relative overflow-hidden rounded-xl p-5 text-white shadow-lg ${colorClass}`}>
        <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-white/20"></div>
        <Icon className="absolute top-4 right-4 h-8 w-8 text-white/50" />
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-2 text-3xl font-bold">
            {formatAsCurrency ? `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : value}
        </p>
    </div>
);

const FilePreviewModal = ({ isOpen, onClose, fileUrl }: { isOpen: boolean, onClose: () => void, fileUrl: string }) => {
    return (
        <Transition appear show={isOpen} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={onClose}>
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
              <div className="fixed inset-0 bg-black bg-opacity-75" />
            </Transition.Child>
            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4 text-center">
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                  <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                     <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 flex justify-between items-center">
                      <span>Bill Preview</span>
                      <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200"><X className="h-6 w-6 text-gray-600" /></button>
                    </Dialog.Title>
                    <div className="mt-4">
                      {fileUrl.match(/\.(pdf)$/i) ? (
                        <iframe src={fileUrl} className="w-full h-[75vh] border-0" title="Bill Preview" />
                      ) : (
                        <img src={fileUrl} alt="Bill Preview" className="max-w-full max-h-[75vh] mx-auto object-contain" />
                      )}
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      );
};

// --- Main Report Page Component ---
export default function ExpensesReportPage() {
    const { data: session, status: sessionStatus } = useSession();
    const userPermissions = session?.user?.role?.permissions || [];
    
    const [allExpenses, setAllExpenses] = useState<IExpense[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterPaymentMethod, setFilterPaymentMethod] = useState('all');
    const [filterFrequency, setFilterFrequency] = useState<'all' | 'Regular' | 'Once'>('all');
    
    // --- MODIFICATION: Default date filters to the current month ---
    const [filterStartDate, setFilterStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [filterEndDate, setFilterEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

    useEffect(() => {
        const fetchExpenses = async () => {
            if (!session?.user?.tenantId) return;
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/expenses', {
                    headers: { 'x-tenant-id': session.user.tenantId }
                });
                const result = await res.json();
                if (!res.ok || !result.success) throw new Error(result.error || 'Failed to fetch expenses.');
                setAllExpenses(result.data);
            } catch (err: any) {
                setError(err.message);
                toast.error(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        if (sessionStatus === 'authenticated') {
            fetchExpenses();
        }
    }, [sessionStatus, session]);

    // All memoized calculations are unchanged
    const uniqueCategories = useMemo(() => [...new Set(allExpenses.map(e => e.category))], [allExpenses]);
    const uniquePaymentMethods = useMemo(() => [...new Set(allExpenses.map(e => e.paymentMethod))], [allExpenses]);

    const filteredExpenses = useMemo(() => {
        return allExpenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            const start = filterStartDate ? new Date(filterStartDate) : null;
            const end = filterEndDate ? new Date(filterEndDate) : null;
            if (start) start.setHours(0, 0, 0, 0);
            if (end) end.setHours(23, 59, 59, 999);
            const categoryMatch = filterCategory === 'all' || expense.category === filterCategory;
            const paymentMatch = filterPaymentMethod === 'all' || expense.paymentMethod === filterPaymentMethod;
            const frequencyMatch = filterFrequency === 'all' || expense.frequency === filterFrequency;
            const startDateMatch = !start || expenseDate >= start;
            const endDateMatch = !end || expenseDate <= end;
            return categoryMatch && paymentMatch && startDateMatch && endDateMatch && frequencyMatch;
        });
    }, [allExpenses, filterCategory, filterPaymentMethod, filterStartDate, filterEndDate, filterFrequency]);

    const reportStats = useMemo(() => {
        const totalSpent = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const expenseCount = filteredExpenses.length;
        const highestExpense = filteredExpenses.reduce((max, exp) => (exp.amount > max ? exp.amount : max), 0);
        let mostCommonCategory = 'N/A';
        if (expenseCount > 0) {
            const categoryCounts = filteredExpenses.reduce((acc, exp) => {
                acc[exp.category] = (acc[exp.category] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            mostCommonCategory = Object.keys(categoryCounts).reduce((a, b) => (categoryCounts[a] > categoryCounts[b] ? a : b));
        }
        return { totalSpent, expenseCount, highestExpense, mostCommonCategory };
    }, [filteredExpenses]);

    const reportTotal = useMemo(() => filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0), [filteredExpenses]);
    
    // All handler functions are unchanged
    const handleViewBill = (billUrl: string) => {
        const isSupported = billUrl.match(/\.(jpeg|jpg|gif|png|webp|pdf)$/i);
        if (isSupported) {
            setPreviewUrl(billUrl);
        } else {
            window.open(billUrl, '_blank');
            toast.info("Preview not available for this file type. Opening in a new tab.");
        }
    };

    const handleExportPDF = () => {
        if (filteredExpenses.length === 0) return toast.info("No data to export.");
        const doc = new jsPDF();
        doc.text('Expenses Report', 14, 16);
        const tableColumn = ["Date", "Category", "Item/Sub-Category", "Payment Method", "Amount"];
        const tableRows = filteredExpenses.map(exp => [
            format(new Date(exp.date), 'dd-MM-yyyy'),
            exp.category,
            exp.subCategory,
            exp.paymentMethod,
            `Rs. ${exp.amount.toFixed(2)}`
        ]);
        autoTable(doc, { head: [tableColumn], body: tableRows, startY: 25, foot: [['Total', '', '', '', `Rs. ${reportTotal.toFixed(2)}`]] });
        doc.save('expenses_report.pdf');
    };

    const handleExportExcel = () => {
        if (filteredExpenses.length === 0) return toast.info("No data to export.");
        const worksheetData = filteredExpenses.map(exp => ({
            "Date": format(new Date(exp.date), 'yyyy-MM-dd'),
            "Category": exp.category,
            "Item": exp.subCategory,
            "Description": exp.description,
            "Payment Method": exp.paymentMethod,
            "Frequency": exp.frequency,
            "Amount": exp.amount,
            "Bill URL": exp.billUrl || 'N/A'
        }));
        worksheetData.push({ "Date": "TOTAL", "Amount": reportTotal } as any);
        const ws = XLSX.utils.json_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Expenses");
        XLSX.writeFile(wb, "expenses_report.xlsx");
    };

    if (sessionStatus === 'loading') {
      return <div className="p-8 text-center"><Loader2 className="animate-spin inline-block"/> Loading...</div>;
    }

    return (
        <div className="p-6 sm:p-8 bg-gray-50 min-h-screen">
            <ToastContainer position="top-right" autoClose={3000} />
            
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Expenses Report</h1>
                <p className="text-gray-500 mt-1">An overview of all recorded expenses.</p>
            </header>

            <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <DashboardCard title="Total Spent" value={reportStats.totalSpent} icon={Banknote} colorClass="bg-gradient-to-br from-pink-500 to-rose-500" formatAsCurrency={true} />
                <DashboardCard title="Number of Expenses" value={reportStats.expenseCount} icon={ClipboardList} colorClass="bg-gradient-to-br from-teal-400 to-cyan-500" />
                <DashboardCard title="Highest Expense" value={reportStats.highestExpense} icon={ArrowUpCircle} colorClass="bg-gradient-to-br from-purple-500 to-indigo-600" formatAsCurrency={true} />
                <DashboardCard title="Most Common Category" value={reportStats.mostCommonCategory} icon={Tag} colorClass="bg-gradient-to-br from-amber-500 to-orange-600" />
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="form-input" placeholder="Start Date"/>
                    <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="form-input" placeholder="End Date"/>
                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="form-select">
                        <option value="all">All Categories</option>
                        {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                     <select value={filterPaymentMethod} onChange={e => setFilterPaymentMethod(e.target.value)} className="form-select">
                        <option value="all">All Payment Methods</option>
                        {uniquePaymentMethods.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                    </select>
                    <select value={filterFrequency} onChange={e => setFilterFrequency(e.target.value as any)} className="form-select">
                        <option value="all">All Frequencies</option>
                        <option value="Regular">Regular</option>
                        <option value="Once">Once</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-md border">
                {hasPermission(userPermissions, PERMISSIONS.REPORT_EXPENSES_MANAGE) && (
                    <div className="p-4 flex justify-end items-center gap-3 border-b">
                        {/* --- UI MODIFICATION: More attractive buttons --- */}
                        <button 
                            onClick={handleExportPDF} 
                            className="flex items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition-all hover:bg-red-100 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        >
                            <FileText size={16} />
                            <span>Export PDF</span>
                        </button>
                        <button 
                            onClick={handleExportExcel} 
                            className="flex items-center justify-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-sm font-semibold text-green-800 shadow-sm transition-all hover:bg-green-100 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
                        >
                            <FileSpreadsheet size={16} />
                            <span>Export Excel</span>
                        </button>
                    </div>
                )}

                <div className="overflow-x-auto">
                    {isLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin inline-block"/> Loading...</div> :
                    error ? <div className="p-10 text-center text-red-600 bg-red-50">{error}</div> :
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 uppercase">
                            <tr>
                                <th className="p-4 font-semibold">Date</th>
                                <th className="p-4 font-semibold">Category</th>
                                <th className="p-4 font-semibold">Item / Description</th>
                                <th className="p-4 font-semibold">Payment Method</th>
                                <th className="p-4 font-semibold text-right">Amount</th>
                                <th className="p-4 font-semibold text-center">Bill</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredExpenses.length === 0 ? (
                                <tr><td colSpan={6} className="p-10 text-center text-gray-500">No expenses found.</td></tr>
                            ) : (
                                filteredExpenses.map((exp) => (
                                    <tr key={exp._id} className="hover:bg-gray-50">
                                        <td className="p-4 text-gray-600">{format(new Date(exp.date), 'dd MMM, yyyy')}</td>
                                        <td className="p-4 font-medium text-gray-800">{exp.category}</td>
                                        <td className="p-4">
                                            <div className="text-gray-700">{exp.subCategory}</div>
                                            <div className="text-xs text-gray-500">{exp.description}</div>
                                        </td>
                                        <td className="p-4 text-gray-600">{exp.paymentMethod} <span className="text-gray-400">({exp.frequency})</span></td>
                                        <td className="p-4 text-right font-semibold text-gray-900">₹{exp.amount.toLocaleString('en-IN')}</td>
                                        <td className="p-4 text-center">
                                            {exp.billUrl ? (
                                                <button onClick={() => handleViewBill(exp.billUrl!)} className="text-blue-600 hover:underline inline-flex items-center gap-1.5"><Eye size={16}/> View</button>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-gray-100 border-t-2">
                            <tr>
                                <td colSpan={4} className="p-4 text-right font-bold text-gray-800">TOTAL</td>
                                <td className="p-4 text-right font-bold text-xl text-gray-900">₹{reportTotal.toLocaleString('en-IN')}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                    }
                </div>
            </div>
            {previewUrl && <FilePreviewModal isOpen={!!previewUrl} onClose={() => setPreviewUrl(null)} fileUrl={previewUrl} />}
        </div>
    );
};