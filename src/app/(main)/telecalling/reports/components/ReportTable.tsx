'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { TelecallingLog } from '../page';
import Button from '@/components/ui/Button';
import { Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- CHANGE 1: Update the props to receive the filters object ---
interface TableProps {
  logs: TelecallingLog[]; // This is still used to display the current page's data
  filters: {
    startDate: Date;
    endDate: Date;
    outcome: string;
  };
}

export default function ReportTable({ logs, filters }: TableProps) {
  const { data: session } = useSession();
  // --- CHANGE 2: Add a loading state for the download buttons ---
  const [isDownloading, setIsDownloading] = useState(false);

  // --- CHANGE 3: Rewrite the export handlers to fetch all data ---
  const handleExport = async (formatType: 'excel' | 'pdf') => {
    if (!session) {
      toast.error('You must be logged in to download reports.');
      return;
    }
    
    setIsDownloading(true);
    try {
      // Build the URL with the current filters, just like the main page
      const params = new URLSearchParams({
        startDate: format(filters.startDate, 'yyyy-MM-dd'),
        endDate: format(filters.endDate, 'yyyy-MM-dd'),
        outcome: filters.outcome,
      });

      // Call the NEW export-specific API endpoint
      const response = await fetch(`/api/telecalling/log/export?${params.toString()}`, {
        headers: { 'x-tenant-id': session.user.tenantId },
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to download report data.');
      }

      const allLogs: TelecallingLog[] = await response.json(); // This contains ALL logs, not just one page

      if (allLogs.length === 0) {
        toast.info("No data to export for the selected filters.");
        return;
      }
      
      // Now, generate the file based on the full dataset
      if (formatType === 'excel') {
        generateExcel(allLogs);
      } else {
        generatePdf(allLogs);
      }

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const generateExcel = (dataToExport: TelecallingLog[]) => {
    const data = dataToExport.map(log => ({
      "Call Date": format(new Date(log.createdAt), 'dd-MM-yyyy HH:mm'),
      "Client Name": log.clientName,
      "Phone Number": log.phoneNumber,
      "Outcome": log.outcome,
      "Caller Name": log.callerName,
      "Notes": log.notes,
      "Last Visit": log.lastVisitDate ? format(new Date(log.lastVisitDate), 'dd-MM-yyyy') : 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Telecalling Report");
    XLSX.writeFile(workbook, `Telecalling_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const generatePdf = (dataToExport: TelecallingLog[]) => {
    const doc = new jsPDF();
    
    autoTable(doc, {
        head: [['Call Date', 'Client Name', 'Phone', 'Outcome', 'Caller']],
        body: dataToExport.map(log => [
            format(new Date(log.createdAt), 'dd-MM-yy HH:mm'),
            log.clientName,
            log.phoneNumber,
            log.outcome,
            log.callerName
        ]),
        didDrawPage: (data) => {
            doc.setFontSize(18);
            doc.setTextColor(40);
            doc.text("Telecalling Report", data.settings.margin.left, 15);
        },
        margin: { top: 20 },
    });

    doc.save(`Telecalling_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <>
      <div className="p-4 flex justify-end space-x-3 border-b bg-gray-50">
        <Button 
          onClick={() => handleExport('excel')} 
          disabled={isDownloading}
          className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 disabled:opacity-50"
        >
          <Download size={18} /> {isDownloading ? 'Downloading...' : 'Excel'}
        </Button>
        <Button 
          onClick={() => handleExport('pdf')}
          disabled={isDownloading}
          className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50"
        >
          <FileText size={18} /> {isDownloading ? 'Downloading...' : 'PDF'}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client Details</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Call Info</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.length > 0 ? logs.map(log => (
              <tr key={log._id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{log.clientName}</div>
                  <div className="text-sm text-gray-500">{log.phoneNumber}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.outcome === 'Appointment Booked' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {log.outcome}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">By {log.callerName} on {format(new Date(log.createdAt), 'dd MMM, yyyy HH:mm')}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">{log.notes || '-'}</td>
              </tr>
            )) : (
              <tr><td colSpan={3} className="text-center py-16 text-gray-500">No logs found for the selected filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}