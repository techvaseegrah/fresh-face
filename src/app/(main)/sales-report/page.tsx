// src/app/(main)/sales-report/page.tsx

'use client';

import { useState, useEffect } from 'react';

// Define a type for our report data
interface DailySale {
  date: string;
  totalSales: number;
  invoiceCount: number;
}

export default function SalesReportPage() {
  const [reportData, setReportData] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        // Fetch data from the new sales-report API route
        const response = await fetch('/api/sales-report');

        if (!response.ok) {
          throw new Error(`Failed to fetch report: ${response.statusText}`);
        }

        const data = await response.json();
        setReportData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, []); // Empty array ensures this runs once when the component mounts

  if (loading) {
    return <div className="p-8">Loading Sales Report...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Daily Sales Report</h1>
      {reportData.length === 0 ? (
        <p>No sales data found for this store.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white shadow-md rounded-lg">
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
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
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