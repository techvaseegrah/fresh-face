'use client';

import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    IndianRupee, ShoppingCart, Receipt, Wrench,
    Calculator, PhoneCall, CalendarCheck, TrendingUp,
    FileSpreadsheet, FileText, Filter,
} from 'lucide-react';
import type { TargetSheetData } from '@/models/TargetSheet';
import { useSession } from 'next-auth/react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';

// --- HELPER FUNCTIONS ---
const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '₹0.00';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};
const formatNumberForExport = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '0.00';
    return new Intl.NumberFormat('en-IN', { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};
const calculatePercentage = (achieved: number = 0, target: number = 0) => {
    if (target === 0) return 0;
    return Math.round((achieved / target) * 100);
};

// --- HELPER COMPONENTS ---
const ProgressBar = ({ value }: { value: number }) => {
    const safeValue = Math.max(0, Math.min(100, value));
    const colorClass = safeValue < 50 ? 'bg-red-500' : safeValue < 85 ? 'bg-yellow-500' : 'bg-green-500';
    return <div className="w-full bg-gray-200 rounded-full h-2.5"><div className={`${colorClass} h-2.5 rounded-full`} style={{ width: `${safeValue}%` }} ></div></div>;
};
const MetricCard = ({ title, achieved, target, isCurrency = true, icon }: { title: string; achieved: number; target: number; isCurrency?: boolean; icon: React.ReactNode; }) => {
    const percentage = calculatePercentage(achieved, target);
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-start"><h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</h3><div className="bg-slate-100 p-2 rounded-lg">{icon}</div></div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{isCurrency ? formatCurrency(achieved) : achieved.toLocaleString('en-IN')}</p>
            <p className="text-sm text-gray-500 mt-1">Target: {isCurrency ? formatCurrency(target) : target.toLocaleString('en-IN')}</p>
            <div className="mt-4"><div className="flex justify-between mb-1"><span className="text-sm font-medium text-gray-600">Progress</span><span className="text-sm font-bold text-gray-800">{percentage}%</span></div><ProgressBar value={percentage} /></div>
        </div>
    );
};

