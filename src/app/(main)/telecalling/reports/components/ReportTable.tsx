'use client';

import { TelecallingLog } from '../page';
import Button from '@/components/ui/Button';
import { Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
// 1. CHANGE THIS IMPORT: Import 'autoTable' as a named function
import autoTable from 'jspdf-autotable';

interface TableProps {
  logs: TelecallingLog[];
}

export default function ReportTable({ logs }: TableProps) {

  const handleExportToExcel = () => {
    const data = logs.map(log => ({
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

  const handleExportToPDF = () => {
    const doc = new jsPDF();
    
    // 2. CHANGE THIS FUNCTION CALL: Call autoTable directly and pass the 'doc' instance to it.
    autoTable(doc, {
        head: [['Call Date', 'Client Name', 'Phone', 'Outcome', 'Caller']],
        body: logs.map(log => [
            format(new Date(log.createdAt), 'dd-MM-yy HH:mm'),
            log.clientName,
            log.phoneNumber,
            log.outcome,
            log.callerName
        ]),
        // Optional: Add a title to the PDF
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
        <Button onClick={handleExportToExcel} className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2">
          <Download size={18} /> Excel
        </Button>
        <Button onClick={handleExportToPDF} className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2">
          <FileText size={18} /> PDF
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