'use client';

import { useState, useEffect, FormEvent, useMemo, Fragment, ChangeEvent } from 'react';
import { Session } from 'next-auth';
import { useSession } from 'next-auth/react';

import {
  PlusCircleIcon,
  DocumentChartBarIcon,
  XMarkIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
  ArrowUpCircleIcon,
  TagIcon,
  ArrowDownTrayIcon,
  CreditCardIcon, 
  ArrowPathIcon,
  DocumentArrowUpIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const getApiHeaders = (tenantId?: string) => {
    const headers = new Headers();
    if (!tenantId) throw new Error('Tenant ID is missing. Cannot make API request.');
    headers.append('x-tenant-id', tenantId);
    return headers;
};

const handleApiError = async (response: Response) => {
    try {
        const errorData = await response.json();
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
    } catch (e) {
        if (e instanceof Error) throw e;
        throw new Error(`An unexpected error occurred: ${response.statusText}`);
    }
};

const api = {
    get: async (url: string, session: Session | null) => {
        if (!session?.user?.tenantId) throw new Error('Authentication session not found.');
        const response = await fetch(url, { method: 'GET', headers: getApiHeaders(session.user.tenantId) });
        if (!response.ok) await handleApiError(response);
        return response.json();
    },
    post: async (url: string, body: FormData, session: Session | null) => {
        if (!session?.user?.tenantId) throw new Error('Authentication session not found.');
        const response = await fetch(url, { method: 'POST', headers: getApiHeaders(session.user.tenantId), body });
        if (!response.ok) await handleApiError(response);
        return response.json();
    },
    put: async (url: string, body: FormData, session: Session | null) => {
        if (!session?.user?.tenantId) throw new Error('Authentication session not found.');
        const response = await fetch(url, { method: 'PUT', headers: getApiHeaders(session.user.tenantId), body });
        if (!response.ok) await handleApiError(response);
        return response.json();
    },
    delete: async (url: string, session: Session | null) => {
        if (!session?.user?.tenantId) throw new Error('Authentication session not found.');
        const response = await fetch(url, { method: 'DELETE', headers: getApiHeaders(session.user.tenantId) });
        if (!response.ok) await handleApiError(response);
        return response.json();
    }
};

interface IExpense {
  _id: string;
  type: string;
  description: string;
  amount: number;
  date: string;
  frequency: 'Regular' | 'Once';
  paymentMethod: string;
  billUrl?: string;
}

interface ExpenseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  historyData: IExpense[];
  onEdit: (expense: IExpense) => void;
  onDelete: (expenseId: string) => void;
}

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  fileType: string;
}

