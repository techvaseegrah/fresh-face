'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { exportToExcel, exportToPdf } from '@/lib/reportUtils';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
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
  const { data: session, status } = useSession();
  const userPermissions = session?.user?.role?.permissions || [];

  const [reportData, setReportData] = useState<PackageSale[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState<string>(formatDateForInput(subDays(new Date(), 29)));
  const [endDate, setEndDate] = useState<string>(formatDateForInput(new Date()));

  const fetchPackageSales = useCallback(async () => {
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
    if (status === 'authenticated') {
        fetchPackageSales();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);


  if (status === "loading") {
    return <div className="p-6">Loading...</div>;
  }

  if (status === "unauthenticated" || !hasPermission(userPermissions, PERMISSIONS.PACKAGES_REPORTS_READ)) {
    return (
        <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
                <p className="mt-2 text-gray-600">You do not have permission to view this report.</p>
            </div>
        </div>
    );
  }

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

  const handlePdfDownload = () => {
    setIsDownloading(true);
    const headers = ["Date", "Package", "Customer", "Phone", "Price", "Sold By", "Status"];
    const dataMapper = (sale: PackageSale) => [
      format(new Date(sale.purchaseDate), 'dd-MM-yy hh:mm'),
      sale.packageTemplateId?.name || 'N/A',
      sale.customerId?.name || 'N/A',
      sale.customerId?.phone || 'N/A',
      `₹${sale.purchasePrice.toFixed(2)}`,
      sale.soldBy?.name || 'N/A',
      sale.status,
    ];
    exportToPdf(reportData, 'package-sales-report', headers, 'Package Sales Report', dataMapper);
    setIsDownloading(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center md:text-left">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Package Sales Report</h1>
        <p className="text-gray-600 text-sm sm:text-base">Track and analyze package sales performance</p>
      </div>
      
      {/* Filters Section - Mobile Responsive */}
      <Card className="p-3 sm:p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <input 
                id="startDate" 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="w-full rounded-lg border-2 border-gray-300 px-3 py-3 text-black focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" 
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <input 
                id="endDate" 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="w-full rounded-lg border-2 border-gray-300 px-3 py-3 text-black focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" 
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-2 flex items-end">
              <Button 
                onClick={fetchPackageSales} 
                disabled={isLoading || isDownloading}
                className="w-full bg-green-600 hover:bg-green-700 focus:ring-green-500 min-h-[48px]"
              >
                {isLoading ? 'Fetching...' : 'Fetch Report'}
              </Button>
            </div>
          </div>
          
          {/* Download Buttons - Mobile Responsive */}
          {hasPermission(userPermissions, PERMISSIONS.PACKAGES_REPORTS_MANAGE) && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Download Options</h3>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleExcelDownload}
                  disabled={isLoading || isDownloading || reportData.length === 0}
                  className="flex-1 sm:flex-none min-h-[44px] border-green-600 text-green-600 hover:bg-green-50"
                >
                  📊 {isDownloading ? 'Downloading...' : 'Download Excel'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handlePdfDownload}
                  disabled={isLoading || isDownloading || reportData.length === 0}
                  className="flex-1 sm:flex-none min-h-[44px] border-red-600 text-red-600 hover:bg-red-50"
                >
                  📄 {isDownloading ? 'Downloading...' : 'Download PDF'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
      
      {/* Report Data - Mobile Responsive */}
      <Card>
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
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
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        sale.status === 'active' ? 'bg-green-100 text-green-800' :
                        sale.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {sale.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">
                    {isLoading ? 'Loading...' : !error ? 'No data available for the selected period.' : error}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="block md:hidden">
          {!isLoading && !error && reportData.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {reportData.map((sale, index) => (
                <div key={sale._id} className="p-4 hover:bg-gray-50 transition-colors">
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 text-sm font-bold rounded-full">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-base leading-tight">
                          {sale.packageTemplateId?.name || 'N/A'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          🗓️ {format(new Date(sale.purchaseDate), 'dd MMM yyyy, hh:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-xl text-green-600">₹{sale.purchasePrice.toFixed(2)}</p>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        sale.status === 'active' ? 'bg-green-100 text-green-800' :
                        sale.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {sale.status}
                      </span>
                    </div>
                  </div>
                  
                  {/* Card Details */}
                  <div className="space-y-3 bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium text-sm">👤 Customer</span>
                      <span className="text-gray-900 font-semibold text-sm">
                        {sale.customerId?.name || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium text-sm">📞 Phone</span>
                      <span className="text-gray-900 font-mono text-sm bg-white px-2 py-1 rounded border">
                        {sale.customerId?.phone || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium text-sm">👨‍💼 Sold By</span>
                      <span className="text-gray-900 font-semibold text-sm">
                        {sale.soldBy?.name || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-500">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Loading...</span>
                  </div>
                ) : !error ? (
                  <div>
                    <p className="text-lg font-medium mb-1">No data available</p>
                    <p className="text-sm">No packages were sold for the selected period.</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-medium text-red-600 mb-1">Error</p>
                    <p className="text-sm">{error}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}