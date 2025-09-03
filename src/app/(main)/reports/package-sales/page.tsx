// src/app/admin/reports/package-sales/page.tsx (or your file path)

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useSession } from 'next-auth/react';

// REMOVE THE OLD MODAL IMPORT
// import ReportDownloadModal from '@/components/ReportDownloadModal';

// ADD THE NEW UTILS IMPORT
import { exportToExcel, exportToPdf } from '@/lib/reportUtils';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { PERMISSIONS } from '@/lib/permissions';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface PackageSale {
  _id: string;
  packageTemplateId: { name: string };
  customerId: { name: string; phone: string };
  purchasePrice: number;
  soldBy: { name: string };
  purchaseDate: string;
  status: 'active' | 'completed' | 'expired';
}

const formatDateForInput = (date: Date): string => format(date, 'yyyy-MM-dd');

export default function PackageSalesReportPage() {
  const { data: session } = useSession();
  const userPermissions = session?.user?.role?.permissions || [];
  const canManageReport = userPermissions.includes(PERMISSIONS.PACKAGES_REPORTS_MANAGE) || userPermissions.includes(PERMISSIONS.ALL);

  const [reportData, setReportData] = useState<PackageSale[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false); // State for download buttons
  const [error, setError] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState<string>(formatDateForInput(subDays(new Date(), 29)));
  const [endDate, setEndDate] = useState<string>(formatDateForInput(new Date()));

  const fetchPackageSales = useCallback(async () => {
    // ... (fetchPackageSales function remains unchanged)
    if (!startDate || !endDate) {
      setReportData([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const from = startOfDay(new Date(startDate)).toISOString();
      const to = endOfDay(new Date(endDate)).toISOString();
      const params = new URLSearchParams({ startDate: from, endDate: to });
      const res = await fetch(`/api/reports/package-sales?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to fetch data: ${res.statusText}`);
      }
      const data = await res.json();
      setReportData(data);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
      console.error("Error fetching package sales report:", e);
      setError(errorMessage);
      setReportData([]);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchPackageSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- HANDLER FOR EXCEL DOWNLOAD ---
  const handleExcelDownload = () => {
    setIsDownloading(true);
    const headers = ["Date Sold", "Package Name", "Customer Name", "Customer Phone", "Price", "Sold By", "Status"];
    const dataMapper = (sale: PackageSale) => ({
        "Date Sold": format(new Date(sale.purchaseDate), 'dd-MM-yyyy hh:mm a'),
        "Package Name": sale.packageTemplateId?.name || 'N/A',
        "Customer Name": sale.customerId?.name || 'N/A',
        "Customer Phone": sale.customerId?.phone || 'N/A',
        "Price": sale.purchasePrice,
        "Sold By": sale.soldBy?.name || 'N/A',
        "Status": sale.status,
    });
    exportToExcel(reportData, 'package-sales-report', headers, dataMapper);
    setIsDownloading(false);
  };

  // --- HANDLER FOR PDF DOWNLOAD ---
  const handlePdfDownload = () => {
    setIsDownloading(true);
    const headers = ["Date", "Package", "Customer", "Phone", "Price", "Sold By", "Status"];
    const dataMapper = (sale: PackageSale) => [
      format(new Date(sale.purchaseDate), 'dd-MM-yy hh:mm'),
      sale.packageTemplateId?.name || 'N/A',
      sale.customerId?.name || 'N/A',
      sale.customerId?.phone || 'N/A',
      `Rs ${sale.purchasePrice.toFixed(2)}`,
      sale.soldBy?.name || 'N/A',
      sale.status,
    ];
    exportToPdf(reportData, 'package-sales-report', headers, 'Package Sales Report', dataMapper);
    setIsDownloading(false);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Package Sales Report</h1>
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* ... (date inputs remain the same) ... */}
           <div className="flex items-center gap-2">
            <label htmlFor="startDate" className="text-sm font-medium">From:</label>
            <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="endDate" className="text-sm font-medium">To:</label>
            <input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <Button onClick={fetchPackageSales} disabled={isLoading || isDownloading}>
            {isLoading ? 'Fetching...' : 'Fetch Report'}
          </Button>
          
          {/* --- ADD NEW DOWNLOAD BUTTONS --- */}
          {canManageReport && (
            <>
              <Button 
                variant="outline" 
                onClick={handleExcelDownload}
                disabled={isLoading || isDownloading || reportData.length === 0}
              >
                {isDownloading ? 'Downloading...' : 'Download Excel'}
              </Button>
              <Button 
                variant="outline" 
                onClick={handlePdfDownload}
                disabled={isLoading || isDownloading || reportData.length === 0}
              >
                {isDownloading ? 'Downloading...' : 'Download PDF'}
              </Button>
            </>
          )}
        </div>
      </Card>
      
      {/* ... (Table rendering remains unchanged) ... */}
       <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date Sold</TableHead>
              <TableHead>Package Name</TableHead>
              <TableHead>Customer Name</TableHead>
              <TableHead>Customer Phone</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Sold By</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && !error && reportData.length > 0 ? (
              reportData.map((sale) => (
                <TableRow key={sale._id}>
                  <TableCell>{format(new Date(sale.purchaseDate), 'dd MMM yyyy, hh:mm a')}</TableCell>
                  <TableCell>{sale.packageTemplateId?.name || 'N/A'}</TableCell>
                  <TableCell>{sale.customerId?.name || 'N/A'}</TableCell>
                  <TableCell>{sale.customerId?.phone || 'N/A'}</TableCell>
                  <TableCell>₹{sale.purchasePrice.toFixed(2)}</TableCell>
                  <TableCell>{sale.soldBy?.name || 'N/A'}</TableCell>
                  <TableCell>{sale.status}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  {!isLoading && !error ? 'No data available for the selected period.' : ''}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* --- REMOVE THE MODAL COMPONENT --- */}
      {/* <ReportDownloadModal ... /> */}
    </div>
  );
}