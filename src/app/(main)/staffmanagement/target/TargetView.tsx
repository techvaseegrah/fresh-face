'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// --- ICONS ---
import {
    Target,
    X,
    IndianRupee, 
    ShoppingCart, 
    Receipt, 
    Wrench, 
    Calculator, 
    PhoneCall, 
    CalendarCheck, 
    TrendingUp, // --- ADDED --- For the Net Sales KPI card
} from 'lucide-react';
// Ensure these types are imported from your actual model file
import type { TargetSheetData, SummaryMetrics } from '@/models/TargetSheet'; 

// --- HELPER COMPONENTS (for a cleaner UI structure) ---

// ProgressBar Component (Unchanged)
interface ProgressBarProps {
  value: number; // Percentage value from 0 to 100
}
const ProgressBar = ({ value }: ProgressBarProps) => {
    const safeValue = Math.max(0, Math.min(100, value)); // Clamp value between 0 and 100
    const colorClass = safeValue < 50 ? 'bg-red-500' : safeValue < 85 ? 'bg-yellow-500' : 'bg-green-500';
    
    return (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
                className={`${colorClass} h-2.5 rounded-full transition-all duration-500 ease-out`} 
                style={{ width: `${safeValue}%` }}
            ></div>
        </div>
    );
};

// --- MODIFIED ---: MetricCard component now accepts and displays an icon.
// Metric Card Component
interface MetricCardProps {
    title: string;
    achieved: number;
    target: number;
    isCurrency?: boolean;
    icon: React.ReactNode; // --- ADDED ---: Prop to receive the icon component
}
const MetricCard = ({ title, achieved, target, isCurrency = true, icon }: MetricCardProps) => {
    const percentage = calculatePercentage(achieved, target);
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            {/* --- MODIFIED ---: Layout to include the icon */}
            <div className="flex justify-between items-start">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</h3>
                <div className="bg-slate-100 p-2 rounded-lg">
                   {icon}
                </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">
                {isCurrency ? formatCurrency(achieved) : achieved.toLocaleString('en-IN')}
            </p>
            <p className="text-sm text-gray-500 mt-1">
                Target: {isCurrency ? formatCurrency(target) : target.toLocaleString('en-IN')}
            </p>
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


// Helper functions (Unchanged)
const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};
const calculatePercentage = (achieved: number = 0, target: number = 0) => {
    if (target === 0) return 0;
    return Math.round((achieved / target) * 100);
};

// --- MAIN VIEW COMPONENT ---

interface TargetViewProps {
    initialData: TargetSheetData | null;
}