// --- MAIN REPORT COMPONENT ---
export default function TargetReportPage() {
    const { data: session, status } = useSession();
    const [data, setData] = useState<TargetSheetData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
    });

    const fetchData = async (start: Date, end: Date) => {
        setIsLoading(true);
        const startDate = start.toISOString().split('T')[0];
        const endDate = end.toISOString().split('T')[0];
        try {
            const res = await fetch(`/api/target?startDate=${startDate}&endDate=${endDate}`);
            if (!res.ok) throw new Error('Failed to fetch data');
            const newData = await res.json();
            setData(newData);
        } catch (error) {
            alert((error as Error).message);
            setData(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'authenticated') {
            fetchData(dateRange.start, dateRange.end);
        }
    }, [status]);
    
    const handleFilterData = () => {
        fetchData(dateRange.start, dateRange.end);
    };

    const { target = {}, achieved = {}, headingTo = {} } = data?.summary || {};
    const mainMetrics = [
        { title: 'Net Sales', achieved: achieved.netSales, target: target.netSales, icon: <TrendingUp className="text-green-500" size={24} /> },
        { title: 'Service', achieved: achieved.service, target: target.service, icon: <Wrench className="text-blue-500" size={24} /> },
        { title: 'Retail', achieved: achieved.retail, target: target.retail, icon: <ShoppingCart className="text-purple-500" size={24} /> },
        { title: 'Bills', achieved: achieved.bills, target: target.bills, isCurrency: false, icon: <Receipt className="text-orange-500" size={24} /> },
    ];
    const detailedMetrics = [
        { name: 'SERVICE', t: target.service, a: achieved.service, h: headingTo.service, isCurrency: true, icon: <Wrench size={20} className="text-blue-500" /> },
        { name: 'RETAIL', t: target.retail, a: achieved.retail, h: headingTo.retail, isCurrency: true, icon: <ShoppingCart size={20} className="text-purple-500" /> },
        { name: 'NET SALES', t: target.netSales, a: achieved.netSales, h: headingTo.netSales, isCurrency: true, icon: <IndianRupee size={20} className="text-green-600" /> },
        { name: 'BILLS', t: target.bills, a: achieved.bills, h: headingTo.bills, icon: <Receipt size={20} className="text-orange-500" /> },
        { name: 'ABV', t: target.abv, a: achieved.abv, h: headingTo.abv, isCurrency: true, icon: <Calculator size={20} className="text-indigo-500" /> },
        { name: 'CALLBACKS', t: target.callbacks, a: achieved.callbacks, h: headingTo.callbacks, icon: <PhoneCall size={20} className="text-teal-500" /> },
        { name: 'APPOINTMENTS', t: target.appointments, a: achieved.appointments, h: headingTo.appointments, icon: <CalendarCheck size={20} className="text-pink-500" /> },
    ];

    // --- THIS IS THE FIX: Restored full download logic ---
    const getExportFileName = () => {
        const startStr = dateRange.start.toLocaleDateString('en-CA'); // YYYY-MM-DD
        const endStr = dateRange.end.toLocaleDateString('en-CA');
        return `Shop_Target_Report_${startStr}_to_${endStr}`;
    };

    const handleExportExcel = () => {
        const detailedDataForExcel = detailedMetrics.map(m => ({
            'Metric': m.name,
            'Target': formatNumberForExport(m.t),
            'Achieved': formatNumberForExport(m.a),
            'Projected': formatNumberForExport(m.h),
            'Achievement %': calculatePercentage(m.a, m.t)
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(detailedDataForExcel);
        XLSX.utils.book_append_sheet(wb, ws, "Performance Report");
        XLSX.writeFile(wb, `${getExportFileName()}.xlsx`);
    };

    const handleExportPdf = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text('Shop Target Performance Report', 14, 22);
        autoTable(doc, {
            startY: 35,
            head: [['Metric', 'Target', 'Achieved', 'Projected', 'Achievement %']],
            body: detailedMetrics.map(m => [
                m.name,
                (m.isCurrency ? formatCurrency(m.t) : (m.t || 0).toLocaleString('en-IN')),
                (m.isCurrency ? formatCurrency(m.a) : (m.a || 0).toLocaleString('en-IN')),
                (m.isCurrency ? formatCurrency(m.h) : (m.h || 0).toLocaleString('en-IN')),
                `${calculatePercentage(m.a, m.t)}%`
            ]),
        });
        doc.save(`${getExportFileName()}.pdf`);
    };

    if (status === 'loading' || (isLoading && !data)) {
        return <div className="p-8 text-center">Loading Target Report...</div>;
    }
    if (!data) {
        return <div className="p-8 text-center text-red-500">Failed to load target data. Please try again.</div>;
    }

    return (
        <div className="font-sans">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Shop Target Report</h1>
                    <p className="text-gray-500 mt-1">{`Data for: ${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`}</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span className="text-sm font-medium text-gray-600">From:</span>
                    <input type="date" value={dateRange.start.toISOString().split('T')[0]} onChange={(e) => setDateRange(p => ({...p, start: new Date(e.target.value)}))} className="p-2 border border-gray-300 rounded-md shadow-sm text-sm"/>
                    <span className="text-sm font-medium text-gray-600">To:</span>
                    <input type="date" value={dateRange.end.toISOString().split('T')[0]} onChange={(e) => setDateRange(p => ({...p, end: new Date(e.target.value)}))} className="p-2 border border-gray-300 rounded-md shadow-sm text-sm"/>
                    <Button onClick={handleFilterData} className="bg-purple-600 hover:bg-purple-700 text-white" disabled={isLoading}><Filter size={16} className="mr-2"/>{isLoading ? 'Fetching...' : 'Fetch Report'}</Button>
                </div>
            </div>

            <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {mainMetrics.map(m => <MetricCard key={m.title} title={m.title} achieved={m.achieved ?? 0} target={m.target ?? 0} isCurrency={!m.isCurrency === false} icon={m.icon} />)}
                </div>
                
                <div className="bg-white rounded-xl overflow-hidden">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-6 border-b">
                        <h3 className="text-xl font-bold text-gray-800">Detailed Metrics</h3>
                        <div className="flex items-center gap-2">
                             <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={isLoading}><FileSpreadsheet size={16} className="text-green-600 mr-2"/>Excel</Button>
                             <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={isLoading}><FileText size={16} className="text-red-600 mr-2"/>PDF</Button>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto hidden md:block">
                        <table className="min-w-full text-sm text-left text-gray-600">
                            <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
                                <tr>
                                    <th className="px-6 py-3 font-semibold">Metric</th><th className="px-6 py-3 font-semibold">Target</th>
                                    <th className="px-6 py-3 font-semibold">Achieved</th><th className="px-6 py-3 font-semibold">Projected</th>
                                    <th className="px-6 py-3 font-semibold w-[20%]">Achievement</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {detailedMetrics.map(({ name, t, a, h, isCurrency, icon }) => (
                                    <tr key={name} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900"><div className="flex items-center gap-3">{icon}<span>{name}</span></div></td>
                                        <td className="px-6 py-4">{isCurrency ? formatCurrency(t) : (t || 0).toLocaleString('en-IN')}</td>
                                        <td className="px-6 py-4">{isCurrency ? formatCurrency(a) : (a || 0).toLocaleString('en-IN')}</td>
                                        <td className="px-6 py-4">{isCurrency ? formatCurrency(h) : (h || 0).toLocaleString('en-IN')}</td>
                                        <td className="px-6 py-4"><div className="flex items-center gap-4"><div className="w-full"><ProgressBar value={calculatePercentage(a, t)} /></div><span className="font-bold w-12 text-right">{calculatePercentage(a, t)}%</span></div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Mobile View */}
                    <div className="md:hidden divide-y divide-gray-200">
                        {detailedMetrics.map(({ name, t, a, h, isCurrency, icon }) => (
                           <div key={name} className="p-4">
                               <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-3">{icon}<h4 className="font-bold text-gray-800 text-base">{name}</h4></div><span className="font-bold text-lg">{calculatePercentage(a,t)}%</span></div>
                               <div className="mb-3"><ProgressBar value={calculatePercentage(a,t)} /></div>
                               <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                   <div><p className="text-gray-500 uppercase font-semibold">Target</p><p className="font-bold text-gray-800 text-sm mt-1">{isCurrency ? formatCurrency(t) : (t || 0).toLocaleString('en-IN')}</p></div>
                                   <div><p className="text-gray-500 uppercase font-semibold">Achieved</p><p className="font-bold text-gray-800 text-sm mt-1">{isCurrency ? formatCurrency(a) : (a || 0).toLocaleString('en-IN')}</p></div>
                                   <div><p className="text-gray-500 uppercase font-semibold">Projected</p><p className="font-bold text-gray-800 text-sm mt-1">{isCurrency ? formatCurrency(h) : (h || 0).toLocaleString('en-IN')}</p></div>
                               </div>
                           </div>
                        ))}
                    </div>
                </div>
            </Card>
        </div>
    );
}