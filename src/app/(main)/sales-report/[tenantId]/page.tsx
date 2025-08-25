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

  const [reportData, setReportData] = useState<DailySale[]>([]);
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
            const errorData = await response.json().catch(() => ({ message: 'Failed to fetch sales report for this store.' }));
            throw new Error(errorData.message || 'An unknown error occurred.');
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
    }
  }, [tenantId, startDate, endDate]);

  // Safely calculate totals only if reportData is an array
  const totals = Array.isArray(reportData) 
    ? reportData.reduce(
        (acc, day) => {
          acc.invoices += day.invoiceCount;
          acc.sales += day.totalSales;
          return acc;
        },
        { invoices: 0, sales: 0 }
      )
    : { invoices: 0, sales: 0 };

  // A more robust date formatter
  const formatDate = (dateString: string) => {
    try {
        // Using UTC to avoid timezone-related date shifts
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
        });
    } catch (e) {
        return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-xl text-gray-500">Loading Sales Report...</div>
      </div>
    );
  }

  if (error) {
    // A responsive error message container
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 p-4">
        <div className="w-full max-w-md p-6 text-center text-red-700 bg-red-100 rounded-lg shadow-md">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    // Responsive padding for the main container
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      {/* Responsive typography for the header */}
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Daily Sales Report</h1>
      <p className="text-sm md:text-base text-gray-500 mb-6 md:mb-8 mt-1">
        {startDate && endDate 
            ? `Displaying results from ${formatDate(startDate)} to ${formatDate(endDate)}`
            : 'Displaying all available data'
        }
      </p>

      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        {/* On small screens, the table might still overflow if content is too wide.
            This ensures horizontal scrolling as a fallback. */}
        <div className="overflow-x-auto">
          {/*
            RESPONSIVE TABLE STRATEGY:
            - Mobile (default): `display: block`. The table acts like a div.
            - Desktop (`md:`): `display: table`. It reverts to a standard table layout.
          */}
          <table className="w-full block md:table">
            {/* The table head is hidden on mobile and shown on medium screens and up. */}
            <thead className="hidden md:table-header-group bg-gray-50">
              <tr>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Invoices</th>
                <th className="py-3 px-6 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sales</th>
              </tr>
            </thead>
            {/* On small screens, `tbody` is a block container. `divide-y` provides separation for both mobile cards and desktop rows. */}
            <tbody className="block md:table-row-group divide-y divide-gray-200">
              {reportData.length > 0 ? (
                reportData.map((day) => (
                  // Each `tr` becomes a "card" on mobile (`block p-4`) and a normal table row on desktop (`md:table-row md:p-0`).
                  <tr key={day.date} className="block md:table-row p-4 md:p-0 hover:bg-gray-50 transition-colors duration-200">
                    {/*
                      Each `td` is a block, creating a stacked layout within the mobile card.
                      - `data-label`: Holds the header text for the pseudo-element label.
                      - `before:`: Creates the label on mobile using the content from `data-label`.
                      - `text-right md:text-left`: Aligns the value to the right on mobile and left on desktop.
                    */}
                    <td 
                      data-label="Date"
                      className="block md:table-cell py-2 px-0 md:py-4 md:px-6 whitespace-nowrap text-sm text-gray-900 text-right md:text-left
                                 before:content-[attr(data-label)':'] before:font-bold before:float-left md:before:content-none"
                    >
                      {formatDate(day.date)}
                    </td>
                    <td 
                      data-label="Invoices"
                      className="block md:table-cell py-2 px-0 md:py-4 md:px-6 whitespace-nowrap text-sm text-gray-500 text-right md:text-left
                                 before:content-[attr(data-label)':'] before:font-bold before:float-left md:before:content-none"
                    >
                      {day.invoiceCount}
                    </td>
                    <td 
                      data-label="Sales"
                      className="block md:table-cell py-2 px-0 md:py-4 md:px-6 whitespace-nowrap text-sm font-medium text-gray-900 text-right
                                 before:content-[attr(data-label)':'] before:font-bold before:float-left md:before:content-none"
                    >
                      {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(day.totalSales)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="block md:table-row">
                  <td colSpan={3} className="block md:table-cell text-center py-10 text-gray-500">
                    No sales data found for this store or period.
                  </td>
                </tr>
              )}
            </tbody>
            {reportData.length > 0 && (
              // The footer is also responsive, stacking its content on mobile.
              <tfoot className="block md:table-footer-group bg-gray-100 font-bold text-gray-800">
                <tr className="block md:table-row p-4 md:p-0">
                  {/* The "Grand Total" label cell is only shown on desktop for clarity. */}
                  <td className="hidden md:table-cell py-4 px-6 text-sm">Grand Total</td>
                  
                  {/* On mobile, totals use the same data-label technique as the body. */}
                  <td 
                    data-label="Total Invoices"
                    className="block md:table-cell py-2 px-0 md:py-4 md:px-6 text-sm text-right md:text-left
                               before:content-[attr(data-label)':'] before:font-bold before:float-left md:before:content-none"
                  >
                    {totals.invoices}
                  </td>
                  <td 
                    data-label="Grand Total Sales"
                    className="block md:table-cell py-2 px-0 md:py-4 md:px-6 text-sm text-right
                               before:content-[attr(data-label)':'] before:font-bold before:float-left md:before:content-none"
                  >
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totals.sales)}
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