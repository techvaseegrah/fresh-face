// FILE: /components/DayEndClosingModal.tsx - (COMPLETE CODE WITH "OTHER" PAYMENTS)
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { XMarkIcon } from '@heroicons/react/24/outline';

// Define the structure for expected totals from the API
interface ExpectedTotals {
  cash: number;
  card: number;
  upi: number;
  other: number; // Ensure 'other' is explicitly part of the type
  total: number;
  [key: string]: number; // To handle any other payment methods dynamically
}

// Define the structure for cash denomination counts from user input
type DenominationCounts = {
  [key: string]: number;
};

interface DayEndClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; // To refresh any parent data if needed
  closingDate: string; // YYYY-MM-DD format
}

// Configuration for cash denominations
const denominations = [
  { value: 500, label: '₹500' },
  { value: 200, label: '₹200' },
  { value: 100, label: '₹100' },
  { value: 50, label: '₹50' },
  { value: 20, label: '₹20' },
  { value: 10, label: '₹10' },
  { value: 2, label: '₹2' }, 
  { value: 1, label: '₹1' },
];

const DayEndClosingModal: React.FC<DayEndClosingModalProps> = ({ isOpen, onClose, onSuccess, closingDate }) => {
  // State for loading and submission status
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for data fetched from the API
  const [expectedTotals, setExpectedTotals] = useState<ExpectedTotals | null>(null);

  // State for user inputs
  const [denominationCounts, setDenominationCounts] = useState<DenominationCounts>({});
  const [actualCardTotal, setActualCardTotal] = useState('');
  const [actualUpiTotal, setActualUpiTotal] = useState('');
  // NEW: State for the "Other" payment method input
  const [actualOtherTotal, setActualOtherTotal] = useState('');
  const [notes, setNotes] = useState('');

  // Effect to fetch expected totals when the modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset all states when modal opens
      setIsLoading(true);
      setError(null);
      setExpectedTotals(null);
      setDenominationCounts({});
      setActualCardTotal('');
      setActualUpiTotal('');
      // NEW: Reset the "Other" total state
      setActualOtherTotal('');
      setNotes('');

      fetch(`/api/reports/daily-summary?date=${closingDate}`)
        .then(res => res.json())
        .then(data => {
          if (!data.success) throw new Error(data.message || 'Failed to fetch daily summary.');
          // Ensure `other` has a default value if not provided by the API
          const totals = data.data.expectedTotals;
          setExpectedTotals({ ...totals, other: totals.other || 0 });
        })
        .catch(e => {
          setError(e.message);
          toast.error(`Error: ${e.message}`);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, closingDate]);

  // Handler for denomination input changes
  const handleDenominationChange = (value: number, countStr: string) => {
    const count = parseInt(countStr) || 0;
    setDenominationCounts(prev => ({ ...prev, [`d${value}`]: count }));
  };
  
  // Memoized calculation for the total physical cash counted
  const calculatedActualCash = useMemo(() => {
    return denominations.reduce((total, denom) => {
      const count = denominationCounts[`d${denom.value}`] || 0;
      return total + count * denom.value;
    }, 0);
  }, [denominationCounts]);

  // Memoized calculations for discrepancies
  const cashDiscrepancy = useMemo(() => (expectedTotals ? calculatedActualCash - expectedTotals.cash : 0), [calculatedActualCash, expectedTotals]);
  const cardDiscrepancy = useMemo(() => (expectedTotals ? (parseFloat(actualCardTotal) || 0) - expectedTotals.card : 0), [actualCardTotal, expectedTotals]);
  const upiDiscrepancy = useMemo(() => (expectedTotals ? (parseFloat(actualUpiTotal) || 0) - expectedTotals.upi : 0), [actualUpiTotal, expectedTotals]);
  // NEW: Memoized calculation for "Other" discrepancy
  const otherDiscrepancy = useMemo(() => (expectedTotals ? (parseFloat(actualOtherTotal) || 0) - expectedTotals.other : 0), [actualOtherTotal, expectedTotals]);

  // Handler for submitting the final report
  const handleSubmit = async () => {
    if (!expectedTotals) {
        toast.error("Cannot submit without expected totals data.");
        return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
        const payload = {
            closingDate,
            expectedTotals,
            actualTotals: {
                cash: calculatedActualCash,
                card: parseFloat(actualCardTotal) || 0,
                upi: parseFloat(actualUpiTotal) || 0,
                // NEW: Include "other" in the payload
                other: parseFloat(actualOtherTotal) || 0,
            },
            discrepancies: {
                cash: cashDiscrepancy,
                card: cardDiscrepancy,
                upi: upiDiscrepancy,
                // NEW: Include "other" discrepancy in the payload
                other: otherDiscrepancy,
            },
            cashDenominations: denominationCounts,
            notes,
        };

        const response = await fetch('/api/reports/day-end-closing', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload),
        });
        const result = await response.json();
        if(!response.ok || !result.success) throw new Error(result.message || 'Failed to submit report.');

        toast.success('Day-end report submitted successfully!');
        onSuccess();
        onClose();
    } catch (e: any) {
        setError(e.message);
        toast.error(e.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  // Helper component to render discrepancy with appropriate styling
  const renderDiscrepancy = (amount: number) => {
    if (amount === 0) return <span className="text-green-600">₹0.00 (Perfect Match)</span>;
    const isShort = amount < 0;
    const color = isShort ? 'text-red-600' : 'text-yellow-600';
    const label = isShort ? 'Shortage' : 'Overage';
    return <span className={color}>₹{Math.abs(amount).toFixed(2)} ({label})</span>
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-start p-4 overflow-y-auto">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-3xl my-8"> {/* Increased max-width for better layout */}
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <div>
            <h3 className="text-xl font-semibold">Day-End Closing Confirmation</h3>
            <p className="text-sm text-gray-500">For Date: {new Date(closingDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700 rounded-full" disabled={isSubmitting}>
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {isLoading && <p className="text-center p-8 text-gray-600">Loading today's sales data...</p>}
        {error && <div className="my-2 p-3 bg-red-100 text-red-800 text-sm rounded">{error}</div>}
        
        {!isLoading && expectedTotals && (
          <div className="space-y-6">
            
            {/* Cash Reconciliation Section */}
            <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-lg mb-3">Cash Reconciliation</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {denominations.map(d => (
                        <div key={d.value}>
                            <label className="block text-sm font-medium text-gray-700">{d.label}</label>
                            <input type="number" min="0" placeholder='Count' className="mt-1 w-full px-2 py-1.5 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" onChange={(e) => handleDenominationChange(d.value, e.target.value)} />
                        </div>
                    ))}
                </div>
                <div className="bg-gray-50 p-3 rounded-md space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-600">Expected Cash (As per System):</span> <span className="font-semibold">₹{expectedTotals.cash.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Actual Cash (Counted):</span> <span className="font-semibold">₹{calculatedActualCash.toFixed(2)}</span></div>
                    <div className="flex justify-between border-t pt-2 mt-2"><span className="font-medium">Cash Discrepancy:</span> <span className="font-bold">{renderDiscrepancy(cashDiscrepancy)}</span></div>
                </div>
            </div>

            {/* Card, UPI, & Other Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6"> {/* Changed to 3 columns */}
                <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold text-lg mb-2">Card Payments</h4>
                    <label className="block text-sm font-medium text-gray-700">Actual Card Total</label>
                    <input type="number" value={actualCardTotal} onChange={e => setActualCardTotal(e.target.value)} className="mt-1 w-full px-2 py-1.5 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                    <div className="bg-gray-50 p-3 mt-3 rounded-md space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-600">Expected:</span> <span className="font-semibold">₹{expectedTotals.card.toFixed(2)}</span></div>
                        <div className="flex justify-between border-t pt-2 mt-2"><span className="font-medium">Discrepancy:</span> <span className="font-bold">{renderDiscrepancy(cardDiscrepancy)}</span></div>
                    </div>
                </div>
                <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold text-lg mb-2">UPI Payments</h4>
                    <label className="block text-sm font-medium text-gray-700">Actual UPI Total</label>
                    <input type="number" value={actualUpiTotal} onChange={e => setActualUpiTotal(e.target.value)} className="mt-1 w-full px-2 py-1.5 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                    <div className="bg-gray-50 p-3 mt-3 rounded-md space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-600">Expected:</span> <span className="font-semibold">₹{expectedTotals.upi.toFixed(2)}</span></div>
                        <div className="flex justify-between border-t pt-2 mt-2"><span className="font-medium">Discrepancy:</span> <span className="font-bold">{renderDiscrepancy(upiDiscrepancy)}</span></div>
                    </div>
                </div>
                {/* NEW: Other Payments Section */}
                <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold text-lg mb-2">Other Payments</h4>
                    <label className="block text-sm font-medium text-gray-700">Actual "Other" Total</label>
                    <input type="number" value={actualOtherTotal} onChange={e => setActualOtherTotal(e.target.value)} className="mt-1 w-full px-2 py-1.5 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                    <div className="bg-gray-50 p-3 mt-3 rounded-md space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-600">Expected:</span> <span className="font-semibold">₹{expectedTotals.other.toFixed(2)}</span></div>
                        <div className="flex justify-between border-t pt-2 mt-2"><span className="font-medium">Discrepancy:</span> <span className="font-bold">{renderDiscrepancy(otherDiscrepancy)}</span></div>
                    </div>
                </div>
            </div>
            
            {/* Notes & Actions */}
             <div>
                <label className="block text-sm font-medium text-gray-700">Notes (for any discrepancies)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="mt-1 w-full px-2 py-1.5 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"></textarea>
            </div>
            <div className="flex justify-end space-x-3 pt-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 border rounded-md hover:bg-gray-200" disabled={isSubmitting}>Cancel</button>
              <button type="button" onClick={handleSubmit} className="px-5 py-2 text-sm text-white bg-black rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Confirm & Close Account'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DayEndClosingModal;