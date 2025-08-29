'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession, getSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// PERMISSION IMPORTS
import { hasPermission, PERMISSIONS } from '@/lib/permissions'; 
import { ShieldExclamationIcon } from '@heroicons/react/24/outline';

// Component Imports
import Button from '@/components/ui/Button';
import { DataDisplayColumn } from './components/DataDisplayColumn';
import { ManualInputColumn } from './components/ManualInputColumn';

// Type Definitions
type ReconciliationData = {
  date: string;
  software: { serviceTotal: number; productTotal: number; cash: number; gpay: number; card: number; sumup: number; total: number; };
  bank: { gpayDeposit: number; cardDeposit: number; bankRemarks: string; };
  cash: { depositDone: number; expenses: number; closingCash: number; cashRemarks: string; };
};

// Initial State
const initialData: ReconciliationData = {
  date: new Date().toISOString().split('T')[0],
  software: { serviceTotal: 0, productTotal: 0, cash: 0, gpay: 0, card: 0, sumup: 0, total: 0 },
  bank: { gpayDeposit: 0, cardDeposit: 0, bankRemarks: '' },
  cash: { depositDone: 0, expenses: 0, closingCash: 0, cashRemarks: '' },
};

export default function ReconciliationPage() {
  const { data: session, status: sessionStatus } = useSession();

  // --- Permissions Logic ---
  const userPermissions = session?.user?.role?.permissions || [];
  const canReadReconciliation = hasPermission(userPermissions, PERMISSIONS.RECONCILIATION_READ);
  const canManageReconciliation = hasPermission(userPermissions, PERMISSIONS.RECONCILIATION_MANAGE);

  // --- STATE MANAGEMENT (UPDATED) ---
  const [formData, setFormData] = useState<ReconciliationData>(initialData);
  const [openingBalance, setOpeningBalance] = useState(0); // STEP 1: State for opening balance
  const [selectedDate, setSelectedDate] = useState(initialData.date);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- Authenticated API Fetch Helper ---
  const tenantFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const currentSession = await getSession(); 
    if (!currentSession?.user?.tenantId) {
      toast.error("Session error: Tenant not found. Please log in again.");
      throw new Error("Missing tenant ID in session");
    }
    const headers = { ...options.headers, 'Content-Type': 'application/json', 'x-tenant-id': currentSession.user.tenantId };
    return fetch(url, { ...options, headers });
  }, []);

  // --- DATA FETCHING (UPDATED) ---
  useEffect(() => {
    if (sessionStatus === 'authenticated' && !canReadReconciliation) {
        setIsLoading(false);
        return;
    }
    if (sessionStatus !== 'authenticated') {
      if (sessionStatus !== 'loading') setIsLoading(false);
      return; 
    }
    
    const fetchData = async () => {
      setIsLoading(true);
      setOpeningBalance(0); // Reset opening balance for each new date fetch

      try {
        const [softwareRes, savedReportRes, expensesRes] = await Promise.all([
          tenantFetch(`/api/reconciliation/software-summary?date=${selectedDate}`),
          tenantFetch(`/api/reconciliation?date=${selectedDate}`),
          tenantFetch(`/api/reconciliation/cash-summary?date=${selectedDate}`)
        ]);

        if (!softwareRes.ok) throw new Error('Could not fetch daily sales summary.');
        const softwareData = await softwareRes.json();

        // STEP 2: Capture opening balance and separate it from today's sales data
        const { openingBalance, ...todaySales } = softwareData;
        setOpeningBalance(openingBalance || 0);

        let autoFetchedCashExpenses = 0;
        if (expensesRes.ok) {
            const expensesData = await expensesRes.json();
            autoFetchedCashExpenses = expensesData.totalCashExpenses;
        } else {
            console.warn("Could not fetch cash expenses summary.");
        }

        if (savedReportRes.ok) {
          const savedData = await savedReportRes.json();
          setFormData({ 
            date: selectedDate, 
            software: todaySales, // Use the sales data without the opening balance
            bank: { ...initialData.bank, ...savedData.bank }, 
            cash: { ...initialData.cash, ...savedData.cash, expenses: autoFetchedCashExpenses }
          });
        } else {
          setFormData({ 
            ...initialData, 
            date: selectedDate, 
            software: todaySales, // Use the sales data without the opening balance
            cash: { ...initialData.cash, expenses: autoFetchedCashExpenses }
          });
        }
      } catch (err) {
        if (err instanceof Error && !err.message.includes("Missing tenant ID")) {
            toast.error(err.message);
        }
        setFormData(prev => ({ ...initialData, date: prev.date }));
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [selectedDate, sessionStatus, session, tenantFetch, canReadReconciliation]);

  // --- CALCULATION LOGIC (UPDATED) ---
  const differences = useMemo(() => {
    const { software, bank, cash } = formData;
    const gpayDiff = bank.gpayDeposit - software.gpay;
    const cardDiff = bank.cardDeposit - software.card;

    // STEP 3: Correct the cash difference calculation
    const totalCashToAccountFor = software.cash + openingBalance;
    const expectedClosingCash = totalCashToAccountFor - cash.expenses - cash.depositDone;
    const cashDiff = cash.closingCash - expectedClosingCash;

    return { gpayDiff, cardDiff, cashDiff };
  }, [formData, openingBalance]); // Add openingBalance to dependency array

  // --- Input Handler ---
  const handleInputChange = (section: 'bank' | 'cash', field: string, value: string) => {
    const isRemarksField = field.includes('Remarks');
    const processedValue = isRemarksField ? value : (Number(value) || 0);
    setFormData(prev => ({
        ...prev,
        [section]: { ...prev[section], [field]: processedValue }
    }));
  };

  // --- Form Submission Handler ---
  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const res = await tenantFetch('/api/reconciliation', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to save the report.');
      }
      toast.success('Reconciliation report saved successfully!');
    } catch (err) {
      if (err instanceof Error && !err.message.includes("Missing tenant ID")) {
        toast.error(err.message);
      }
    } finally {
      setIsSaving(false);
    }
  };
  
  // --- Render Logic ---
  if (sessionStatus === 'loading') {
    return <div className="p-8 text-center text-gray-600">Loading user session...</div>;
  }
  
  if (sessionStatus === 'authenticated' && !canReadReconciliation) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)] bg-gray-50 p-4">
        <div className="text-center bg-white p-10 rounded-xl shadow-md border border-red-200">
          <ShieldExclamationIcon className="mx-auto h-16 w-16 text-red-400" />
          <h1 className="mt-4 text-2xl font-bold text-gray-800">Access Denied</h1>
          <p className="mt-2 text-gray-600">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  if (sessionStatus === 'unauthenticated') {
    return <div className="p-8 text-center text-red-600">Access Denied. Please log in.</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Daily Financial Reconciliation</h1>
          <div className="mt-4 sm:mt-0">
            <label htmlFor="date-picker" className="font-semibold text-gray-700 mr-2">Select Date:</label>
            <input id="date-picker" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="p-2 border border-gray-300 rounded-md shadow-sm" />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10"><p className="text-lg text-gray-500">Loading Report Data...</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <DataDisplayColumn data={formData.software} openingBalance={openingBalance} />

            <ManualInputColumn
              title="Data from Bank Deposit"
              themeColor="purple"
              fields={[
                { id: 'gpayDeposit', label: 'GPay(UPI) in Bank', value: formData.bank.gpayDeposit },
                { id: 'cardDeposit', label: 'Card in Bank', value: formData.bank.cardDeposit },
              ]}
              diffs={[
                { label: 'Gpay Diff', value: differences.gpayDiff },
                { label: 'Card Diff', value: differences.cardDiff },
              ]}
              onInputChange={(id, value) => handleInputChange('bank', id, value)}
              remarksValue={formData.bank.bankRemarks}
              onRemarksChange={(value) => handleInputChange('bank', 'bankRemarks', value)}
            />
            
            <ManualInputColumn
              title="Cash Reconciliation"
              themeColor="pink"
              fields={[
                { id: 'depositDone', label: 'Cash Deposited in Bank', value: formData.cash.depositDone },
                { id: 'expenses', label: 'Cash Expenses', value: formData.cash.expenses },
                { id: 'closingCash', label: 'Physical Closing Cash', value: formData.cash.closingCash },
              ]}
              diffs={[{ label: 'Cash Diff?', value: differences.cashDiff }]}
              onInputChange={(id, value) => handleInputChange('cash', id, value)}
              remarksValue={formData.cash.cashRemarks}
              onRemarksChange={(value) => handleInputChange('cash', 'cashRemarks', value)}
            />
          </div>
        )}

        <div className="mt-8 text-center">
          <Button 
            onClick={handleSubmit} 
            disabled={isSaving || isLoading || !canManageReconciliation}
            title={!canManageReconciliation ? "You don't have permission to manage this report" : ""}
          >
            {isSaving ? 'Saving...' : 'Save Reconciliation Report'}
          </Button>
        </div>
      </div>
    </div>
  );
}