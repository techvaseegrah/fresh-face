// src/lib/reportUtils.ts

import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

// --- FIX 1: Change the import ---
// Import the autoTable function directly
import autoTable from 'jspdf-autotable';

// --- Excel Export Helper ---
export const exportToExcel = (
  data: any[], 
  fileName: string, 
  headers: string[], 
  dataMapper: (item: any) => Record<string, any>
) => {
  if (!data || data.length === 0) {
    alert("No data available to export.");
    return;
  }
  const mappedData = data.map(dataMapper);
  const worksheet = XLSX.utils.json_to_sheet(mappedData, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  XLSX.writeFile(workbook, `${fileName}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

// --- PDF Export Helper ---
export const exportToPdf = (
  data: any[], 
  fileName: string, 
  headers: string[], 
  reportTitle: string,
  dataMapper: (item: any) => any[]
) => {
  if (!data || data.length === 0) {
    alert("No data available to export.");
    return;
  }
  const doc = new jsPDF();
  const tableBody = data.map(dataMapper);

  doc.text(reportTitle, 14, 15);
  
  // --- FIX 2: Change the function call ---
  // Call autoTable as a function, passing 'doc' as the first argument
  autoTable(doc, {
      startY: 22,
      head: [headers],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [22, 160, 133] },
  });

  doc.save(`${fileName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};