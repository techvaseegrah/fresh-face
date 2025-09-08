'use client';

import React, { useState, useEffect, FormEvent, useCallback, useMemo } from 'react';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
// TENANT-AWARE: Import useSession to get the tenant ID
import { useSession } from 'next-auth/react';

// --- Types ---
interface IPositionRateSetting {
    positionName: string;
    otRate: number;
    extraDayRate: number;
}
interface AttendanceSettings {
    defaultDailyHours: number;
    positionRates: IPositionRateSetting[];
}

// --- Reusable UI Components (Unchanged) ---
const Button = ({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
        className={`inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        {...props}
    >
        {children}
    </button>
);

const InputField = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
        {...props}
        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black text-gray-900 disabled:bg-gray-100"
    />
);

// --- MODAL for Adding/Editing Position Rates (Mobile Responsive) ---
const PositionRateModal = ({
    isOpen,
    onClose,
    onSave,
    positions,
    existingRates,
    editingRate,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (rate: IPositionRateSetting) => void;
    positions: string[];
    existingRates: IPositionRateSetting[];
    editingRate: IPositionRateSetting | null;
}) => {
    const [rateData, setRateData] = useState<{
        positionName: string;
        otRate: string;
        extraDayRate: string;
    }>({ positionName: '', otRate: '', extraDayRate: '' });

    useEffect(() => {
        if (!isOpen) return;
        if (editingRate) {
            setRateData({
                positionName: editingRate.positionName,
                otRate: String(editingRate.otRate),
                extraDayRate: String(editingRate.extraDayRate),
            });
        } else {
            const availablePosition = positions.find(p => !existingRates.some(r => r.positionName === p));
            setRateData({ positionName: availablePosition || '', otRate: '', extraDayRate: '' });
        }
    }, [isOpen, editingRate, positions, existingRates]);

    if (!isOpen) return null;

    const handleSave = (e: FormEvent) => {
        e.preventDefault();
        onSave({
            positionName: rateData.positionName,
            otRate: Number(rateData.otRate) || 0,
            extraDayRate: Number(rateData.extraDayRate) || 0,
        });
    };

    const availablePositions = positions.filter(p =>
        !existingRates.some(r => r.positionName === p) || p === editingRate?.positionName
    );

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col mx-4" onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleSave} className="flex flex-col h-full">
                    <div className="p-4 md:p-6 flex-1 overflow-y-auto">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">{editingRate ? 'Edit' : 'Add'} Position Rate</h3>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="positionName" className="block text-sm font-semibold text-gray-700 mb-2">Position</label>
                                <select 
                                    id="positionName" 
                                    value={rateData.positionName} 
                                    onChange={(e) => setRateData({ ...rateData, positionName: e.target.value })} 
                                    className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none text-gray-900 text-base" 
                                    disabled={!!editingRate}
                                >
                                    <option value="">Select a position</option>
                                    {availablePositions.map(p => <option key={p} value={p}>{p}</option>)}
                                    {editingRate && !availablePositions.includes(editingRate.positionName) && <option value={editingRate.positionName}>{editingRate.positionName}</option>}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="modalOtRate" className="block text-sm font-semibold text-gray-700 mb-2">OT Rate per Hour (₹)</label>
                                <input 
                                    type="number" 
                                    id="modalOtRate" 
                                    value={rateData.otRate} 
                                    onChange={(e) => setRateData({ ...rateData, otRate: e.target.value })} 
                                    min="0" 
                                    className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none text-gray-900 text-base disabled:bg-gray-100"
                                    placeholder="Enter rate"
                                />
                            </div>
                            <div>
                                <label htmlFor="modalExtraDayRate" className="block text-sm font-semibold text-gray-700 mb-2">Extra Day Rate (₹)</label>
                                <input 
                                    type="number" 
                                    id="modalExtraDayRate" 
                                    value={rateData.extraDayRate} 
                                    onChange={(e) => setRateData({ ...rateData, extraDayRate: e.target.value })} 
                                    min="0" 
                                    className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none text-gray-900 text-base disabled:bg-gray-100"
                                    placeholder="Enter rate"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-4 md:px-6 py-4 flex flex-col gap-3 md:flex-row md:gap-0 md:justify-end md:space-x-3 border-t">
                        <Button type="button" className="w-full md:w-auto bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 order-2 md:order-1 py-3 md:py-2 rounded-lg" onClick={onClose}>Cancel</Button>
                        <Button type="submit" className="w-full md:w-auto bg-green-600 hover:bg-green-700 focus:ring-green-500 order-1 md:order-2 py-3 md:py-2 font-semibold rounded-lg" disabled={!rateData.positionName}>Save</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Form Component (Now Tenant-Aware) ---
const AttendanceSettingsForm: React.FC = () => {
    // TENANT-AWARE: Get session to extract tenantId
    const { data: session } = useSession();
    const tenantId = useMemo(() => session?.user?.tenantId, [session]);

    const [settings, setSettings] = useState<AttendanceSettings | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [allPositions, setAllPositions] = useState<string[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRate, setEditingRate] = useState<IPositionRateSetting | null>(null);

    // TENANT-AWARE: Create a centralized fetch wrapper
    const tenantAwareFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        if (!tenantId) {
          throw new Error("Your session is missing tenant information. Please log out and log back in.");
        }
        const headers = new Headers(options.headers || {});
        headers.set('x-tenant-id', tenantId);
        if (options.body && !headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
        return fetch(url, { ...options, headers });
    }, [tenantId]);

    // TENANT-AWARE: Guard the initial fetch until tenantId is available
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Use the tenant-aware wrapper
                const response = await tenantAwareFetch('/api/settings');
                const result = await response.json();
                
                if (result.success) {
                    setSettings({
                        defaultDailyHours: result.data.settings.defaultDailyHours ?? 0,
                        positionRates: result.data.settings.positionRates || [],
                    });
                    setAllPositions(result.data.positions || []);
                } else {
                     throw new Error(result.error || "Failed to fetch settings");
                }
            } catch (error) {
                console.error("An error occurred while fetching initial data:", error);
                 alert(`Error: ${error instanceof Error ? error.message : "Could not load settings from server."}`);
            } finally {
                setIsLoading(false);
            }
        };

        if (tenantId) {
            fetchData();
        }
    }, [tenantId, tenantAwareFetch]); // Depend on tenantId and the fetch wrapper

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (settings) {
            setSettings({ ...settings, [e.target.name]: e.target.valueAsNumber || 0 });
        }
    };

    const handleSavePositionRate = (rateToSave: IPositionRateSetting) => {
        if (!settings) return;
        let updatedRates;
        const existingIndex = settings.positionRates.findIndex(r => r.positionName === rateToSave.positionName);
        if (existingIndex > -1) {
            updatedRates = [...settings.positionRates];
            updatedRates[existingIndex] = rateToSave;
        } else {
            updatedRates = [...settings.positionRates, rateToSave];
        }
        setSettings({ ...settings, positionRates: updatedRates });
        setIsModalOpen(false);
        setEditingRate(null);
    };

    const handleDeletePositionRate = (positionNameToDelete: string) => {
        if (settings && window.confirm(`Are you sure you want to remove the specific rate for ${positionNameToDelete}?`)) {
            const updatedRates = settings.positionRates.filter(r => r.positionName !== positionNameToDelete);
            setSettings({ ...settings, positionRates: updatedRates });
        }
    };
    
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!settings) return;
        setIsSaving(true);
        try {
            // TENANT-AWARE: Use the tenant-aware wrapper for saving
            const response = await tenantAwareFetch('/api/settings', {
                method: 'POST',
                body: JSON.stringify(settings),
            });
            const result = await response.json();
            if (result.success) {
                alert("Attendance settings saved successfully!");
            } else {
                throw new Error(result.error || "Failed to save settings");
            }
        } catch (error) {
            console.error("Error saving settings:", error);
            alert(`Error: ${error instanceof Error ? error.message : "An unexpected error occurred."}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || !settings) {
        return <div className="text-center p-8">Loading settings...</div>;
    }

    return (
        <div className="space-y-4 md:space-y-8">
            <PositionRateModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSavePositionRate}
                positions={allPositions}
                existingRates={settings.positionRates}
                editingRate={editingRate}
            />
            
            {/* Header Section */}
            <div className="space-y-1 md:space-y-2">
                <h2 className="text-lg md:text-xl lg:text-2xl font-semibold text-gray-900">Attendance Requirements</h2>
                <p className="text-sm text-gray-600">Set defaults and position-specific rates for salary calculations.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8 lg:space-y-12">
                {/* Default Settings Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                    <div className="space-y-3 md:space-y-4">
                        <div>
                            <h3 className="text-base md:text-lg font-medium text-gray-900">Default Settings</h3>
                            <p className="text-xs text-gray-500 mt-1">This value is used as the standard working hours for all positions.</p>
                        </div>
                        <div className="w-full">
                            <label htmlFor="defaultDailyHours" className="block text-sm font-semibold text-gray-700 mb-2">Default Daily Working Hours</label>
                            <input 
                                type="number" 
                                id="defaultDailyHours" 
                                name="defaultDailyHours" 
                                value={settings.defaultDailyHours === 0 ? '' : settings.defaultDailyHours} 
                                onChange={handleChange} 
                                min="0" 
                                className="w-full px-3 py-3 md:py-2.5 border-2 border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none text-gray-900 text-base disabled:bg-gray-100"
                                placeholder="Enter hours"
                            />
                        </div>
                    </div>
                </div>
                
                {/* Position-Specific Rates Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                    <div className="space-y-4 md:space-y-6">
                        {/* Header with Add Button */}
                        <div className="space-y-3 md:space-y-0 md:flex md:justify-between md:items-center">
                            <div className="space-y-1">
                               <h3 className="text-base md:text-lg font-medium text-gray-900">Position-Specific Rates</h3>
                               <p className="text-xs text-gray-500">Set specific OT and Extra Day rates for different job roles.</p>
                            </div>
                            <Button 
                                type="button" 
                                className="w-full md:w-auto bg-green-600 hover:bg-green-700 focus:ring-green-500 text-sm flex items-center justify-center py-3 md:py-2 rounded-lg font-semibold" 
                                onClick={() => { setEditingRate(null); setIsModalOpen(true); }}
                            >
                                <PlusCircle size={16} className="mr-2" /> Add Position Rate
                            </Button>
                        </div>
                        
                        {/* Position Rates List */}
                        <div className="space-y-3">
                            {settings.positionRates.length === 0 ? (
                                <div className="text-center py-8 md:py-12 border-2 border-dashed border-gray-300 rounded-md">
                                    <p className="text-sm text-gray-500">No position-specific rates have been set.</p>
                                    <p className="text-xs text-gray-400 mt-1">Click 'Add Position Rate' to get started.</p>
                                </div>
                            ) : (
                                settings.positionRates.map((rate) => (
                                    <div key={rate.positionName} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                                        {/* Mobile Layout */}
                                        <div className="md:hidden space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="font-semibold text-gray-800 text-base">{rate.positionName}</p>
                                                <div className="flex items-center space-x-2">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => { setEditingRate(rate); setIsModalOpen(true); }} 
                                                        className="p-3 text-gray-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-50 min-h-[44px] min-w-[44px] flex items-center justify-center" 
                                                        title="Edit Rate"
                                                    >
                                                        <Edit size={18} />
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleDeletePositionRate(rate.positionName)} 
                                                        className="p-3 text-gray-500 hover:text-red-600 transition-colors rounded-lg hover:bg-gray-50 min-h-[44px] min-w-[44px] flex items-center justify-center" 
                                                        title="Delete Rate"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                                                <div>
                                                    <span className="text-xs font-semibold text-gray-500 block mb-1">OT Rate</span>
                                                    <span className="text-sm font-medium text-gray-800">₹{rate.otRate}/hr</span>
                                                </div>
                                                <div>
                                                    <span className="text-xs font-semibold text-gray-500 block mb-1">Extra Day Rate</span>
                                                    <span className="text-sm font-medium text-gray-800">₹{rate.extraDayRate}/day</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Desktop Layout */}
                                        <div className="hidden md:flex md:items-center md:justify-between">
                                            <div className="flex-1">
                                                <p className="font-semibold text-gray-800">{rate.positionName}</p>
                                                <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                                                    <span>OT: ₹{rate.otRate}/hr</span>
                                                    <span>Extra Day: ₹{rate.extraDayRate}/day</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <button 
                                                    type="button" 
                                                    onClick={() => { setEditingRate(rate); setIsModalOpen(true); }} 
                                                    className="p-2 text-gray-500 hover:text-blue-600 transition-colors" 
                                                    title="Edit Rate"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleDeletePositionRate(rate.positionName)} 
                                                    className="p-2 text-gray-500 hover:text-red-600 transition-colors" 
                                                    title="Delete Rate"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Save Button */}
                <div className="flex justify-center md:justify-end pt-4 md:pt-6 border-t border-gray-200">
                    <Button 
                        type="submit" 
                        disabled={isSaving || isLoading} 
                        className="w-full md:w-auto bg-green-600 hover:bg-green-700 focus:ring-green-500 py-3 md:py-2.5 px-6 text-base font-semibold rounded-lg"
                    >
                        {isSaving ? 'Saving...' : 'Save All Settings'}
                    </Button>
                </div>
            </form>
        </div>
    );
};

// --- Main Page Component (Mobile Responsive) ---
const SettingsPage = () => {
    return <AttendanceSettingsForm />;
};

export default SettingsPage;