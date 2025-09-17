'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react'; // Step 1: Import useSession
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Define a type for our report data for better type safety
interface ReportData {
  _id: string;
  closingDate: string;
  closedBy: { name: string };
  systemTotals: { grandTotal: number; cash: number };
  actualTotals: { totalCountedCash: number };
  discrepancy: { cash: number };
}

export default function DayEndClosingReportPage() {
  // Step 2: Get the user's session data and authentication status
  const { data: session, status } = useSession();

  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  // This function now takes the tenantId as an argument
  const fetchData = async (tenantId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/reports/day-end-closing?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            // Step 4: Use the REAL, dynamic tenantId from the session
            'X-Tenant-ID': tenantId,
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch data from API');
      }
      const result = await response.json();
      if (result.success) {
        setReports(result.data);
      } else {
        throw new Error(result.message || 'An unknown error occurred');
      }
    } catch (err: any) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // useEffect now waits for the session to be authenticated before fetching data
  useEffect(() => {
    if (status === 'authenticated') {
      // Step 3: Get the tenantId from the authenticated session
      const tenantId = session.user.tenantId;
      if (tenantId) {
        fetchData(tenantId);
      } else {
        setError("Tenant ID could not be found in your user session.");
        setLoading(false);
      }
    } else if (status === 'unauthenticated') {
        setError("You are not authenticated. Please log in.");
        setLoading(false);
    }
    // This effect depends on the session status and the selected dates
  }, [startDate, endDate, session, status]);

  const handleDownloadExcel = () => {
    if (reports.length === 0) return;

    const worksheetData = reports.map(report => ({
      'Date': new Date(report.closingDate).toLocaleDateString(),
      'Closed By': report.closedBy?.name ?? 'N/A',
      'System Grand Total': report.systemTotals?.grandTotal.toFixed(2) ?? '0.00',
      'System Cash': report.systemTotals?.cash.toFixed(2) ?? '0.00',
      'Counted Cash': report.actualTotals?.totalCountedCash.toFixed(2) ?? '0.00',
      'Discrepancy': report.discrepancy?.cash.toFixed(2) ?? '0.00',
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Day End Reports');
    XLSX.writeFile(workbook, `DayEndClosingReport_${startDate}_to_${endDate}.xlsx`);
  };

  const handleDownloadPDF = () => {
    if (reports.length === 0) return;

    const doc = new jsPDF();
    
    doc.text('Day End Closing Report', 14, 15);
    doc.text(`Date Range: ${startDate} to ${endDate}`, 14, 22);

    (doc as any).autoTable({
      startY: 30,
      head: [['Date', 'Closed By', 'System Total', 'System Cash', 'Counted Cash', 'Discrepancy']],
      body: reports.map(report => [
        new Date(report.closingDate).toLocaleDateString(),
        report.closedBy?.name ?? 'N/A',
        report.systemTotals?.grandTotal.toFixed(2) ?? '0.00',
        report.systemTotals?.cash.toFixed(2) ?? '0.00',
        report.actualTotals?.totalCountedCash.toFixed(2) ?? '0.00',
        report.discrepancy?.cash.toFixed(2) ?? '0.00',
      ]),
    });
    
    doc.save(`DayEndClosingReport_${startDate}_to_${endDate}.pdf`);
  };

  // Show a loading message while the session is being authenticated
  if (status === "loading") {
    return <div className="p-6"><p>Loading session...</p></div>
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Day End Closing Report</h1>

      <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 border rounded-md">
        <div className="flex flex-col">
          <label htmlFor="startDate" className="text-sm font-medium text-gray-600">Start Date</label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="p-2 border rounded-md"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="endDate" className="text-sm font-medium text-gray-600">End Date</label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="p-2 border rounded-md"
          />
        </div>
        <div className="flex items-end gap-2 pt-5">
           <button
            onClick={handleDownloadExcel}
            disabled={reports.length === 0 || loading}
            className="px-4 py-2 bg-green-600 text-white rounded-md disabled:bg-gray-400 hover:bg-green-700 transition"
          >
            Download Excel
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={reports.length === 0 || loading}
            className="px-4 py-2 bg-red-600 text-white rounded-md disabled:bg-gray-400 hover:bg-red-700 transition"
          >
            Download PDF
          </button>
        </div>
      </div>
      
      {error && <p className="text-red-500 mb-4">Error: {error}</p>}

      <div className="overflow-x-auto">
        {(loading && status === 'authenticated') && <p>Loading reports...</p>}
        {!loading && !error && (
           <table className="min-w-full bg-white border">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-4 border">Date</th>
                <th className="py-2 px-4 border">Closed By</th>
                <th className="py-2 px-4 border">System Grand Total</th>
                <th className="py-2 px-4 border">System Cash</th>
                <th className="py-2 px-4 border">Counted Cash</th>
                <th className="py-2 px-4 border">Discrepancy</th>
              </tr>
            </thead>
            <tbody>
              {reports.length > 0 ? (
                reports.map((report) => (
                  <tr key={report._id}>
                    <td className="py-2 px-4 border text-center">{new Date(report.closingDate).toLocaleDateString()}</td>
                    <td className="py-2 px-4 border">{report.closedBy?.name ?? 'N/A'}</td>
                    <td className="py-2 px-4 border text-right">{report.systemTotals?.grandTotal.toFixed(2) ?? '0.00'}</td>
                    <td className="py-2 px-4 border text-right">{report.systemTotals?.cash.toFixed(2) ?? '0.00'}</td>
                    <td className="py-2 px-4 border text-right">{report.actualTotals?.totalCountedCash.toFixed(2) ?? '0.00'}</td>
                    <td className={`py-2 px-4 border text-right font-semibold ${report.discrepancy?.cash !== 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {report.discrepancy?.cash.toFixed(2) ?? '0.00'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-4">No reports found for the selected date range.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}