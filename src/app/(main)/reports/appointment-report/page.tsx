// src/app/(main)/reports/appointment-report/page.tsx

'use client';

import React, { useState, useCallback } from 'react';
import Card from '@/components/ui/Card';
import { getSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatDateIST, formatTimeIST } from '@/lib/dateFormatter'; // Make sure this path is correct

const statusOptions = ['All', 'Appointment', 'Checked-In', 'Checked-Out', 'Paid', 'Cancelled', 'No-Show'];

export default function AppointmentReportPage() {
  const [isExporting, setIsExporting] = useState(false);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const tenantFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const session = await getSession();
    if (!session?.user?.tenantId) { throw new Error("Your session is invalid or has expired. Please log in again."); }
    const headers = { ...options.headers, 'x-tenant-id': session.user.tenantId };
    if (options.body) { (headers as any)['Content-Type'] = 'application/json'; }
    return fetch(url, { ...options, headers });
  }, []);

  const fetchAllAppointmentsForReport = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '10000', page: '1' });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (statusFilter !== 'All') params.append('status', statusFilter);

      const res = await tenantFetch(`/api/appointment?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch full appointment list for export');
      return data.appointments;
    } catch (err: any) {
      toast.error(err.message);
      return [];
    }
  }, [tenantFetch, startDate, endDate, statusFilter]);

  const handleExportToExcel = async () => {
    setIsExporting(true);
    const appointmentsToExport = await fetchAllAppointmentsForReport();
    if (appointmentsToExport.length === 0) {
      toast.info("No appointments found for the selected filters.");
      setIsExporting(false);
      return;
    }
    const reportData = appointmentsToExport.map((app: any) => ({
      'Date': formatDateIST(app.appointmentDateTime),
      'Time': formatTimeIST(app.appointmentDateTime),
      'Client Name': app.customerId?.name || 'N/A',
      'Client Phone': app.customerId?.phoneNumber || 'N/A',
      'Invoice #': app.invoiceId?.invoiceNumber || '-',
      'Services': Array.isArray(app.serviceIds) ? app.serviceIds.map((s: any) => s.name).join(', ') : 'N/A',
      'Stylist': app.stylistId?.name || 'N/A',
      'Status': app.status,
      // ▼▼▼ MODIFIED: Header changed to "Amount" and value format updated to "INR" ▼▼▼
      'Amount': app.finalAmount != null ? `INR${app.finalAmount.toFixed(2)}` : '0.00',
    }));
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Appointments");
    XLSX.writeFile(workbook, `Appointments_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    setIsExporting(false);
  };

  const handleExportToPDF = async () => {
    setIsExporting(true);
    const appointmentsToExport = await fetchAllAppointmentsForReport();
    if (appointmentsToExport.length === 0) {
      toast.info("No appointments found for the selected filters.");
      setIsExporting(false);
      return;
    }
    const doc = new jsPDF();
    // ▼▼▼ MODIFIED: Header changed to "Amount" ▼▼▼
    const tableColumns = ["Date & Time", "Client", "Invoice #", "Services", "Stylist", "Status", "Amount"];
    const tableRows = appointmentsToExport.map((app: any) => [
      `${formatDateIST(app.appointmentDateTime)} ${formatTimeIST(app.appointmentDateTime)}`,
      `${app.customerId?.name || 'N/A'} (${app.customerId?.phoneNumber || 'N/A'})`,
      app.invoiceId?.invoiceNumber || '-',
      Array.isArray(app.serviceIds) ? app.serviceIds.map((s: any) => s.name).join(', ') : 'N/A',
      app.stylistId?.name || 'N/A',
      app.status,
      // ▼▼▼ MODIFIED: Value format updated to "INR" ▼▼▼
      app.finalAmount != null ? `INR${app.finalAmount.toFixed(2)}` : '-',
    ]);
    doc.text("Appointments Report", 14, 15);
    autoTable(doc, {
      head: [tableColumns],
      body: tableRows,
      startY: 20,
      theme: 'grid',
    });
    doc.save(`Appointments_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    setIsExporting(false);
  };

  return (
    <Card>
      <div className="flex flex-col space-y-6">
        <div>
            <h2 className="text-xl font-semibold text-gray-800">
            Appointment Reports
            </h2>
            <p className="text-gray-600 mt-1">
            Use the filters below to generate a specific report, then download it.
            </p>
        </div>

        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                    <label htmlFor="startDate" className="text-sm font-medium text-gray-700 shrink-0">From:</label>
                    <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/50 text-sm w-full" />
                </div>
                <div className="flex items-center gap-2">
                    <label htmlFor="endDate" className="text-sm font-medium text-gray-700 shrink-0">To:</label>
                    <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/50 text-sm w-full" min={startDate} />
                </div>
                <div className="flex items-center gap-2">
                    <label htmlFor="status" className="text-sm font-medium text-gray-700 shrink-0">Status:</label>
                    <select id="status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/50 text-sm w-full bg-white">
                        {statusOptions.map(status => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={handleExportToExcel}
            disabled={isExporting}
            className="w-full sm:w-auto px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium">
            <ArrowDownTrayIcon className="h-5 w-5" />
            <span>{isExporting ? 'Exporting...' : 'Download as Excel'}</span>
          </button>
          <button
            onClick={handleExportToPDF}
            disabled={isExporting}
            className="w-full sm:w-auto px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium">
            <ArrowDownTrayIcon className="h-5 w-5" />
            <span>{isExporting ? 'Exporting...' : 'Download as PDF'}</span>
          </button>
        </div>
      </div>
    </Card>
  );
}