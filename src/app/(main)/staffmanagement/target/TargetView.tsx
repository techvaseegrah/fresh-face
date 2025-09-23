// TargetView.tsx

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    Target, X, IndianRupee, ShoppingCart, Receipt, Wrench,
    Calculator, PhoneCall, CalendarCheck, TrendingUp,
    FileSpreadsheet, FileText, Filter,
} from 'lucide-react';
import type { TargetSheetData, SummaryMetrics } from '@/models/TargetSheet';
import { useSession } from 'next-auth/react';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

// --- HELPER FUNCTIONS (Unchanged section) ---
const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

const formatNumberForExport = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '0.00';
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false,
    }).format(value);
};

const calculatePercentage = (achieved: number = 0, target: number = 0) => {
    if (target === 0) return 0;
    return Math.round((achieved / target) * 100);
};

// --- NEW HELPER FUNCTION TO FIX DATE ISSUE ---
/**
 * Formats a Date object into a 'YYYY-MM-DD' string based on local time,
 * avoiding timezone shifts from toISOString().
 */
const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};


// --- HELPER COMPONENTS (Unchanged) ---
interface ProgressBarProps { value: number; }
const ProgressBar = ({ value }: ProgressBarProps) => {
    const safeValue = Math.max(0, Math.min(100, value));
    const colorClass = safeValue < 50 ? 'bg-red-500' : safeValue < 85 ? 'bg-yellow-500' : 'bg-green-500';
    return (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className={`${colorClass} h-2.5 rounded-full transition-all duration-500 ease-out`} style={{ width: `${safeValue}%` }} ></div>
        </div>
    );
};
interface MetricCardProps {
    title: string;
    achieved: number;
    target: number;
    isCurrency?: boolean;
    icon: React.ReactNode;
}
const MetricCard = ({ title, achieved, target, isCurrency = true, icon }: MetricCardProps) => {
    const percentage = calculatePercentage(achieved, target);
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-start">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</h3>
                <div className="bg-slate-100 p-2 rounded-lg">{icon}</div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{isCurrency ? formatCurrency(achieved) : achieved.toLocaleString('en-IN')}</p>
            <p className="text-sm text-gray-500 mt-1">Target: {isCurrency ? formatCurrency(target) : target.toLocaleString('en-IN')}</p>
            <div className="mt-4">
                <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-600">Progress</span>
                    <span className="text-sm font-bold text-gray-800">{percentage}%</span>
                </div>
                <ProgressBar value={percentage} />
            </div>
        </div>
    );
};


