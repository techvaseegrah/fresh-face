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
  const { data: session, status } = useSession();
  const userPermissions = session?.user?.role?.permissions || [];
  
  const [reportData, setReportData] = useState<PackageRedemption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState<string>(formatDateForInput(subDays(new Date(),0)));
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

  const getItemName = (redemption: PackageRedemption) => redemption.serviceId?.name || redemption.productId?.name || 'N/A';

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
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
           <div className="flex items-center gap-2">
            <label htmlFor="startDate" className="text-sm font-medium">From:</label>
            <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="endDate" className="text-sm font-medium">To:</label>
            <input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <Button onClick={fetchPackageRedemptions} disabled={isLoading || isDownloading}>
            {isLoading ? 'Fetching...' : 'Fetch Report'}
          </Button>

          {hasPermission(userPermissions, PERMISSIONS.PACKAGES_REPORTS_MANAGE) && (
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
      
      <Card>
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
                  <TableCell>{format(new Date(item.createdAt), 'dd MMM yyyy, hh:mm a')}</TableCell>
                  <TableCell>{item.customerPackageId?.packageTemplateId?.name || 'N/A'}</TableCell>
                  <TableCell>{item.customerPackageId?.customerId?.name || 'N/A'}</TableCell>
                  <TableCell>{getItemName(item)}</TableCell>
                  <TableCell>{item.quantityRedeemed}</TableCell>
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
      </Card>
    </div>
  );
}