// src/app/(main)/staffmanagement/target/TargetView.tsx - PASTE THIS EXACT CODE

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Ensure these types are imported from your actual model file
import type { TargetSheetData, SummaryMetrics } from '@/models/TargetSheet'; 

// Helper functions (no changes needed here)
const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};
const calculatePercentage = (achieved: number = 0, target: number = 0) => {
    if (target === 0) return 0;
    return Math.round((achieved / target) * 100);
};

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
            [name]: value === '' ? 0 : parseInt(value, 10),
        }));
    };

    // --- THIS IS THE MODIFIED PART ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        // THE MOST IMPORTANT LINE: We will log the data right before sending.
        console.log('DATA BEING SENT TO API:', JSON.stringify(formState, null, 2));
        
        try {
            const response = await fetch('/api/target', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formState),
            });

            if (!response.ok) {
                const errorData = await response.json();
                // Show a detailed error message to the user
                throw new Error(errorData.message || `Server responded with status ${response.status}`);
            }

            setIsModalOpen(false);
            router.refresh(); // This re-fetches the data from the server
        } catch (error) {
            // Make the error very visible
            alert(`Error updating targets: ${(error as Error).message}`);
            console.error("SUBMIT FAILED:", error);
        } finally {
            setIsSubmitting(false);
        }
    };
    // --- END OF MODIFIED PART ---


    if (!data) {
        return <div className="p-8 text-center text-red-500">Error: No performance data was provided.</div>;
    }

    const { target = {}, achieved = {}, headingTo = {} } = data.summary || {};

    return (
        <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl">
                        <h3 className="text-2xl font-bold mb-6 text-gray-800">Set Monthly Targets</h3>
                        {/* The form name attributes must exactly match the schema fields */}
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            <div><label className="block text-gray-700 text-sm font-bold mb-2">Service Target</label><input type="number" name="service" value={formState.service || ''} onChange={handleFormChange} className="shadow appearance-none border rounded w-full py-2 px-3" required /></div>
                            <div><label className="block text-gray-700 text-sm font-bold mb-2">Retail Target</label><input type="number" name="retail" value={formState.retail || ''} onChange={handleFormChange} className="shadow appearance-none border rounded w-full py-2 px-3" required /></div>
                            <div><label className="block text-gray-700 text-sm font-bold mb-2">Bills Target</label><input type="number" name="bills" value={formState.bills || ''} onChange={handleFormChange} className="shadow appearance-none border rounded w-full py-2 px-3" required /></div>
                            <div><label className="block text-gray-700 text-sm font-bold mb-2">ABV Target</label><input type="number" name="abv" value={formState.abv || ''} onChange={handleFormChange} className="shadow appearance-none border rounded w-full py-2 px-3" required /></div>
                            <div><label className="block text-gray-700 text-sm font-bold mb-2">Callbacks Target</label><input type="number" name="callbacks" value={formState.callbacks || ''} onChange={handleFormChange} className="shadow appearance-none border rounded w-full py-2 px-3" required /></div>
                            <div><label className="block text-gray-700 text-sm font-bold mb-2">Appointments Target</label><input type="number" name="appointments" value={formState.appointments || ''} onChange={handleFormChange} className="shadow appearance-none border rounded w-full py-2 px-3" required /></div>
                            <div className="md:col-span-2 flex items-center justify-end gap-4 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded" disabled={isSubmitting}>Cancel</button>
                                <button type="submit" className="bg-gray-800 hover:bg-black text-white font-bold py-2 px-4 rounded disabled:bg-gray-400" disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update Monthly Targets'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <div className="flex justify-between items-center mb-6">
                 <h1 className="text-3xl font-bold text-gray-800">Performance Tracker</h1>
                 <button onClick={openModal} className="bg-gray-800 hover:bg-black text-white font-bold py-2 px-4 rounded-lg shadow">Set Monthly Target</button>
            </div>
            {/* The table remains the same */}
            <div className="overflow-x-auto bg-white rounded-lg shadow mb-8">
                <table className="min-w-full text-sm text-left text-gray-600">
                    <thead className="bg-gray-50 text-xs text-gray-700 uppercase"><tr><th className="px-6 py-3">Metric</th><th className="px-6 py-3">Target</th><th className="px-6 py-3">Achieved</th><th className="px-6 py-3">Heading To</th><th className="px-6 py-3">Achieved %</th></tr></thead>
                    <tbody>
                        <tr className="border-b"><td className="px-6 py-4 font-medium">SERVICE</td><td className="px-6 py-4">{formatCurrency(target?.service)}</td><td className="px-6 py-4">{formatCurrency(achieved?.service)}</td><td className="px-6 py-4">{formatCurrency(headingTo?.service)}</td><td className="px-6 py-4 font-bold">{calculatePercentage(achieved?.service, target?.service)}%</td></tr>
                        <tr className="border-b"><td className="px-6 py-4 font-medium">RETAIL</td><td className="px-6 py-4">{formatCurrency(target?.retail)}</td><td className="px-6 py-4">{formatCurrency(achieved?.retail)}</td><td className="px-6 py-4">{formatCurrency(headingTo?.retail)}</td><td className="px-6 py-4 font-bold">{calculatePercentage(achieved?.retail, target?.retail)}%</td></tr>
                        <tr className="border-b"><td className="px-6 py-4 font-medium">NET SALES</td><td className="px-6 py-4">{formatCurrency(target?.netSales)}</td><td className="px-6 py-4">{formatCurrency(achieved?.netSales)}</td><td className="px-6 py-4">{formatCurrency(headingTo?.netSales)}</td><td className="px-6 py-4 font-bold">{calculatePercentage(achieved?.netSales, target?.netSales)}%</td></tr>
                        <tr className="border-b"><td className="px-6 py-4 font-medium">BILLS</td><td className="px-6 py-4">{target?.bills || 0}</td><td className="px-6 py-4">{achieved?.bills || 0}</td><td className="px-6 py-4">{Math.round(headingTo?.bills || 0)}</td><td className="px-6 py-4 font-bold">{calculatePercentage(achieved?.bills, target?.bills)}%</td></tr>
                        <tr className="border-b"><td className="px-6 py-4 font-medium">ABV</td><td className="px-6 py-4">{formatCurrency(target?.abv)}</td><td className="px-6 py-4">{formatCurrency(achieved?.abv)}</td><td className="px-6 py-4">{formatCurrency(headingTo?.abv)}</td><td className="px-6 py-4 font-bold">{calculatePercentage(achieved?.abv, target?.abv)}%</td></tr>
                        <tr className="border-b"><td className="px-6 py-4 font-medium">CALLBACKS</td><td className="px-6 py-4">{target?.callbacks || 0}</td><td className="px-6 py-4">{achieved?.callbacks || 0}</td><td className="px-6 py-4">{Math.round(headingTo?.callbacks || 0)}</td><td className="px-6 py-4 font-bold">{calculatePercentage(achieved?.callbacks, target?.callbacks)}%</td></tr>
                        <tr>
                            <td className="px-6 py-4 font-medium">APPOINTMENTS</td>
                            <td className="px-6 py-4">{target?.appointments || 0}</td> 
                            <td className="px-6 py-4">{achieved?.appointments || 0}</td>
                            <td className="px-6 py-4">{Math.round(headingTo?.appointments || 0)}</td>
                            <td className="px-6 py-4 font-bold">{calculatePercentage(achieved?.appointments, target?.appointments)}%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}