// --- MAIN VIEW COMPONENT ---
interface TargetViewProps { initialData: TargetSheetData | null; }
export default function TargetView({ initialData }: TargetViewProps) {
    const { data: session } = useSession();
    const userPermissions = useMemo(() => session?.user?.role?.permissions || [], [session]);
    const canManageTarget = useMemo(() => hasPermission(userPermissions, PERMISSIONS.STAFF_TARGET_MANAGE), [userPermissions]);

    const router = useRouter();
    const [data, setData] = useState<TargetSheetData | null>(initialData);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formState, setFormState] = useState<Partial<SummaryMetrics>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // This initialization is correct, the problem was in formatting the output.
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
    });

    useEffect(() => { setData(initialData); }, [initialData]);

    const openModal = () => {
        const currentTargets = data?.summary?.target ?? {};
        setFormState(currentTargets);
        setIsModalOpen(true);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value === '' ? undefined : parseFloat(value) }));
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        // new Date() correctly parses 'YYYY-MM-DD' in the local timezone
        setDateRange(prev => ({ ...prev, [name]: new Date(value) }));
    };

    const handleFilterData = async () => {
        setIsLoading(true);
        // --- MODIFIED --- Use the new helper to prevent timezone issues
        const startDate = formatDateForInput(dateRange.start);
        const endDate = formatDateForInput(dateRange.end);

        try {
            const res = await fetch(`/api/target?startDate=${startDate}&endDate=${endDate}`);
            if (!res.ok) {
                throw new Error('Failed to fetch data for the selected range.');
            }
            const newData = await res.json();
            setData(newData);
        } catch (error) {
            alert((error as Error).message);
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/target', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formState)
            });

            if (!response.ok) {
                let serverError = 'An unknown error occurred.';
                try {
                    const errorData = await response.json();
                    serverError = errorData.error || errorData.message || 'Failed to update targets.';
                } catch (jsonError) {
                    console.error("Could not parse error JSON:", jsonError);
                }
                throw new Error(serverError);
            }

            setIsModalOpen(false);
            router.refresh();
        } catch (error) {
            alert(`Error updating targets: ${(error as Error).message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!data) {
        return <div className="p-8 text-center text-red-500">Error: No performance data was provided.</div>;
    }

    const { target = {}, achieved = {}, headingTo = {} } = data.summary || {};

    // --- Unchanged JSX from here downwards, except for the date input values ---

    const mainMetrics = [
        { title: 'Net Sales', achieved: achieved.netSales, target: target.netSales, isCurrency: true, icon: <TrendingUp className="text-green-500" size={24} /> },
        { title: 'Service', achieved: achieved.service, target: target.service, isCurrency: true, icon: <Wrench className="text-blue-500" size={24} /> },
        { title: 'Retail', achieved: achieved.retail, target: target.retail, isCurrency: true, icon: <ShoppingCart className="text-purple-500" size={24} /> },
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

    const getExportFileName = () => {
        const startStr = dateRange.start.toLocaleDateString('en-CA');
        const endStr = dateRange.end.toLocaleDateString('en-CA');
        const now = new Date();
        const isCurrentMonth = dateRange.start.getMonth() === now.getMonth() && dateRange.start.getFullYear() === now.getFullYear();
        if (isCurrentMonth && !isLoading) {
             const monthName = now.toLocaleString('default', { month: 'long' });
             const year = now.getFullYear();
             return `Shop_Target_Report_${monthName}_${year}`;
        }
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
                formatNumberForExport(m.t),
                formatNumberForExport(m.a),
                formatNumberForExport(m.h),
                `${calculatePercentage(m.a, m.t)}%`
            ]),
        });
        doc.save(`${getExportFileName()}.pdf`);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen font-sans">
            {isModalOpen && (
                 <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl relative">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" disabled={isSubmitting}><X size={24} /></button>
                        <h3 className="text-2xl font-bold mb-6 text-gray-800">Set Monthly Targets</h3>
                        <p className="text-sm text-gray-500 mb-6 -mt-4">Targets are for the current calendar month.</p>
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                            {(['service', 'retail', 'bills', 'abv', 'callbacks', 'appointments'] as const).map(fieldName => (
                                <div key={fieldName}>
                                    <label htmlFor={fieldName} className="block text-gray-600 text-sm font-bold mb-2 capitalize">{fieldName} Target</label>
                                    <input type="number" step="any" id={fieldName} name={fieldName} value={formState[fieldName] || ''} onChange={handleFormChange} className="bg-gray-100 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" required />
                                </div>
                            ))}
                            <div className="md:col-span-2 flex items-center justify-end gap-4 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg" disabled={isSubmitting}>Cancel</button>
                                <button type="submit" className="bg-gray-800 hover:bg-black text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400" disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update Targets'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                 <div>
                    <h1 className="text-3xl font-bold text-gray-800">Shop Targets Dashboard</h1>
                    <p className="text-gray-500 mt-1">{`Showing data for: ${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`}</p>
                 </div>

                 <div className="flex flex-wrap items-center justify-end gap-2">
                    <input 
                        type="date" 
                        name="start" 
                        // --- MODIFIED --- Use the helper function to prevent timezone issues
                        value={formatDateForInput(dateRange.start)} 
                        onChange={handleDateChange} 
                        className="bg-white p-2 border border-gray-300 rounded-lg text-sm h-10"
                    />
                    <input 
                        type="date" 
                        name="end" 
                        // --- MODIFIED --- Use the helper function to prevent timezone issues
                        value={formatDateForInput(dateRange.end)} 
                        onChange={handleDateChange} 
                        className="bg-white p-2 border border-gray-300 rounded-lg text-sm h-10"
                    />
                    <button 
                        onClick={handleFilterData} 
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow h-10 disabled:bg-gray-400" 
                        disabled={isLoading}
                    >
                        <Filter size={18} />
                        <span>{isLoading ? '...' : 'Filter'}</span>
                    </button>
                    <button onClick={handleExportExcel} className="flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-sm h-10">
                        <FileSpreadsheet size={18} className="text-green-600" />
                        Excel
                    </button>
                    <button onClick={handleExportPdf} className="flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-sm h-10">
                        <FileText size={18} className="text-red-600" />
                        PDF
                    </button>
                    {canManageTarget && (
                        <button onClick={openModal} className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-black text-white font-bold py-2 px-4 rounded-lg shadow h-10">
                            <Target size={18} />
                            Set Target
                        </button>
                    )}
                 </div>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {mainMetrics.map(metric => (<MetricCard key={metric.title} title={metric.title} achieved={metric.achieved ?? 0} target={metric.target ?? 0} isCurrency={metric.isCurrency} icon={metric.icon} />))}
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <h3 className="text-xl font-bold text-gray-800 p-6">Detailed Metrics</h3>
                <div className="overflow-x-auto hidden md:block">
                    <table className="min-w-full text-sm text-left text-gray-600">
                        <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
                            <tr>
                                <th className="px-6 py-3 font-semibold">Metric</th>
                                <th className="px-6 py-3 font-semibold">Target</th>
                                <th className="px-6 py-3 font-semibold">Achieved</th>
                                <th className="px-6 py-3 font-semibold">Projected (Heading To)</th>
                                <th className="px-6 py-3 font-semibold w-[20%]">Achievement</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {detailedMetrics.map(({ name, t, a, h, isCurrency, icon }) => (
                                <tr key={name} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap"><div className="flex items-center gap-3">{icon}<span>{name}</span></div></td>
                                    <td className="px-6 py-4">{isCurrency ? formatCurrency(t) : (t || 0).toLocaleString('en-IN')}</td>
                                    <td className="px-6 py-4">{isCurrency ? formatCurrency(a) : (a || 0).toLocaleString('en-IN')}</td>
                                    <td className="px-6 py-4">{isCurrency ? formatCurrency(h) : (h || 0).toLocaleString('en-IN')}</td>
                                    <td className="px-6 py-4"><div className="flex items-center gap-4"><div className="w-full"><ProgressBar value={calculatePercentage(a, t)} /></div><span className="font-bold w-12 text-right">{calculatePercentage(a, t)}%</span></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="md:hidden divide-y divide-gray-200">
                    {detailedMetrics.map(({ name, t, a, h, isCurrency, icon }) => {
                       const percentage = calculatePercentage(a,t);
                       return (
                        <div key={name} className="p-4">
                            <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-3">{icon}<h4 className="font-bold text-gray-800 text-base">{name}</h4></div><span className="font-bold text-lg">{percentage}%</span></div>
                            <div className="mb-3"><ProgressBar value={percentage} /></div>
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                <div><p className="text-gray-500 uppercase font-semibold">Target</p><p className="font-bold text-gray-800 text-sm mt-1">{isCurrency ? formatCurrency(t) : (t || 0).toLocaleString('en-IN')}</p></div>
                                <div><p className="text-gray-500 uppercase font-semibold">Achieved</p><p className="font-bold text-gray-800 text-sm mt-1">{isCurrency ? formatCurrency(a) : (a || 0).toLocaleString('en-IN')}</p></div>
                                <div><p className="text-gray-500 uppercase font-semibold">Projected</p><p className="font-bold text-gray-800 text-sm mt-1">{isCurrency ? formatCurrency(h) : (h || 0).toLocaleString('en-IN')}</p></div>
                            </div>
                        </div>
                       )}
                    )}
                </div>
            </div>
        </div>
    );
}