// src/app/(main)/sales-report/[tenantId]/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation'; // Hook to get URL params

interface DailySale {
  date: string;
  totalSales: number;
  invoiceCount: number;
}

export default function StoreSalesReportPage() {
  const params = useParams(); // This will give us { tenantId: '...' }
  const tenantId = params.tenantId as string;

  const [reportData, setReportData] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch if tenantId is available
    if (tenantId) {
      const fetchReport = async () => {
        setLoading(true);
        try {
          // Call the new dynamic API route
          const response = await fetch(`/api/sales-report/${tenantId}`);
          if (!response.ok) throw new Error('Failed to fetch sales report for this store.');

          const data = await response.json();
          setReportData(data);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchReport();
    }
  }, [tenantId]); // Re-run the effect if the tenantId changes

  if (loading) {
    return <div className="p-8">Loading Sales Report...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-8">
      {/* We can add the store's name here in the future if we fetch it */}
      <h1 className="text-3xl font-bold mb-6">Daily Sales Report for Store</h1>
      {reportData.length === 0 ? (
        <p>No sales data found for this store.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white shadow-md rounded-lg">
            {/* Table Head and Body are the same as your other report page */}
            <thead className="bg-gray-200">
              <tr>
                <th className="py-3 px-4 text-left">Date</th>
                <th className="py-3 px-4 text-left">Total Invoices</th>
                <th className="py-3 px-4 text-right">Total Sales</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((day) => (
                <tr key={day.date} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    {new Date(day.date).toLocaleDateString(undefined, {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </td>
                  <td className="py-3 px-4">{day.invoiceCount}</td>
                  <td className="py-3 px-4 text-right font-medium">
                    ₹{day.totalSales.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}