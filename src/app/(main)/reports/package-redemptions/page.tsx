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

// --- FIX #1: Update the interface to match the API response ---
interface PackageRedemption {
    _id: string;
    customerPackageId?: {
      packageTemplateId?: { name: string };
      customerId?: { name: string; phone: string };
    };
    itemName: string; // The API sends a single 'itemName' field now
    redeemedQuantity: number; // The API sends 'redeemedQuantity'
    redeemedBy?: { name: string };
    redeemedAt: string; // Use 'redeemedAt' instead of 'createdAt'
}

const formatDateForInput = (date: Date): string => format(date, 'yyyy-MM-dd');

export default function PackageRedemptionsReportPage() {
  const { data: session, status } = useSession();
  const userPermissions = session?.user?.role?.permissions || [];
  
  const [reportData, setReportData] = useState<PackageRedemption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState<string>(formatDateForInput(subDays(new Date(), 29)));
  const [endDate, setEndDate] = useState<string>(formatDateForInput(new Date()));

  const fetchPackageRedemptions = useCallback(async () => {
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
      const res = await fetch(`/api/reports/package-redemptions?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to fetch data: ${res.statusText}`);
      }
      const data = await res.json();
      setReportData(data);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
      console.error("Error fetching package redemptions report:", e);
      setError(errorMessage);
      setReportData([]);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (status === 'authenticated') {
        fetchPackageRedemptions();
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
    const headers = ["Date Redeemed", "Package Name", "Customer Name", "Item Redeemed", "Qty", "Redeemed By"];
    const dataMapper = (item: PackageRedemption) => ({
      // --- FIX #2: Use item.redeemedAt in export functions ---
      "Date Redeemed": format(new Date(item.redeemedAt), 'dd-MM-yyyy hh:mm a'),
      "Package Name": item.customerPackageId?.packageTemplateId?.name || 'N/A',
      "Customer Name": item.customerPackageId?.customerId?.name || 'N/A',
      "Item Redeemed": item.itemName,
      "Qty": item.redeemedQuantity,
      "Redeemed By": item.redeemedBy?.name || 'N/A',
    });
    exportToExcel(reportData, 'package-redemptions-report', headers, dataMapper);
    setIsDownloading(false);
  };

  const handlePdfDownload = () => {
    setIsDownloading(true);
    const headers = ["Date", "Package", "Customer", "Item Redeemed", "Qty", "Redeemed By"];
    const dataMapper = (item: PackageRedemption) => [
      // --- FIX #3: Use item.redeemedAt in export functions ---
      format(new Date(item.redeemedAt), 'dd-MM-yy hh:mm'),
      item.customerPackageId?.packageTemplateId?.name || 'N/A',
      item.customerPackageId?.customerId?.name || 'N/A',
      item.itemName,
      item.redeemedQuantity,
      item.redeemedBy?.name || 'N/A',
    ];
    exportToPdf(reportData, 'package-redemptions-report', headers, 'Package Redemptions Report', dataMapper);
    setIsDownloading(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center md:text-left">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Package Redemptions Report</h1>
        <p className="text-gray-600 text-sm sm:text-base">Track package usage and customer engagement</p>
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
                onClick={fetchPackageRedemptions} 
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
                <TableHead>Date Redeemed</TableHead>
                <TableHead>Package Name</TableHead>
                <TableHead>Customer Name</TableHead>
                <TableHead>Item Redeemed</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Redeemed By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && !error && reportData.length > 0 ? (
                reportData.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell>{format(new Date(item.redeemedAt), 'dd MMM yyyy, hh:mm a')}</TableCell>
                    <TableCell>{item.customerPackageId?.packageTemplateId?.name || 'N/A'}</TableCell>
                    <TableCell>{item.customerPackageId?.customerId?.name || 'N/A'}</TableCell>
                    <TableCell>{item.itemName}</TableCell>
                    <TableCell>{item.redeemedQuantity}</TableCell>
                    <TableCell>{item.redeemedBy?.name || 'N/A'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
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
              {reportData.map((item, index) => (
                <div key={item._id} className="p-4 hover:bg-gray-50 transition-colors">
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-purple-100 text-purple-800 text-sm font-bold rounded-full">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-base leading-tight">
                          {item.customerPackageId?.packageTemplateId?.name || 'N/A'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          🗓️ {format(new Date(item.redeemedAt), 'dd MMM yyyy, hh:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-xl text-purple-600">×{item.redeemedQuantity}</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Quantity</p>
                    </div>
                  </div>
                  
                  {/* Card Details */}
                  <div className="space-y-3 bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium text-sm">👤 Customer</span>
                      <span className="text-gray-900 font-semibold text-sm">
                        {item.customerPackageId?.customerId?.name || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium text-sm">🏷️ Item Redeemed</span>
                      <span className="text-gray-900 font-semibold text-sm bg-white px-2 py-1 rounded border">
                        {item.itemName}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium text-sm">👨‍💼 Redeemed By</span>
                      <span className="text-gray-900 font-semibold text-sm">
                        {item.redeemedBy?.name || 'N/A'}
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
                    <p className="text-sm">No package redemptions found for the selected period.</p>
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