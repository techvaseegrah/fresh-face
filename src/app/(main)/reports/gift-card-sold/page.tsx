'use client';

import React, { useState, useCallback,useEffect } from 'react';
import  Button  from '@/components/ui/Button';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

interface SoldCardReportItem {
  _id: string;
  purchaseInvoiceId?: { _id: string, invoiceNumber: string };
  issueDate: string;
  expiryDate: string;
  giftCardTemplateId: { name: string };
  uniqueCode: string;
  // --- THE FIX: Expect `phoneNumber` ---
  customerId: { name: string, phoneNumber: string }; 
  issuedByStaffId?: { name: string };
  initialBalance: number;
}

export default function GiftCardSoldReportPage() {
     const { data: session, status } = useSession();
    const userPermissions = session?.user?.role?.permissions || [];
    
    if (status === "loading") {
        return <div className="p-6">Loading...</div>; // Or a spinner component
    }

    if (status === "unauthenticated" || !hasPermission(userPermissions, PERMISSIONS.REPORT_GIFT_CARD_SOLD_READ)) {
        return (
            <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
                    <p className="mt-2 text-gray-600">You do not have permission to view this report.</p>
                </div>
            </div>
        );
    }
    // --- END: ADD PERMISSION CHECK ---
    const [reportData, setReportData] = useState<SoldCardReportItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchReport = useCallback(async () => {
        
        try {
            const params = new URLSearchParams({ from: fromDate, to: toDate });
            const response = await fetch(`/api/reports/gift-card-sold?${params}`);
            if (response.ok) { const data = await response.json(); setReportData(data); } 
            else { console.error("Failed to fetch report"); setReportData([]); }
        } catch (error) { console.error("Error fetching report:", error); setReportData([]); } 
        finally { setIsLoading(false); }
    }, [fromDate, toDate]);

    useEffect(() => {
        fetchReport();
    }, []); // The empty dependency array [] means it only runs on mount
    // --- END: THE FIX -
    const handleShowReport = () => { fetchReport(); };
    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB');

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Gift Card Sold Report</h1>
            <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex items-center gap-4">
                <div>
                    <label htmlFor="fromDate" className="block text-sm font-medium text-gray-700">From</label>
                    <input type="date" id="fromDate" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
                <div>
                    <label htmlFor="toDate" className="block text-sm font-medium text-gray-700">To</label>
                    <input type="date" id="toDate" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
                <div className="mt-6"><Button onClick={handleShowReport} disabled={isLoading}>{isLoading ? 'Loading...' : 'Show Report'}</Button></div>
            </div>
            {/* --- START: DOWNLOAD BUTTONS --- */}
             {hasPermission(userPermissions, PERMISSIONS.REPORT_GIFT_CARD_REDEMPTION_MANAGE) && (
                <div className="flex gap-3 mt-6 border-t pt-4 pb-4">
                    <a
                        href={`/api/reports/download?reportType=sold&format=xlsx&from=${fromDate}&to=${toDate}`}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                        download
                    >
                        Download Excel
                    </a>
                    <a
                        href={`/api/reports/download?reportType=sold&format=pdf&from=${fromDate}&to=${toDate}`}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                        download
                    >
                        Download PDF
                    </a>
                </div>
            )}
            <div className="bg-white p-4 rounded-lg shadow-md overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SR. NO.</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gift Card Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gift Card Number</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest Number</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {reportData.map((item, index) => (
                            <tr key={item._id}>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{index + 1}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.purchaseInvoiceId?.invoiceNumber || 'N/A'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatDate(item.issueDate)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatDate(item.expiryDate)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.giftCardTemplateId.name}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.uniqueCode}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.customerId.name}</td>
                                {/* --- THE FIX: Use `phoneNumber` --- */}
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.customerId.phoneNumber || 'N/A'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.issuedByStaffId?.name || 'N/A'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">₹{item.initialBalance}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!isLoading && reportData.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No data found for the selected period.</p>
                )}
            </div>
        </div>
    );
}