function ExpenseDetailsModal({ isOpen, onClose, title, historyData, onEdit, onDelete }: ExpenseDetailsModalProps) {
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<{ url: string; name: string; type: string } | null>(null);
  
  const modalTotal = historyData.reduce((sum, expense) => sum + expense.amount, 0);

  const handleViewBill = (billUrl: string) => {
    const fileName = billUrl.split('?')[0].split('/').pop() || 'bill';
    const extension = (fileName.split('.').pop() || '').toLowerCase();
    let fileType = '';

    if (extension === 'pdf') {
      fileType = 'application/pdf';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
      fileType = `image/${extension}`;
    }

    if (fileType) {
      setSelectedBill({ url: billUrl, name: fileName, type: fileType });
      setIsPreviewModalOpen(true);
    } else {
      window.open(billUrl, '_blank');
      toast.info("Preview not available for this file type. Opening in a new tab.");
    }
  };

  const handlePdfDownload = () => {
    const doc = new jsPDF();
    doc.text(`Expenses Report - ${title}`, 14, 22);
    const tableColumn = ["Date", "Type", "Description", "Frequency", "Payment", "Amount", "Bill"];
    const tableRows: (string | number)[][] = [];

    historyData.forEach(expense => {
      const expenseData = [
        new Date(expense.date).toLocaleDateString('en-GB'),
        expense.type,
        expense.description || 'N/A',
        expense.frequency,
        expense.paymentMethod,
        `₹${expense.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        expense.billUrl ? 'Attached' : 'N/A'
      ];
      tableRows.push(expenseData);
    });

    autoTable(doc, {
      head: [tableColumn], 
      body: tableRows, 
      startY: 30, 
      theme: 'grid',
      headStyles: { fillColor: [34, 41, 47] },
      columnStyles: {
        5: { halign: 'right' },
        6: { halign: 'center' }
      },
      foot: [[
        { content: 'TOTAL', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fontSize: 10 } },
        { content: `₹${modalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { halign: 'right', fontStyle: 'bold', fontSize: 10 } },
        { content: '', styles: {} }
      ]],
      footStyles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0] }
    });
    doc.save(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.pdf`);
  };

  const handleCsvDownload = () => {
    const safeTitle = title || "Untitled Report";
    const reportTitle = `"${`Expenses Report - ${safeTitle}`.replace(/"/g, '""')}"\r\n\r\n`;
    const tableColumn = ["Date", "Type", "Description", "Frequency", "Payment Method", "Amount", "Bill URL"];
    const escapeCsvCell = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
    let csvContent = reportTitle + tableColumn.join(',') + '\r\n';

    historyData.forEach(expense => {
      const row = [
        `'${new Date(expense.date).toLocaleDateString('en-GB')}`,
        escapeCsvCell(expense.type || 'N/A'),
        escapeCsvCell(expense.description || 'N/A'),
        expense.frequency || 'N/A',
        escapeCsvCell(expense.paymentMethod || 'N/A'),
        expense.amount.toFixed(2),
        expense.billUrl || ''
      ].join(',');
      csvContent += row + '\r\n';
    });

    csvContent += `\r\n,,,,,Total,${modalTotal.toFixed(2)}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${safeTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Fragment>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-7xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all border-t-4 border-gray-800">
                  <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900 flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <DocumentChartBarIcon className="h-7 w-7 text-gray-700"/>
                      <span className="block text-gray-600 font-normal">{title}</span>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 transition-colors">
                      <XMarkIcon className="h-6 w-6 text-gray-600" />
                    </button>
                  </Dialog.Title>
                  <div className="mt-6">
                    <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100 sticky top-0 z-10">
                          <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Bill</th>
                            <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 [&>*:nth-child(even)]:bg-slate-50">
                          {historyData.map(expense => (
                            <tr key={expense._id} className="hover:bg-gray-100">
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                {new Date(expense.date).toLocaleDateString('en-GB')}
                                <span className="block text-xs text-gray-400">
                                  {new Date(expense.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{expense.type}</td>
                              <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate" title={expense.description}>{expense.description || <span className="text-gray-400">N/A</span>}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{expense.paymentMethod} <span className="text-gray-400">({expense.frequency})</span></td>
                              <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">₹{expense.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-center text-sm">
                                {expense.billUrl ? (
                                  <button onClick={() => handleViewBill(expense.billUrl!)} className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                                    <EyeIcon className="h-4 w-4"/> View
                                  </button>
                                ) : ( <span className="text-gray-400">N/A</span> )}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium">
                                <div className="flex justify-center items-center gap-4">
                                  <button onClick={() => onEdit(expense)} className="text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1">
                                    <PencilIcon className="h-4 w-4" /> Edit
                                  </button>
                                  <button onClick={() => onDelete(expense._id)} className="text-red-600 hover:text-red-800 transition-colors flex items-center gap-1">
                                    <TrashIcon className="h-4 w-4" /> Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100 sticky bottom-0 border-t-2 border-gray-300">
                            <tr>
                              <td colSpan={4} className="px-4 py-4 text-right text-sm font-bold text-gray-800 uppercase">Total</td>
                              <td className="px-4 py-4 text-right text-sm font-bold text-gray-900">₹{modalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td colSpan={2}></td>
                            </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end items-center gap-3">
                      <button onClick={handleCsvDownload} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors">
                          <ArrowDownTrayIcon className="h-4 w-4" /> Export to Excel (CSV)
                      </button>
                      <button onClick={handlePdfDownload} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-900 transition-colors">
                          <ArrowDownTrayIcon className="h-4 w-4" /> Download PDF
                      </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
      {selectedBill && (<FilePreviewModal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} fileUrl={selectedBill.url} fileName={selectedBill.name} fileType={selectedBill.type}/>)}
    </Fragment>
  );
}

function FilePreviewModal({ isOpen, onClose, fileUrl, fileName, fileType }: FilePreviewModalProps) {
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
                  <span>Preview: {fileName}</span>
                  <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 transition-colors">
                    <XMarkIcon className="h-6 w-6 text-gray-600" />
                  </button>
                </Dialog.Title>
                <div className="mt-4">
                  {fileType.startsWith('image/') ? (
                    <img src={fileUrl} alt={`Preview of ${fileName}`} className="max-w-full max-h-[75vh] mx-auto object-contain" />
                  ) : fileType === 'application/pdf' ? (
                    <iframe src={fileUrl} className="w-full h-[75vh] border-0" title={`Preview of ${fileName}`} />
                  ) : (
                    <div className="text-center p-10 bg-gray-100 rounded-md">
                      <p className="font-semibold">Preview not available</p>
                      <p className="text-sm text-gray-600">This file type cannot be displayed directly.</p>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default function ExpensesPage() {
  const { data: session } = useSession();

  const [allExpenses, setAllExpenses] = useState<IExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [type, setType] = useState('');
  const [expenseTypes, setExpenseTypes] = useState<string[]>(['Tea', 'Coffee', 'Snacks', 'General']);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseTime, setExpenseTime] = useState(new Date().toTimeString().substring(0, 5));
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billPreviewUrl, setBillPreviewUrl] = useState<string | null>(null);
  const [existingBillUrl, setExistingBillUrl] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [frequency, setFrequency] = useState<'Regular' | 'Once'>('Regular');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['Cash', 'UPI', 'Card']);
  const [showAddType, setShowAddType] = useState(false);
  const [newType, setNewType] = useState('');
  const [typeError, setTypeError] = useState<string | null>(null);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [paymentMethodError, setPaymentMethodError] = useState<string | null>(null);
  
  const [filterType, setFilterType] = useState('all');
  const [filterFrequency, setFilterFrequency] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<{ title: string, data: IExpense[] }>({ title: '', data: [] });
  const [historyView, setHistoryView] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [isTypeListVisible, setIsTypeListVisible] = useState(false);

  // --- MODIFIED DATA FETCHING LOGIC ---
  useEffect(() => {
    if (session) {
      const fetchAllData = async () => {
        setIsLoading(true);
        try {
          // Fetch expenses and budget categories in parallel for better performance
          const [expensesResponse, budgetCategoriesResponse] = await Promise.all([
            api.get('/api/expenses', session),
            api.get('/api/budget-categories', session) // <-- NEW: Fetching from our new route
          ]);

          let fetchedExpenseTypes: string[] = [];
          if (expensesResponse.success) {
            setAllExpenses(expensesResponse.data);
            fetchedExpenseTypes = Array.from(new Set(expensesResponse.data.map((exp: IExpense) => exp.type).filter(Boolean)));
            
            const fetchedMethods = expensesResponse.data.map((exp: IExpense) => exp.paymentMethod).filter(Boolean);
            const initialMethods = ['Cash', 'UPI', 'Card'];
            setPaymentMethods(Array.from(new Set([...initialMethods, ...fetchedMethods])));
          } else {
            throw new Error(expensesResponse.error || "Failed to fetch expenses.");
          }

          let fetchedBudgetCategories: string[] = [];
          if (budgetCategoriesResponse.success) {
            fetchedBudgetCategories = budgetCategoriesResponse.data;
          } else {
            // Log error but don't block the UI if categories fail to load
            console.error("Could not fetch budget categories:", budgetCategoriesResponse.error);
          }
          
          // Combine all sources of types (initial, from expenses, from budget) into one unique list
          const initialTypes = ['Tea', 'Coffee', 'Snacks', 'General'];
          const combinedTypes = new Set([
              ...initialTypes, 
              ...fetchedExpenseTypes, 
              ...fetchedBudgetCategories
          ]);
          setExpenseTypes(Array.from(combinedTypes));

        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Could not fetch required data.";
          toast.error(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchAllData();
    }
  }, [session]);

  useEffect(() => {
    return () => {
      if (billPreviewUrl && billFile) {
        URL.revokeObjectURL(billPreviewUrl);
      }
    };
  }, [billPreviewUrl, billFile]);

  // --- THIS FUNCTION IS NO LONGER USED, AS FETCHING IS COMBINED IN THE useEffect ABOVE ---
  // const fetchExpenses = async () => { ... } 

  const resetForm = () => {
    setEditingExpenseId(null);
    setType('');
    setDescription('');
    setAmount('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setExpenseTime(new Date().toTimeString().substring(0, 5));
    setFrequency('Regular');
    setPaymentMethod(paymentMethods[0] || '');
    handleRemoveFile();
  };

  const handleRemoveFile = () => {
    if (billPreviewUrl && billFile) {
      URL.revokeObjectURL(billPreviewUrl);
    }
    setBillFile(null);
    setBillPreviewUrl(null);
    setExistingBillUrl(null);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };
  
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    handleRemoveFile();
    if (file) {
      setBillFile(file);
      setBillPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!type || !amount || !expenseDate || !expenseTime || !frequency || !paymentMethod) {
      toast.warn("Please fill all required fields.");
      return;
    }

    const submissionDate = new Date(`${expenseDate}T${expenseTime}`);
    const formData = new FormData();
    formData.append('type', type);
    formData.append('description', description);
    formData.append('amount', amount);
    formData.append('date', submissionDate.toISOString());
    formData.append('frequency', frequency);
    formData.append('paymentMethod', paymentMethod);
    
    if (billFile) {
        formData.append('billFile', billFile);
    } else if (existingBillUrl) {
        formData.append('billUrl', existingBillUrl);
    }

    const isEditing = !!editingExpenseId;
    const toastId = toast.loading(`${isEditing ? 'Updating' : 'Submitting'} expense...`);

    try {
      let response;
      if (isEditing) {
        response = await api.put(`/api/expenses/${editingExpenseId}`, formData, session);
      } else {
        response = await api.post('/api/expenses', formData, session);
      }
      toast.update(toastId, { render: `Expense ${isEditing ? 'updated' : 'added'} successfully!`, type: 'success', isLoading: false, autoClose: 3000 });
      resetForm();
      
      // Refresh data after submission
      if(session) {
         // A simple re-fetch of expenses is sufficient here, no need to re-fetch categories
         const expensesResponse = await api.get('/api/expenses', session);
         if (expensesResponse.success) setAllExpenses(expensesResponse.data);
      }
    } catch (err) { 
        const errorMessage = err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'add'} expense.`;
        toast.update(toastId, { render: errorMessage, type: 'error', isLoading: false, autoClose: 5000 });
    }
  };
  
  const handleEditClick = (expense: IExpense) => {
    setIsModalOpen(false);
    const formElement = document.getElementById('expense-form-container');
    formElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    setEditingExpenseId(expense._id);
    setType(expense.type);
    setDescription(expense.description || '');
    setAmount(String(expense.amount));
    
    const expenseLocalDate = new Date(expense.date);
    setExpenseDate(expenseLocalDate.toISOString().split('T')[0]);
    setExpenseTime(expenseLocalDate.toTimeString().substring(0, 5));
    
    setFrequency(expense.frequency);
    setPaymentMethod(expense.paymentMethod);
    
    handleRemoveFile();
    if (expense.billUrl) {
        setExistingBillUrl(expense.billUrl);
        setBillPreviewUrl(expense.billUrl);
    }
  };

  const handleDeleteClick = async (expenseId: string) => {
    if (!window.confirm("Are you sure you want to delete this expense? This action cannot be undone.")) {
        return;
    }
    const toastId = toast.loading("Deleting expense...");
    try {
        await api.delete(`/api/expenses/${expenseId}`, session);
        toast.update(toastId, { render: "Expense deleted successfully!", type: "success", isLoading: false, autoClose: 3000 });
        setIsModalOpen(false);
         // Refresh data after deletion
         if(session) {
            const expensesResponse = await api.get('/api/expenses', session);
            if (expensesResponse.success) setAllExpenses(expensesResponse.data);
         }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to delete expense.";
        toast.update(toastId, { render: errorMessage, type: "error", isLoading: false, autoClose: 5000 });
    }
  };
  
  // All other handlers and memoized values remain the same...
  const todayStats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todaysExpenses = allExpenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= todayStart && expenseDate <= todayEnd;
    });
    const totalSpent = todaysExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const expenseCount = todaysExpenses.length;
    const highestExpense = todaysExpenses.reduce((max, exp) => exp.amount > max ? exp.amount : max, 0);
    let mostCommonType = 'N/A';
    if (todaysExpenses.length > 0) {
        const typeCounts = todaysExpenses.reduce((acc, exp) => {
            if (exp.type) acc[exp.type] = (acc[exp.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        mostCommonType = Object.keys(typeCounts).reduce((a, b) => typeCounts[a] > typeCounts[b] ? a : b, 'N/A');
    }
    return { totalSpent, expenseCount, highestExpense, mostCommonType };
  }, [allExpenses]);


  const filteredExpenses = useMemo(() => {
    return allExpenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      const start = filterStartDate ? new Date(filterStartDate) : null;
      const end = filterEndDate ? new Date(filterEndDate) : null;
      if (start) start.setHours(0, 0, 0, 0);
      if (end) end.setHours(23, 59, 59, 999);
      const typeMatch = filterType === 'all' || expense.type === filterType;
      const frequencyMatch = filterFrequency === 'all' || expense.frequency === filterFrequency;
      const startDateMatch = !start || expenseDate >= start;
      const endDateMatch = !end || expenseDate <= end;
      return typeMatch && startDateMatch && endDateMatch && frequencyMatch;
    });
  }, [allExpenses, filterType, filterFrequency, filterStartDate, filterEndDate]);


  const groupedAndSortedExpenses = useMemo(() => {
    const groupedByDate = filteredExpenses.reduce((acc, expense) => {
      const dateKey = new Date(expense.date).toDateString();
      if (!acc[dateKey]) acc[dateKey] = { total: 0, count: 0, records: [] as IExpense[] };
      acc[dateKey].total += expense.amount;
      acc[dateKey].count += 1;
      acc[dateKey].records.push(expense);
      return acc;
    }, {} as Record<string, { total: number, count: number, records: IExpense[] }>);
    return Object.entries(groupedByDate).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [filteredExpenses]);

  const weeklyGroupedExpenses = useMemo(() => {
    const getStartOfWeek = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(date.setDate(diff));
      startOfWeek.setHours(0, 0, 0, 0);
      return startOfWeek;
    };
    const groupedByWeek = filteredExpenses.reduce((acc, expense) => {
      const weekStart = getStartOfWeek(new Date(expense.date));
      const weekKey = weekStart.toISOString();
      if (!acc[weekKey]) acc[weekKey] = { total: 0, count: 0, records: [] as IExpense[] };
      acc[weekKey].total += expense.amount;
      acc[weekKey].count += 1;
      acc[weekKey].records.push(expense);
      return acc;
    }, {} as Record<string, { total: number, count: number, records: IExpense[] }>);
    return Object.entries(groupedByWeek).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [filteredExpenses]);
  
  const monthlyGroupedExpenses = useMemo(() => {
    const groupedByMonth = filteredExpenses.reduce((acc, expense) => {
      const expenseDate = new Date(expense.date);
      const monthStart = new Date(expenseDate.getFullYear(), expenseDate.getMonth(), 1);
      const monthKey = monthStart.toISOString();
      if (!acc[monthKey]) acc[monthKey] = { total: 0, count: 0, records: [] as IExpense[] };
      acc[monthKey].total += expense.amount;
      acc[monthKey].count += 1;
      acc[monthKey].records.push(expense);
      return acc;
    }, {} as Record<string, { total: number, count: number, records: IExpense[] }>);
    return Object.entries(groupedByMonth).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [filteredExpenses]);

    const handleAddType = () => {
    setTypeError(null);
    const trimmedNewType = newType.trim();
    if (!trimmedNewType) { setTypeError("New type name cannot be empty."); return; }
    if (expenseTypes.some(t => t && t.toLowerCase() === trimmedNewType.toLowerCase())) { 
        setTypeError(`Type "${trimmedNewType}" already exists.`); 
        return; 
    }
    const updatedTypes = [...expenseTypes, trimmedNewType];
    setExpenseTypes(updatedTypes);
    setType(trimmedNewType);
    setNewType('');
    setShowAddType(false);
  };
  
  const handleAddPaymentMethod = () => {
    setPaymentMethodError(null);
    const trimmedNewMethod = newPaymentMethod.trim();
    if (!trimmedNewMethod) { setPaymentMethodError("Method name cannot be empty."); return; }
    if (paymentMethods.some(pm => pm && pm.toLowerCase() === trimmedNewMethod.toLowerCase())) { 
        setPaymentMethodError(`Method "${trimmedNewMethod}" already exists.`); 
        return; 
    }
    const updatedMethods = [...paymentMethods, trimmedNewMethod];
    setPaymentMethods(updatedMethods);
    setPaymentMethod(trimmedNewMethod);
    setNewPaymentMethod('');
    setShowAddPaymentMethod(false);
  };

  const handleViewHistory = (title: string, records: IExpense[] ) => {
    setSelectedHistory({ title, data: records });
    setIsModalOpen(true);
  };
  
  const getHistoryItemTitle = (dateString: string, view: typeof historyView) => {
    const date = new Date(dateString);
    if (view === 'Daily') return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    if (view === 'Weekly') {
        const endOfWeek = new Date(date);
        endOfWeek.setDate(date.getDate() + 6);
        return `Week of ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    if (view === 'Monthly') return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return '';
  };
  
  const dataToRender = {
    'Daily': groupedAndSortedExpenses,
    'Weekly': weeklyGroupedExpenses,
    'Monthly': monthlyGroupedExpenses,
  }[historyView];

  const filteredExpenseTypes = expenseTypes.filter((t) =>
    t.toLowerCase().startsWith(type.toLowerCase())
  );

  return (
    <div className="bg-gray-100 min-h-screen">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light"/>
      <div className="container mx-auto p-4 md:p-8 max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Expense Dashboard</h1>
              <p className="text-gray-500 mt-1">Today's expense summary and history.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full sm:w-auto bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="all">All Types</option>
                    {expenseTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={filterFrequency} onChange={e => setFilterFrequency(e.target.value)} className="w-full sm:w-auto bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="all">All Frequencies</option>
                    <option value="Regular">Regular</option>
                    <option value="Once">Once</option>
                </select>
                <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-full sm:w-auto bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="w-full sm:w-auto bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
        </div>
        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 p-5 text-white shadow-lg"><div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-white/20"></div><BanknotesIcon className="absolute top-4 right-4 h-8 w-8 text-white/50" /><p className="text-sm font-medium text-rose-100">Total Spent Today</p><p className="mt-2 text-3xl font-bold">₹{todayStats.totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 p-5 text-white shadow-lg"><div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-white/20"></div><ClipboardDocumentListIcon className="absolute top-4 right-4 h-8 w-8 text-white/50" /><p className="text-sm font-medium text-cyan-100">Number of Expenses</p><p className="mt-2 text-3xl font-bold">{todayStats.expenseCount}</p></div>
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 p-5 text-white shadow-lg"><div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-white/20"></div><ArrowUpCircleIcon className="absolute top-4 right-4 h-8 w-8 text-white/50" /><p className="text-sm font-medium text-indigo-100">Highest Expense</p><p className="mt-2 text-3xl font-bold">₹{todayStats.highestExpense.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white shadow-lg"><div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-white/20"></div><TagIcon className="absolute top-4 right-4 h-8 w-8 text-white/50" /><p className="text-sm font-medium text-orange-100">Most Common Type</p><p className="mt-2 text-3xl font-bold truncate">{todayStats.mostCommonType}</p></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div id="expense-form-container" className="bg-white p-6 rounded-lg shadow-md flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-700 flex items-center">
                    <PlusCircleIcon className="h-6 w-6 mr-2 text-gray-500" />
                    {editingExpenseId ? 'Edit Expense' : 'Add New Expense'}
                </h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 flex-grow flex flex-col">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Frequency</label>
                      <div className="flex w-full space-x-1 rounded-lg bg-gray-200 p-1">
                          {(['Regular', 'Once'] as const).map(f => (<button type="button" key={f} onClick={() => setFrequency(f)} className={`w-full rounded-md py-1.5 text-sm font-medium leading-5 transition-colors focus:outline-none ${frequency === f ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:bg-white/50'}`}>{f}</button>))}
                      </div>
                  </div>
                  <div>
                      <label htmlFor="amount" className="block text-sm font-medium text-gray-600">Amount</label>
                      <div className="relative mt-1 rounded-md shadow-sm"><div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><span className="text-gray-500 sm:text-sm">₹</span></div><input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="block w-full rounded-md border-gray-300 py-2 pl-7 pr-2 shadow-sm focus:border-gray-500 focus:ring-gray-500" required placeholder="1250.50" step="0.01"/></div>
                  </div>
              </div>
              <div className="relative">
                <div className="flex justify-between items-baseline">
                  <label htmlFor="type-search" className="block text-sm font-medium text-gray-600">Expense Type</label>
                  <button type="button" onClick={() => setShowAddType(!showAddType)} className="text-xs font-semibold text-gray-600 hover:text-gray-900">{showAddType ? 'Cancel' : 'Add New'}</button>
                </div>
                <input
                  id="type-search"
                  type="text"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  onFocus={() => setIsTypeListVisible(true)}
                  onBlur={() => setTimeout(() => setIsTypeListVisible(false), 200)} 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                  placeholder="Search the expenses type"
                  autoComplete="off"
                  required
                />
                {/* --- MODIFIED: Show list only when focused AND there is input text --- */}
                {isTypeListVisible && type && (
                  <ul className="absolute z-20 mt-1 w-full bg-white shadow-lg max-h-56 rounded-md py-1 ring-1 ring-black ring-opacity-5 overflow-auto text-sm">
                    {filteredExpenseTypes.length > 0 ? (
                      filteredExpenseTypes.map((t) => (
                        <li
                          key={t}
                          className="text-gray-900 cursor-pointer select-none relative py-2 px-4 hover:bg-gray-100"
                          onMouseDown={() => {
                            setType(t);
                            setIsTypeListVisible(false);
                          }}
                        >
                          {t}
                        </li>
                      ))
                    ) : (
                      <li className="text-gray-500 cursor-default select-none relative py-2 px-4">
                        No types found.
                      </li>
                    )}
                  </ul>
                )}
              </div>
              {showAddType && (<div className="p-3 bg-gray-50 rounded-md border border-gray-200"><div className="flex items-center space-x-2"><input type="text" value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="New type name" className="flex-grow block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 text-sm"/><button type="button" onClick={handleAddType} className="flex-shrink-0 px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 text-sm font-medium">Add</button></div>{typeError && <p className="mt-2 text-sm text-red-500">{typeError}</p>}</div>)}
              <div>
                  <div className="flex justify-between items-baseline"><label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-600">Payment Method</label><button type="button" onClick={() => setShowAddPaymentMethod(!showAddPaymentMethod)} className="text-xs font-semibold text-gray-600 hover:text-gray-900">{showAddPaymentMethod ? 'Cancel' : 'Add New'}</button></div>
                  <select id="paymentMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500">{paymentMethods.map((pm) => <option key={pm} value={pm}>{pm}</option>)}</select>
              </div>
              {showAddPaymentMethod && (<div className="p-3 bg-gray-50 rounded-md border border-gray-200"><div className="flex items-center space-x-2"><input type="text" value={newPaymentMethod} onChange={(e) => setNewPaymentMethod(e.target.value)} placeholder="New method name" className="flex-grow block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 text-sm"/><button type="button" onClick={handleAddPaymentMethod} className="flex-shrink-0 px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 text-sm font-medium">Add</button></div>{paymentMethodError && <p className="mt-2 text-sm text-red-500">{paymentMethodError}</p>}</div>)}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label htmlFor="expenseDate" className="block text-sm font-medium text-gray-600">Date</label><input id="expenseDate" type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required /></div>
                  <div><label htmlFor="expenseTime" className="block text-sm font-medium text-gray-600">Time</label><input id="expenseTime" type="time" value={expenseTime} onChange={e => setExpenseTime(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required /></div>
              </div>
              <div className="flex-grow flex flex-col space-y-4">
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-600">Description (Optional)</label>
                  <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" placeholder="e.g., Lunch meeting with client"></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Attach Bill (Optional)</label>
                  <div className="mt-1">
                    {!(billFile || existingBillUrl) && (
                      <label htmlFor="file-upload" className="relative cursor-pointer flex justify-center items-center w-full p-4 border-2 border-gray-300 border-dashed rounded-md hover:border-indigo-500 transition-colors bg-gray-50 hover:bg-indigo-50">
                        <div className="space-y-1 text-center">
                          <DocumentArrowUpIcon className="mx-auto h-10 w-10 text-gray-400" />
                          <div className="flex text-sm text-gray-600"><span className="font-medium text-indigo-600">Click to upload a file</span><input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*,.pdf" /></div>
                          <p className="text-xs text-gray-500">PNG, JPG, PDF up to 10MB</p>
                        </div>
                      </label>
                    )}
                    {(billFile || existingBillUrl) && billPreviewUrl && (
                      <div className="flex items-center justify-between gap-4 p-3 border border-gray-300 rounded-md bg-gray-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{billFile?.name || existingBillUrl?.split('/').pop()}</p>
                          {billFile && <p className="text-sm text-gray-500">{ (billFile.size / 1024).toFixed(1) } KB</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button type="button" onClick={() => setIsPreviewModalOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors rounded-md hover:bg-indigo-50"><EyeIcon className="h-4 w-4" /> View</button>
                          <button type="button" onClick={handleRemoveFile} className="p-1.5 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-700 transition-colors" aria-label="Remove file"><XMarkIcon className="h-5 w-5" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-auto flex items-center gap-4">
                <button type="submit" className="w-full bg-gray-800 text-white py-2.5 px-4 rounded-md hover:bg-gray-900 font-semibold transition-colors">
                    {editingExpenseId ? 'Update Expense' : 'Submit Expense'}
                </button>
                {editingExpenseId && (
                  <button type="button" onClick={resetForm} className="w-full bg-gray-200 text-gray-800 py-2.5 px-4 rounded-md hover:bg-gray-300 font-semibold transition-colors">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col h-full">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Expense History</h2>
            <div className="flex w-full space-x-1 rounded-lg bg-gray-200 p-1 mb-4">
                {(['Daily', 'Weekly', 'Monthly'] as const).map(view => (<button key={view} onClick={() => setHistoryView(view)} className={`w-full rounded-md py-1.5 text-sm font-medium leading-5 transition-colors focus:outline-none ${historyView === view ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:bg-white/50'}`}>{view}</button>))}
            </div>
            <div className="relative flex-grow">
              <div className="absolute inset-0 overflow-y-auto pr-2">
                {isLoading && <p className="p-4 text-center text-gray-500">Loading history...</p>}
                {!isLoading && (
                  <div className="space-y-4">
                    {dataToRender.length > 0 ? (
                      dataToRender.map(([dateString, data]) => {
                        const title = getHistoryItemTitle(dateString, historyView);
                        return (
                          <div key={dateString} className="p-4 border rounded-lg flex items-center justify-between bg-gray-50 hover:shadow-sm transition-shadow">
                            <div className="flex items-center gap-4">
                              <div className="flex-shrink-0 bg-gray-100 p-3 rounded-lg"><CalendarDaysIcon className="h-6 w-6 text-gray-600" /></div>
                              <div>
                                <h3 className="font-bold text-lg text-gray-800">{title}</h3>
                                <p className="text-sm text-gray-500">{data.count} records found. Total: <span className="font-semibold text-gray-600">₹{data.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                              </div>
                            </div>
                            <button onClick={() => handleViewHistory(title, data.records)} className="bg-gray-800 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-900 text-sm transition-colors">View Details</button>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center py-10 border-2 border-dashed border-gray-300 rounded-lg h-full flex flex-col justify-center">
                          <DocumentChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
                          <h3 className="mt-2 text-sm font-medium text-gray-900">No records found</h3>
                          <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or add a new expense.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ExpenseDetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedHistory.title} historyData={selectedHistory.data} onEdit={handleEditClick} onDelete={handleDeleteClick} />
      {billPreviewUrl && (
        <FilePreviewModal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} fileUrl={billPreviewUrl} fileName={billFile?.name || existingBillUrl?.split('/').pop() || 'file'} fileType={billFile?.type || (billPreviewUrl.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')}/>
      )}
    </div>
  );
}