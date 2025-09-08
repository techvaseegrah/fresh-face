// src/app/admin/reports/package-redemptions/page.tsx (or your file path)

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

interface PackageRedemption {
    _id: string;
    customerPackageId?: {
      packageTemplateId?: { name: string };
      customerId?: { name: string; phone: string };
    };
    serviceId?: { name: string };
    productId?: { name: string };
    quantityRedeemed: number;
    redeemedBy?: { name: string };
    createdAt: string;
}

const formatDateForInput = (date: Date): string => format(date, 'yyyy-MM-dd');

export default function PackageRedemptionsReportPage() {
  const { data: session } = useSession();
  const userPermissions = session?.user?.role?.permissions || [];
  const canManageReport = userPermissions.includes(PERMISSIONS.PACKAGES_REPORTS_MANAGE) || userPermissions.includes(PERMISSIONS.ALL);

  const [reportData, setReportData] = useState<PackageRedemption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false); // State for download buttons
  const [error, setError] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState<string>(formatDateForInput(subDays(new Date(), 29)));
  const [endDate, setEndDate] = useState<string>(formatDateForInput(new Date()));

  const fetchPackageRedemptions = useCallback(async () => {
    // ... (fetchPackageRedemptions function remains unchanged)
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
    fetchPackageRedemptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getItemName = (redemption: PackageRedemption) => redemption.serviceId?.name || redemption.productId?.name || 'N/A';

  // --- HANDLER FOR EXCEL DOWNLOAD ---
  const handleExcelDownload = () => {
    setIsDownloading(true);
    const headers = ["Date Redeemed", "Package Name", "Customer Name", "Item Redeemed", "Qty", "Redeemed By"];
    const dataMapper = (item: PackageRedemption) => ({
      "Date Redeemed": format(new Date(item.createdAt), 'dd-MM-yyyy hh:mm a'),
      "Package Name": item.customerPackageId?.packageTemplateId?.name || 'N/A',
      "Customer Name": item.customerPackageId?.customerId?.name || 'N/A',
      "Item Redeemed": getItemName(item),
      "Qty": item.quantityRedeemed,
      "Redeemed By": item.redeemedBy?.name || 'N/A',
    });
    exportToExcel(reportData, 'package-redemptions-report', headers, dataMapper);
    setIsDownloading(false);
  };

  // --- HANDLER FOR PDF DOWNLOAD ---
  const handlePdfDownload = () => {
    setIsDownloading(true);
    const headers = ["Date", "Package", "Customer", "Item Redeemed", "Qty", "Redeemed By"];
    const dataMapper = (item: PackageRedemption) => [
      format(new Date(item.createdAt), 'dd-MM-yy hh:mm'),
      item.customerPackageId?.packageTemplateId?.name || 'N/A',
      item.customerPackageId?.customerId?.name || 'N/A',
      getItemName(item),
      item.quantityRedeemed,
      item.redeemedBy?.name || 'N/A',
    ];
    exportToPdf(reportData, 'package-redemptions-report', headers, 'Package Redemptions Report', dataMapper);
    setIsDownloading(false);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Package Redemptions Report</h1>
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
                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors" 
              />
            </div>
            <div className="w-full">
              <label htmlFor="endDate" className="block text-sm font-semibold text-gray-700 mb-2">To:</label>
              <input 
                id="endDate" 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors" 
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
                className="border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors" 
              />
            </div>
            <div className="flex items-center gap-3">
              <label htmlFor="endDate-desktop" className="text-sm font-semibold text-gray-700 whitespace-nowrap">To:</label>
              <input 
                id="endDate-desktop" 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors" 
              />
            </div>
            <Button 
              onClick={fetchPackageRedemptions} 
              disabled={isLoading || isDownloading} 
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              {isLoading ? '⏳ Fetching...' : '🔍 Fetch Report'}
            </Button>
            {canManageReport && (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleExcelDownload}
                  disabled={isLoading || isDownloading || reportData.length === 0}
                  className="border-2 border-green-600 text-green-600 hover:bg-green-50 font-medium py-2.5 px-4 rounded-lg transition-colors"
                >
                  {isDownloading ? '⏳ Downloading...' : '📊 Excel'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handlePdfDownload}
                  disabled={isLoading || isDownloading || reportData.length === 0}
                  className="border-2 border-green-600 text-green-600 hover:bg-green-50 font-medium py-2.5 px-4 rounded-lg transition-colors"
                >
                  {isDownloading ? '⏳ Downloading...' : '📄 PDF'}
                </Button>
              </>
            )}
          </div>
          
          {/* Mobile Buttons - Separate Section */}
          <div className="md:hidden space-y-3">
            <Button 
              onClick={fetchPackageRedemptions} 
              disabled={isLoading || isDownloading} 
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
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
                  className="border-2 border-green-600 text-green-600 hover:bg-green-50 font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  {isDownloading ? '⏳' : '📊 Excel'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handlePdfDownload}
                  disabled={isLoading || isDownloading || reportData.length === 0}
                  className="border-2 border-green-600 text-green-600 hover:bg-green-50 font-medium py-3 px-4 rounded-lg transition-colors"
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
          <div className="text-center text-gray-600">Loading package redemptions data...</div>
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
                <TableHead>Date Redeemed</TableHead>
                <TableHead>Package Name</TableHead>
                <TableHead>Customer Name</TableHead>
                <TableHead>Item Redeemed</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Redeemed By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.length > 0 ? (
                reportData.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell>{format(new Date(item.createdAt), 'dd MMM yyyy, hh:mm a')}</TableCell>
                    <TableCell>{item.customerPackageId?.packageTemplateId?.name || 'N/A'}</TableCell>
                    <TableCell>{item.customerPackageId?.customerId?.name || 'N/A'}</TableCell>
                    <TableCell>{getItemName(item)}</TableCell>
                    <TableCell>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                        {item.quantityRedeemed}
                      </span>
                    </TableCell>
                    <TableCell>{item.redeemedBy?.name || 'N/A'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24 text-gray-500">
                    No package redemptions data available for the selected period
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
            reportData.map((item) => (
              <Card key={item._id} className="p-4 border-l-4 border-l-green-500 hover:shadow-md transition-shadow">
                <div className="space-y-3">
                  {/* Header Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎁</span>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {item.customerPackageId?.packageTemplateId?.name || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(item.createdAt), 'dd MMM yyyy, hh:mm a')}
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full">
                      <span className="text-xs font-medium">Qty: </span>
                      <span className="font-bold">{item.quantityRedeemed}</span>
                    </div>
                  </div>
                  
                  {/* Customer Info */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">👤</span>
                      <div>
                        <div className="font-medium text-gray-900">
                          {item.customerPackageId?.customerId?.name || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-600">
                          📞 {item.customerPackageId?.customerId?.phone || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Item Redeemed */}
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">📾</span>
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Item Redeemed</div>
                        <div className="font-medium text-blue-900">
                          {getItemName(item)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Redeemed By */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-gray-600">
                      <span>👨‍💼</span>
                      <span>Redeemed by:</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {item.redeemedBy?.name || 'N/A'}
                    </span>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-4">🎁</div>
                <div className="font-medium mb-2">No Package Redemptions Found</div>
                <div className="text-sm">No package redemptions data available for the selected period</div>
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