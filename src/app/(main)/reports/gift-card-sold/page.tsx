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
    
    // Move all hooks to the top, before any conditional returns
    const [reportData, setReportData] = useState<SoldCardReportItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchReport = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({ from: fromDate, to: toDate });
            const response = await fetch(`/api/reports/gift-card-sold?${params}`);
            if (response.ok) {
                const data = await response.json();
                setReportData(data);
            } else {
                console.error("Failed to fetch report");
                setReportData([]);
            }
        } catch (error) {
            console.error("Error fetching report:", error);
            setReportData([]);
        } finally {
            setIsLoading(false);
        }
    }, [fromDate, toDate]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const handleShowReport = () => {
        fetchReport();
    };

    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB');
    
    // Now handle conditional rendering after hooks
    if (status === "loading") {
        return <div className="p-6">Loading...</div>;
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

    return (
        <div className="p-3 sm:p-6 bg-gray-50 min-h-screen">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Gift Card Sold Report</h1>
            
            {/* Filters Section - Responsive */}
            <div className="bg-white p-3 sm:p-4 rounded-lg shadow-md mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    <div className="w-full sm:w-auto">
                        <label htmlFor="fromDate" className="block text-sm font-medium text-gray-700">From</label>
                        <input 
                            type="date" 
                            id="fromDate" 
                            value={fromDate} 
                            onChange={(e) => setFromDate(e.target.value)} 
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm" 
                        />
                    </div>
                    <div className="w-full sm:w-auto">
                        <label htmlFor="toDate" className="block text-sm font-medium text-gray-700">To</label>
                        <input 
                            type="date" 
                            id="toDate" 
                            value={toDate} 
                            onChange={(e) => setToDate(e.target.value)} 
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm" 
                        />
                    </div>
                    <div className="w-full sm:w-auto sm:mt-6">
                        <Button onClick={handleShowReport} disabled={isLoading} className="w-full sm:w-auto">
                            {isLoading ? 'Loading...' : 'Show Report'}
                        </Button>
                    </div>
                </div>
            </div>
            
            {/* Download Buttons - Responsive */}
            {hasPermission(userPermissions, PERMISSIONS.REPORT_GIFT_CARD_REDEMPTION_MANAGE) && (
                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-md mb-6">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        <a
                            href={`/api/reports/download?reportType=sold&format=xlsx&from=${fromDate}&to=${toDate}`}
                            className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 text-center transition-colors"
                            download
                        >
                            📊 Download Excel
                        </a>
                        <a
                            href={`/api/reports/download?reportType=sold&format=pdf&from=${fromDate}&to=${toDate}`}
                            className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 text-center transition-colors"
                            download
                        >
                            📄 Download PDF
                        </a>
                    </div>
                </div>
            )}
            
            {/* Report Table - Responsive Design */}
            <div className="bg-white rounded-lg shadow-md">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
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
                                <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{index + 1}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.purchaseInvoiceId?.invoiceNumber || 'N/A'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatDate(item.issueDate)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatDate(item.expiryDate)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.giftCardTemplateId.name}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.uniqueCode}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.customerId.name}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.customerId.phoneNumber || 'N/A'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.issuedByStaffId?.name || 'N/A'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">₹{item.initialBalance}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="block md:hidden">
                    {reportData.length > 0 ? (
                        <div className="divide-y divide-gray-200">
                            {reportData.map((item, index) => (
                                <div key={item._id} className="p-4 hover:bg-gray-50 transition-colors active:bg-gray-100">
                                    {/* Card Header */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-start gap-3">
                                            <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 text-sm font-bold rounded-full">
                                                {index + 1}
                                            </span>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-gray-900 text-base leading-tight">{item.giftCardTemplateId.name}</h3>
                                                <p className="text-sm text-gray-500 mt-1">🗓️ {formatDate(item.issueDate)}</p>
                                                {item.purchaseInvoiceId?.invoiceNumber && (
                                                    <p className="text-xs text-blue-600 mt-1">📋 #{item.purchaseInvoiceId.invoiceNumber}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-xl text-green-600">₹{item.initialBalance}</p>
                                            <p className="text-xs text-gray-500 uppercase tracking-wider">Amount</p>
                                        </div>
                                    </div>
                                    
                                    {/* Card Details */}
                                    <div className="space-y-3 bg-gray-50 rounded-lg p-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-600 font-medium text-sm">🏷️ Card Number</span>
                                            <span className="text-gray-900 font-mono text-sm bg-white px-2 py-1 rounded border">{item.uniqueCode}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-600 font-medium text-sm">👤 Customer</span>
                                            <span className="text-gray-900 font-semibold text-sm">{item.customerId.name}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-600 font-medium text-sm">📞 Phone</span>
                                            <span className="text-gray-900 font-semibold text-sm">{item.customerId.phoneNumber || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-600 font-medium text-sm">👨‍💼 Staff</span>
                                            <span className="text-gray-900 font-semibold text-sm">{item.issuedByStaffId?.name || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-600 font-medium text-sm">⏰ Expires</span>
                                            <span className="text-gray-900 font-semibold text-sm">{formatDate(item.expiryDate)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
                                🎁
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No Gift Cards Sold</h3>
                            <p className="text-gray-500 text-sm">No gift card sales found for the selected period.</p>
                        </div>
                    )}
                </div>

                {/* No Data Message for Desktop */}
                {!isLoading && reportData.length === 0 && (
                    <div className="hidden md:block text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Found</h3>
                        <p className="text-gray-500">No gift card sales found for the selected period.</p>
                    </div>
                )}
            </div>
        </div>
    );
}