export default function TargetView({ initialData }: TargetViewProps) {
    const router = useRouter();
    const [data, setData] = useState<TargetSheetData | null>(initialData);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formState, setFormState] = useState<Partial<SummaryMetrics>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    const openModal = () => {
        const currentTargets = initialData?.summary?.target ?? {};
        setFormState(currentTargets);
        setIsModalOpen(true);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({
            ...prev,
            [name]: value === '' ? undefined : parseInt(value, 10),
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        console.log('DATA BEING SENT TO API:', JSON.stringify(formState, null, 2));
        
        try {
            const response = await fetch('/api/target', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formState),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Server responded with status ${response.status}`);
            }

            setIsModalOpen(false);
            router.refresh(); 
        } catch (error) {
            alert(`Error updating targets: ${(error as Error).message}`);
            console.error("SUBMIT FAILED:", error);
        } finally {
            setIsSubmitting(false);
        }
    };


    if (!data) {
        return <div className="p-8 text-center text-red-500">Error: No performance data was provided.</div>;
    }

    const { target = {}, achieved = {}, headingTo = {} } = data.summary || {};

    // --- MODIFIED ---: mainMetrics now includes an icon for each card.
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


    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen font-sans">
            {/* --- MODAL (Unchanged) --- */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4 transition-opacity animate-in fade-in-0">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl relative transform transition-all animate-in zoom-in-95">
                        <button 
                            onClick={() => setIsModalOpen(false)} 
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                            disabled={isSubmitting}
                        >
                            <X size={24} />
                        </button>
                        <h3 className="text-2xl font-bold mb-6 text-gray-800">Set Monthly Targets</h3>
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                            {(['service', 'retail', 'bills', 'abv', 'callbacks', 'appointments'] as const).map(fieldName => (
                                <div key={fieldName}>
                                    <label htmlFor={fieldName} className="block text-gray-600 text-sm font-bold mb-2 capitalize">{fieldName} Target</label>
                                    <input 
                                        type="number" 
                                        id={fieldName}
                                        name={fieldName} 
                                        value={formState[fieldName] || ''} 
                                        onChange={handleFormChange} 
                                        className="bg-gray-100 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" 
                                        required 
                                    />
                                </div>
                            ))}
                            <div className="md:col-span-2 flex items-center justify-end gap-4 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg" disabled={isSubmitting}>Cancel</button>
                                <button type="submit" className="bg-gray-800 hover:bg-black text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400" disabled={isSubmitting}>
                                    {isSubmitting ? 'Updating...' : 'Update Targets'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* --- HEADER (Unchanged) --- */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
                 <div>
                    <h1 className="text-3xl font-bold text-gray-800">Performance Dashboard</h1>
                    <p className="text-gray-500 mt-1">Monthly performance summary and targets.</p>
                 </div>
                 <button 
                    onClick={openModal} 
                    className="flex items-center gap-2 mt-4 sm:mt-0 bg-gray-800 hover:bg-black text-white font-bold py-2 px-4 rounded-lg shadow hover:shadow-md transition-all w-full sm:w-auto"
                >
                    <Target size={18} />
                    Set Monthly Target
                </button>
            </header>

            {/* --- KPI CARDS --- */}
            {/* --- MODIFIED ---: The 'icon' prop is now passed to MetricCard. */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {mainMetrics.map(metric => (
                    <MetricCard 
                        key={metric.title}
                        title={metric.title}
                        achieved={metric.achieved ?? 0}
                        target={metric.target ?? 0}
                        isCurrency={metric.isCurrency}
                        icon={metric.icon}
                    />
                ))}
            </div>

            {/* --- DETAILED TABLE (Unchanged from previous version) --- */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <h3 className="text-xl font-bold text-gray-800 p-6">Detailed Metrics</h3>
                
                {/* Desktop Table (Visible on medium screens and up) */}
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
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            {icon}
                                            <span>{name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{isCurrency ? formatCurrency(t) : (t || 0)}</td>
                                    <td className="px-6 py-4">{isCurrency ? formatCurrency(a) : (a || 0)}</td>
                                    <td className="px-6 py-4">{isCurrency ? formatCurrency(h) : Math.round(h || 0)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-full">
                                                <ProgressBar value={calculatePercentage(a, t)} />
                                            </div>
                                            <span className="font-bold w-12 text-right">{calculatePercentage(a, t)}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View (Visible on small screens) */}
                <div className="md:hidden divide-y divide-gray-200">
                    {detailedMetrics.map(({ name, t, a, h, isCurrency, icon }) => {
                       const percentage = calculatePercentage(a,t);
                       return (
                        <div key={name} className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    {icon}
                                    <h4 className="font-bold text-gray-800 text-base">{name}</h4>
                                </div>
                                <span className="font-bold text-lg">{percentage}%</span>
                            </div>
                            
                            <div className="mb-3">
                               <ProgressBar value={percentage} />
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                <div>
                                    <p className="text-gray-500 uppercase font-semibold">Target</p>
                                    <p className="font-bold text-gray-800 text-sm mt-1">{isCurrency ? formatCurrency(t) : (t || 0)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 uppercase font-semibold">Achieved</p>
                                    <p className="font-bold text-gray-800 text-sm mt-1">{isCurrency ? formatCurrency(a) : (a || 0)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 uppercase font-semibold">Projected</p>
                                    <p className="font-bold text-gray-800 text-sm mt-1">{isCurrency ? formatCurrency(h) : Math.round(h || 0)}</p>
                                </div>
                            </div>
                        </div>
                       )}
                    )}
                </div>
            </div>
        </div>
    );
}