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
      {/* Filters Section - Enhanced Mobile Frame */}
      <Card className="p-4 mb-4 shadow-sm border border-gray-200 bg-white">
        <div className="space-y-4">
          {/* Date Inputs - Properly Contained */}
          <div className="space-y-3">
            <div className="w-full">
              <label htmlFor="startDate" className="block text-sm font-semibold text-gray-700 mb-2">From:</label>
              <input 
                id="startDate" 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-colors" 
              />
            </div>
            <div className="w-full">
              <label htmlFor="endDate" className="block text-sm font-semibold text-gray-700 mb-2">To:</label>
              <input 
                id="endDate" 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-colors" 
              />
            </div>
          </div>
          
          {/* Desktop Layout */}
          <div className="hidden md:flex md:flex-wrap md:items-center md:gap-4">
            <div className="flex items-center gap-3">
              <label htmlFor="startDate-desktop" className="text-sm font-semibold text-gray-700 whitespace-nowrap">From:</label>
              <input 
                id="startDate-desktop" 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-colors" 
              />
            </div>
            <div className="flex items-center gap-3">
              <label htmlFor="endDate-desktop" className="text-sm font-semibold text-gray-700 whitespace-nowrap">To:</label>
              <input 
                id="endDate-desktop" 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-colors" 
              />
            </div>
            <Button 
              onClick={fetchPackageSales} 
              disabled={isLoading || isDownloading} 
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              {isLoading ? '⏳ Fetching...' : '🔍 Fetch Report'}
            </Button>
            {canManageReport && (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleExcelDownload}
                  disabled={isLoading || isDownloading || reportData.length === 0}
                  className="border-2 border-purple-600 text-purple-600 hover:bg-purple-50 font-medium py-2.5 px-4 rounded-lg transition-colors"
                >
                  {isDownloading ? '⏳ Downloading...' : '📊 Excel'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handlePdfDownload}
                  disabled={isLoading || isDownloading || reportData.length === 0}
                  className="border-2 border-purple-600 text-purple-600 hover:bg-purple-50 font-medium py-2.5 px-4 rounded-lg transition-colors"
                >
                  {isDownloading ? '⏳ Downloading...' : '📄 PDF'}
                </Button>
              </>
            )}
          </div>
          
          {/* Mobile Buttons - Separate Section */}
          <div className="md:hidden space-y-3">
            <Button 
              onClick={fetchPackageSales} 
              disabled={isLoading || isDownloading} 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {isLoading ? '⏳ Fetching...' : '🔍 Fetch Report'}
            </Button>
            
            {/* Download Buttons - Mobile */}
            {canManageReport && (
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleExcelDownload}
                  disabled={isLoading || isDownloading || reportData.length === 0}
                  className="border-2 border-purple-600 text-purple-600 hover:bg-purple-50 font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  {isDownloading ? '⏳' : '📊 Excel'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handlePdfDownload}
                  disabled={isLoading || isDownloading || reportData.length === 0}
                  className="border-2 border-purple-600 text-purple-600 hover:bg-purple-50 font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  {isDownloading ? '⏳' : '📄 PDF'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
      
      {/* Loading and Error States */}
      {isLoading && (
        <Card className="p-8">
          <div className="text-center text-gray-600">Loading package sales data...</div>
        </Card>
      )}
      
      {error && (
        <Card className="p-6">
          <div className="text-center text-red-600">Error: {error}</div>
        </Card>
      )}
      
      {/* Desktop Table - Hidden on Mobile */}
      {!isLoading && !error && (
        <Card className="hidden md:block overflow-x-auto">
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
              {reportData.length > 0 ? (
                reportData.map((sale) => (
                  <TableRow key={sale._id}>
                    <TableCell>{format(new Date(sale.purchaseDate), 'dd MMM yyyy, hh:mm a')}</TableCell>
                    <TableCell>{sale.packageTemplateId?.name || 'N/A'}</TableCell>
                    <TableCell>{sale.customerId?.name || 'N/A'}</TableCell>
                    <TableCell>{sale.customerId?.phone || 'N/A'}</TableCell>
                    <TableCell>₹{sale.purchasePrice.toFixed(2)}</TableCell>
                    <TableCell>{sale.soldBy?.name || 'N/A'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        sale.status === 'active' ? 'bg-green-100 text-green-800' :
                        sale.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {sale.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24 text-gray-500">
                    No package sales data available for the selected period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
      
      {/* Mobile Card Layout - Hidden on Desktop */}
      {!isLoading && !error && (
        <div className="md:hidden space-y-3">
          {reportData.length > 0 ? (
            reportData.map((sale) => (
              <Card key={sale._id} className="p-4 border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
                <div className="space-y-3">
                  {/* Header Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📦</span>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {sale.packageTemplateId?.name || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(sale.purchaseDate), 'dd MMM yyyy, hh:mm a')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-purple-600">
                        ₹{sale.purchasePrice.toFixed(2)}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        sale.status === 'active' ? 'bg-green-100 text-green-800' :
                        sale.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {sale.status}
                      </span>
                    </div>
                  </div>
                  
                  {/* Customer Info */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">👤</span>
                      <div>
                        <div className="font-medium text-gray-900">
                          {sale.customerId?.name || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-600">
                          📞 {sale.customerId?.phone || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Sold By */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-gray-600">
                      <span>👨‍💼</span>
                      <span>Sold by:</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {sale.soldBy?.name || 'N/A'}
                    </span>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-4">📦</div>
                <div className="font-medium mb-2">No Package Sales Found</div>
                <div className="text-sm">No package sales data available for the selected period</div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* --- REMOVE THE MODAL COMPONENT --- */}
      {/* <ReportDownloadModal ... /> */}
    </div>
  );
}