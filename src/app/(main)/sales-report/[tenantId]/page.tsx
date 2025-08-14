// src/app/(main)/sales-report/[tenantId]/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface DailySale {
  date: string;
  totalSales: number;
  invoiceCount: number;
}

export default function StoreSalesReportPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantId = params.tenantId as string;

  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const [reportData, setReportData] = useState<DailySale[]>([]); // Initialized as an empty array
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tenantId) {
      const fetchReport = async () => {
        setLoading(true);
        setError(null);
        try {
          const query = new URLSearchParams();
          if (startDate) query.set('startDate', startDate);
          if (endDate) query.set('endDate', endDate);
          
          const response = await fetch(`/api/sales-report/${tenantId}?${query.toString()}`);

          if (!response.ok) {
            throw new Error('Failed to fetch sales report for this store.');
          }

          const data = await response.json();
          // --- THIS IS THE FIX ---
          // The API returns the array directly, so we set it directly.
          setReportData(data); 

        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchReport();
    }
  }, [tenantId, startDate, endDate]);

  // Calculate totals ONLY if reportData is an array
  const totals = Array.isArray(reportData) 
    ? reportData.reduce(
        (acc, day) => {
          acc.invoices += day.invoiceCount;
          acc.sales += day.totalSales;
          return acc;
        },
        { invoices: 0, sales: 0 }
      )
    : { invoices: 0, sales: 0 }; // Default totals if data is not an array

  const formatDate = (dateString: string) => {
    try {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
        });
    } catch (e) {
        return 'Invalid Date';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-gray-50"><div className="text-xl text-gray-500">Loading Sales Report...</div></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-screen bg-gray-50"><div className="p-8 text-red-500 bg-red-100 rounded-lg">Error: {error}</div></div>;
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800">Daily Sales Report for Store</h1>
      <p className="text-md text-gray-500 mb-8 mt-1">
        {startDate && endDate 
            ? `Displaying results from ${formatDate(startDate)} to ${formatDate(endDate)}`
            : 'Displaying all available data'
        }
      </p>

      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Invoices</th>
                <th className="py-3 px-6 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reportData.length > 0 ? (
                reportData.map((day) => (
                  <tr key={day.date} className="hover:bg-gray-50 transition-colors duration-200">
                    <td className="py-4 px-6 whitespace-nowrap text-sm text-gray-900">{formatDate(day.date)}</td>
                    <td className="py-4 px-6 whitespace-nowrap text-sm text-gray-500">{day.invoiceCount}</td>
                    <td className="py-4 px-6 text-right whitespace-nowrap text-sm font-medium text-gray-900">
                      ₹{day.totalSales.toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-gray-500">
                    No sales data found for this store or period.
                  </td>
                </tr>
              )}
            </tbody>
            {reportData.length > 0 && (
              <tfoot className="bg-gray-100">
                <tr className="font-bold text-gray-800">
                  <td className="py-4 px-6 text-sm">Grand Total</td>
                  <td className="py-4 px-6 text-sm">{totals.invoices}</td>
                  <td className="py-4 px-6 text-right text-sm">
                    ₹{totals.sales.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}