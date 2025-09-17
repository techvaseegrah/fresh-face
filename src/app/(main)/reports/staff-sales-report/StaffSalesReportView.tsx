'use client';

import React, { useState, useEffect, useMemo, Fragment, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { format, startOfMonth } from 'date-fns';
import { toast } from 'react-toastify';
import { User, IndianRupee, Wrench, ShoppingCart, Gift, Package, Award, Calendar, Search, FileDown, X, Loader2, Hash } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import { Transition } from '@headlessui/react';
import { hasPermission, PERMISSIONS } from '../../../../lib/permissions';


// --- Type Definitions ---
interface SaleDetail { name: string; quantity: number; price: number; }
interface DailyBreakdown { service: SaleDetail[]; product: SaleDetail[]; giftCard: SaleDetail[]; package: SaleDetail[]; membership: SaleDetail[]; }
export interface StaffSaleRecord {
    staffId: string;
    staffIdNumber: string;
    name: string;
    totalSales: number;
    service: number;
    product: number;
    giftCard: number;
    package: number;
    membership: number;
    billCount: number;
    serviceCount: number;
    productCount: number;
    membershipCount: number;
    totalDiscount: number;
    dailyBreakdown: Record<string, DailyBreakdown>;
}

interface StaffSalesReportViewProps {
    initialData: StaffSaleRecord[];
    initialError?: string;
}

// --- Helper Functions ---
const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// --- Staff Detail Drawer Component ---
const StaffDetailDrawer: React.FC<{ staffData: StaffSaleRecord | null; onClose: () => void; }> = ({ staffData, onClose }) => {
    const sortedDays = useMemo(() => {
        if (!staffData) return [];
        return Object.keys(staffData.dailyBreakdown).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    }, [staffData]);

    const totalGrossSalesForPeriod = (staffData?.totalSales || 0) + (staffData?.totalDiscount || 0);

    return (
        <Transition show={!!staffData} as={Fragment}>
            <div className="fixed inset-0 z-40">
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="absolute inset-0 bg-black/60" onClick={onClose} />
                </Transition.Child>
                <Transition.Child as={Fragment} enter="transform transition ease-in-out duration-300" enterFrom="translate-x-full" enterTo="translate-x-0" leave="transform transition ease-in-out duration-300" leaveFrom="translate-x-0" leaveTo="translate-x-full">
                    <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-xl flex flex-col">
                        <header className="flex items-center justify-between p-4 border-b bg-gray-50">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">{staffData?.name}</h2>
                                <p className="text-sm text-gray-500">Daily Sales Breakdown</p>
                            </div>
                            <Button variant="ghost" className="rounded-full h-9 w-9 p-0" onClick={onClose}><X /></Button>
                        </header>
                        <div className="flex-grow p-6 overflow-y-auto space-y-6 bg-gray-50">
                            {sortedDays.length > 0 ? sortedDays.map(date => {
                                const dayData = staffData!.dailyBreakdown[date];
                                const allSales = [...dayData.service, ...dayData.product, ...dayData.giftCard, ...dayData.package, ...dayData.membership];
                                
                                const dailyGrossSales = allSales.reduce((sum, item) => sum + item.price, 0);
                                
                                const dailyProratedDiscount = totalGrossSalesForPeriod > 0
                                    ? (staffData!.totalDiscount * dailyGrossSales) / totalGrossSalesForPeriod
                                    : 0;
                                
                                const dailyNetSales = dailyGrossSales - dailyProratedDiscount;

                                return (
                                    <div key={date} className="border rounded-lg bg-white shadow-sm overflow-hidden">
                                        <h3 className="font-semibold p-3 bg-gray-100 text-gray-700 border-b">{format(new Date(date), 'EEEE, dd MMM yyyy')}</h3>
                                        <div className="divide-y">
                                            {allSales.map((item, index) => (
                                                <div key={index} className="p-3 flex justify-between items-center text-sm">
                                                    <div>
                                                        <p className="font-medium text-gray-800">{item.name}</p>
                                                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                                                    </div>
                                                    <p className="font-semibold text-gray-900">{formatCurrency(item.price)}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="p-3 bg-gray-50 border-t">
                                            <div className="flex justify-between items-center text-sm mb-1">
                                                <span className="text-gray-600">Subtotal</span>
                                                <span className="font-medium text-gray-800">{formatCurrency(dailyGrossSales)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm text-red-600">
                                                <span className="font-medium">Discount</span>
                                                <span className="font-medium">{formatCurrency(dailyProratedDiscount)}</span>
                                            </div>
                                            <hr className="my-2" />
                                            <div className="flex justify-between items-center font-bold">
                                                <span className="text-gray-800">Total</span>
                                                <span className="text-gray-900">{formatCurrency(dailyNetSales)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : <p className="text-center text-gray-500 p-8">No sales recorded for this staff in the selected period.</p>}
                        </div>
                    </div>
                </Transition.Child>
            </div>
        </Transition>
    );
};

// --- Main View Component ---
export default function StaffSalesReportView({ initialData, initialError }: StaffSalesReportViewProps) {
    const { data: session, status: sessionStatus } = useSession();
    const userPermissions = useMemo(() => session?.user?.role?.permissions || [], [session]);
    const [reportData, setReportData] = useState<StaffSaleRecord[]>(initialData);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(initialError || null);
    const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState<Date>(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStaff, setSelectedStaff] = useState<StaffSaleRecord | null>(null);

    const filteredData = useMemo(() => {
        if (!searchTerm) return reportData;
        return reportData.filter(staff => staff.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [reportData, searchTerm]);

    const fetchReport = useCallback(async () => {
        if (!session?.user?.tenantId) {
            toast.error("Tenant identification failed. Your session may be invalid.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const start = format(startDate, 'yyyy-MM-dd');
            const end = format(endDate, 'yyyy-MM-dd');
            const res = await fetch(`/api/reports/staff-sales-report?startDate=${start}&endDate=${end}`, {
                headers: { 'x-tenant-id': session.user.tenantId }
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ message: 'Failed to fetch new data.' }));
                throw new Error(errorData.message);
            }
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            setReportData(data.data);
            toast.success("Report data refreshed!");
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [session, startDate, endDate]);

    useEffect(() => {
        if (initialError) {
            setError(initialError);
        }
    }, [initialError]);

    const handleExport = (type: 'pdf' | 'excel') => {
        const doc = new jsPDF({ orientation: 'landscape' });
        const tableColumn = [
            "Staff", "Emp. Code", "Bill Count", "Svc. Count", "Prod. Count", "Mem. Count",
            "Service Sales", "Product Sales", "Gift Card Sales", "Package Sales", "Membership Sales",
            "Total Discount", "Total Sales"
        ];
        const tableRows = filteredData.map(item => [
            item.name,
            item.staffIdNumber || 'N/A',
            item.billCount,
            item.serviceCount,
            item.productCount,
            item.membershipCount,
            formatCurrency(item.service),
            formatCurrency(item.product),
            formatCurrency(item.giftCard),
            formatCurrency(item.package),
            formatCurrency(item.membership),
            formatCurrency(item.totalDiscount),
            formatCurrency(item.totalSales)
        ]);

        if (type === 'pdf') {
            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 20,
                headStyles: { fillColor: [22, 160, 133] },
                didDrawPage: (data) => {
                    doc.text("Staff-wise Sales Report", data.settings.margin.left, 15);
                }
            });
            doc.save('staff_sales_report.pdf');
        } else if (type === 'excel') {
            const ws = XLSX.utils.aoa_to_sheet([tableColumn, ...tableRows]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Staff Sales");
            XLSX.writeFile(wb, "staff_sales_report.xlsx");
        }
    };

    if (sessionStatus === 'loading') {
        return <div className="p-6 text-center flex items-center justify-center"><Loader2 className="animate-spin mr-2" />Loading session...</div>;
    }

    if (sessionStatus === 'unauthenticated' || !hasPermission(userPermissions, PERMISSIONS.REPORT_STAFF_SALES_READ)) {
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
        <div className="font-sans">
            <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Staff-wise Sales Report</h1>
                    <p className="text-gray-500 mt-1">Summary of sales attributed to each staff member.</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <input type="date" value={format(startDate, 'yyyy-MM-dd')} onChange={(e) => setStartDate(new Date(e.target.value))} className="p-2 border border-gray-300 rounded-md" />
                    <input type="date" value={format(endDate, 'yyyy-MM-dd')} onChange={(e) => setEndDate(new Date(e.target.value))} className="p-2 border border-gray-300 rounded-md" />
                    <Button onClick={fetchReport} disabled={isLoading}>{isLoading ? 'Loading...' : 'Fetch Report'}</Button>
                </div>
            </header>

            <Card>
                <div className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b">
                    <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Search staff..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-full pr-4 py-2 border rounded-lg"/></div>
                    {hasPermission(userPermissions, PERMISSIONS.REPORT_STAFF_SALES_MANAGE) && (
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} disabled={isLoading || !!error}><FileDown size={16} className="mr-2 text-red-600"/>PDF</Button>
                            <Button variant="outline" size="sm" onClick={() => handleExport('excel')} disabled={isLoading || !!error}><FileDown size={16} className="mr-2 text-green-600"/>Excel</Button>
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50"><tr>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Staff</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Emp. Code</th>
                            <th className="p-4 text-center text-xs font-semibold text-gray-500 uppercase">Bill Count</th>
                            <th className="p-4 text-center text-xs font-semibold text-gray-500 uppercase">Svc. Count</th>
                            <th className="p-4 text-center text-xs font-semibold text-gray-500 uppercase">Prod. Count</th>
                            <th className="p-4 text-center text-xs font-semibold text-gray-500 uppercase">Mem. Count</th>
                            <th className="p-4 text-right text-xs font-semibold text-gray-500 uppercase">Service Sales</th>
                            <th className="p-4 text-right text-xs font-semibold text-gray-500 uppercase">Product Sales</th>
                            <th className="p-4 text-right text-xs font-semibold text-gray-500 uppercase">Gift Card Sales</th>
                            <th className="p-4 text-right text-xs font-semibold text-gray-500 uppercase">Package Sales</th>
                            <th className="p-4 text-right text-xs font-semibold text-gray-500 uppercase">Membership Sales</th>
                            <th className="p-4 text-right text-xs font-semibold text-gray-500 uppercase">Total Discount</th>
                            <th className="p-4 text-right text-xs font-semibold text-gray-500 uppercase">Total Sales</th>
                        </tr></thead>
                        <tbody className="divide-y">
                            {isLoading ? <tr><td colSpan={13} className="text-center p-10">Loading...</td></tr> :
                             error ? <tr><td colSpan={13} className="text-center p-10 text-red-500">{error}</td></tr> :
                             filteredData.map(staff => (
                                <tr key={staff.staffId} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedStaff(staff)}>
                                    {/* --- THIS IS THE FIX --- */}
                                    <td className="p-4 whitespace-nowrap"><div className="font-semibold text-indigo-600">{staff.name}</div></td>
                                    <td className="p-4 whitespace-nowrap text-gray-600">{staff.staffIdNumber}</td>
                                    <td className="p-4 text-center font-medium">{staff.billCount}</td>
                                    <td className="p-4 text-center font-medium text-blue-600">{staff.serviceCount}</td>
                                    <td className="p-4 text-center font-medium text-green-600">{staff.productCount}</td>
                                    <td className="p-4 text-center font-medium text-purple-600">{staff.membershipCount}</td>
                                    <td className="p-4 text-right whitespace-nowrap">{formatCurrency(staff.service)}</td>
                                    <td className="p-4 text-right whitespace-nowrap">{formatCurrency(staff.product)}</td>
                                    <td className="p-4 text-right whitespace-nowrap">{formatCurrency(staff.giftCard)}</td>
                                    <td className="p-4 text-right whitespace-nowrap">{formatCurrency(staff.package)}</td>
                                    <td className="p-4 text-right whitespace-nowrap">{formatCurrency(staff.membership)}</td>
                                    <td className="p-4 text-right whitespace-nowrap text-red-600">{formatCurrency(staff.totalDiscount)}</td>
                                    <td className="p-4 text-right whitespace-nowrap font-bold">{formatCurrency(staff.totalSales)}</td>
                                </tr>
                             ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <StaffDetailDrawer staffData={selectedStaff} onClose={() => setSelectedStaff(null)} />
        </div>
    );
}