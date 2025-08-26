'use client';

import { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';

// Helper function to get the current month in YYYY-MM format
const getYearMonthString = (date: Date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
};

// Helper function to format numbers as Indian Rupees (₹)
const formatCurrency = (amount: number) => {
  if (amount === null || typeof amount === 'undefined') {
    amount = 0;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function ProfitLossPage() {
  const [selectedMonth, setSelectedMonth] = useState(getYearMonthString(new Date()));
  const [sumupData, setSumupData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSumupData = async () => {
      setLoading(true);
      setSumupData(null); 
      const [year, month] = selectedMonth.split('-').map(Number);
      if (!year || !month) return;

      try {
        const response = await fetch(`/api/profit-loss?year=${year}&month=${month}`);
        
        // If the response is not OK (e.g., status 401, 404, 500), handle it as an error
        if (!response.ok) {
          // Try to get a more detailed error message from the server's response body
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch data');
        }

        const data = await response.json();
        setSumupData(data);
        
      } catch (error: any) {
        // =====================================================================
        //  THIS IS THE IMPROVED PART
        //  The toast will now show the specific error from the server
        // =====================================================================
        console.error("API Error:", error);
        toast.error(`Error: ${error.message}`); 
      } finally {
        setLoading(false);
      }
    };

    fetchSumupData();
  }, [selectedMonth]);

  const selectedDate = new Date(`${selectedMonth}-02`);
  const monthName = selectedDate.toLocaleString('default', { month: 'long' });
  const yearName = selectedDate.getFullYear();

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gray-50 min-h-screen">
      <Toaster position="top-right" richColors />
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Profit & Loss Sumup</h1>
        
        <div className="mb-6">
          <label htmlFor="month-select" className="block text-sm font-medium text-gray-700 mb-1">
            Select Month
          </label>
          <input
            id="month-select"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full max-w-xs p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {loading ? (
          <div className="bg-white shadow-lg rounded-lg p-8 text-center text-gray-500">
            Calculating...
          </div>
        ) : sumupData ? (
          <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
            <div className="bg-blue-600 text-white font-bold text-center py-3 text-lg">
              {monthName} {yearName} SUMUP
            </div>
            <div className="divide-y divide-gray-200 text-sm">
              <div className="grid grid-cols-2 items-center p-4">
                <span className="font-semibold text-gray-700">TOTAL INCOME</span>
                <span className="text-right text-gray-800 font-bold text-base">
                  {formatCurrency(sumupData.totalIncome)}
                </span>
              </div>
              <div className="grid grid-cols-2 p-4">
                <span className="font-semibold text-gray-700">TOTAL MONTHLY EXPENSES</span>
                <span className="text-right text-gray-800">{formatCurrency(sumupData.totalMonthlyExpenses)}</span>
              </div>
              <div className="grid grid-cols-2 p-4">
                <span className="font-semibold text-gray-700">TOTAL WEEKLY EXPENSES</span>
                <span className="text-right text-gray-800">{formatCurrency(sumupData.totalWeeklyExpenses)}</span>
              </div>
              <div className="grid grid-cols-2 p-4">
                <span className="font-semibold text-gray-700">TOTAL DAILY EXPENSES</span>
                <span className="text-right text-gray-800">{formatCurrency(sumupData.totalDailyExpenses)}</span>
              </div>
              <div className="grid grid-cols-2 p-4">
                <span className="font-semibold text-gray-700">OTHER EXPENSES</span>
                <span className="text-right text-gray-800">{formatCurrency(sumupData.totalOtherExpenses)}</span>
              </div>
              <div className={`grid grid-cols-2 p-4 font-bold ${sumupData.sumup >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                <span>SUMUP FOR THIS MONTH</span>
                <span className="text-right text-lg">{formatCurrency(sumupData.sumup)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-lg rounded-lg p-8 text-center text-red-500">
            Could not load data for the selected month.
          </div>
        )}
      </div>
    </div>
  );
}