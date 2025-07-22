'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { PlusCircle, Edit, Trash2, Settings, FileText, Puzzle } from 'lucide-react';

// --- Types (Unchanged) ---
interface IPositionRateSetting {
    positionName: string;
    otRate: number;
    extraDayRate: number;
}
interface AttendanceSettings {
    defaultDailyHours: number;
    positionRates: IPositionRateSetting[];
}

// --- REFACTORED: Reusable UI Components ---

// A more versatile Button component with variants for different use-cases
const Button = ({ 
    children, 
    className, 
    variant = 'primary', 
    ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) => {
    const baseClasses = 'inline-flex items-center justify-center py-2 px-4 border shadow-sm text-sm font-medium rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150';
    
    const variantClasses = {
        primary: 'border-transparent text-white bg-slate-900 hover:bg-slate-700 focus-visible:ring-slate-500',
        secondary: 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50 focus-visible:ring-slate-500',
        ghost: 'border-transparent bg-transparent hover:bg-slate-100 focus-visible:ring-slate-500 text-slate-600 shadow-none',
    };

    return (
        <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
            {children}
        </button>
    );
};

// A more styled InputField
const InputField = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
        {...props}
        className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100"
    />
);

// --- REFACTORED: MODAL for Adding/Editing Position Rates ---
// Added subtle transitions for a smoother appearance
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
        
        // --- REFACTORED: Prevent body scroll when modal is open for better UX ---
        document.body.style.overflow = 'hidden';

        if (editingRate) {
            setRateData({
                positionName: editingRate.positionName,
                otRate: String(editingRate.otRate),
                extraDayRate: String(editingRate.extraDayRate),
            });
        } else {
            const availablePosition = positions.find(p => !existingRates.some(r => r.positionName === p));
            setRateData({
                positionName: availablePosition || '',
                otRate: '',
                extraDayRate: ''
            });
        }

        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen, editingRate, positions, existingRates]);
    
    const handleClose = () => {
        setRateData({ positionName: '', otRate: '', extraDayRate: '' });
        onClose();
    }

    const handleSave = (e: FormEvent) => {
        e.preventDefault();
        onSave({
            positionName: rateData.positionName,
            otRate: Number(rateData.otRate) || 0,
            extraDayRate: Number(rateData.extraDayRate) || 0,
        });
        handleClose();
    };

    const availablePositions = positions.filter(p =>
        !existingRates.some(r => r.positionName === p) || p === editingRate?.positionName
    );

    return (
        <div 
            className={`fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
            onClick={handleClose}
        >
            <div 
                className={`bg-white rounded-xl shadow-2xl w-full max-w-md transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} 
                onClick={(e) => e.stopPropagation()}
            >
                <form onSubmit={handleSave}>
                    <div className="p-6">
                        <h3 className="text-xl font-semibold text-slate-900">{editingRate ? 'Edit' : 'Add'} Position Rate</h3>
                        <p className="text-sm text-slate-500 mt-1">Define custom overtime and extra day rates for a specific job position.</p>
                        <div className="mt-6 space-y-4">
                            <div>
                                <label htmlFor="positionName" className="block text-sm font-medium text-slate-700">Position</label>
                                <select
                                    id="positionName"
                                    value={rateData.positionName}
                                    onChange={(e) => setRateData({ ...rateData, positionName: e.target.value })}
                                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900"
                                    disabled={!!editingRate}
                                >
                                    <option value="">Select a position</option>
                                    {availablePositions.map(p => <option key={p} value={p}>{p}</option>)}
                                    {editingRate && !availablePositions.includes(editingRate.positionName) && <option value={editingRate.positionName}>{editingRate.positionName}</option>}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="modalOtRate" className="block text-sm font-medium text-slate-700">OT Rate per Hour (₹)</label>
                                <InputField type="number" id="modalOtRate" value={rateData.otRate} onChange={(e) => setRateData({ ...rateData, otRate: e.target.value })} min="0" placeholder="e.g., 150" />
                            </div>
                            <div>
                                <label htmlFor="modalExtraDayRate" className="block text-sm font-medium text-slate-700">Extra Day Rate (₹)</label>
                                <InputField type="number" id="modalExtraDayRate" value={rateData.extraDayRate} onChange={(e) => setRateData({ ...rateData, extraDayRate: e.target.value })} min="0" placeholder="e.g., 1000" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-50 px-6 py-4 flex justify-end space-x-3 rounded-b-xl">
                        <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
                        <Button type="submit" disabled={!rateData.positionName}>Save Changes</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const AttendanceSettingsForm: React.FC = () => {
    // --- State Management (Mostly Unchanged) ---
    const [settings, setSettings] = useState<AttendanceSettings | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [allPositions, setAllPositions] = useState<string[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRate, setEditingRate] = useState<IPositionRateSetting | null>(null);

    // --- Data Fetching (Unchanged) ---
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Mock API for demonstration if /api/settings doesn't exist
                const mockResponse = {
                    success: true,
                    data: {
                        settings: {
                            defaultDailyHours: 8,
                            positionRates: [
                                { positionName: 'Senior Developer', otRate: 250, extraDayRate: 2000 },
                                { positionName: 'Designer', otRate: 200, extraDayRate: 1600 },
                            ]
                        },
                        positions: ['Senior Developer', 'Designer', 'Project Manager', 'QA Tester']
                    }
                };
                // In a real app, you would use:
                // const response = await fetch('/api/settings');
                // const result = await response.json();
                const result = mockResponse;

                if (result.success) {
                    setSettings({
                        defaultDailyHours: result.data.settings.defaultDailyHours ?? 0,
                        positionRates: result.data.settings.positionRates || [],
                    });
                    setAllPositions(result.data.positions || []);
                } else {
                     throw new Error("Failed to fetch settings");
                }
            } catch (error) {
                console.error("An error occurred while fetching initial data:", error);
                 alert(`Error: ${error instanceof Error ? error.message : "Could not load settings from server."}`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // --- Handlers (Logic is unchanged, only UI interactions) ---
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
        setSettings({ ...settings, positionRates: updatedRates.sort((a, b) => a.positionName.localeCompare(b.positionName)) });
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
        console.log("Saving settings:", settings);
        // Mock save
        await new Promise(res => setTimeout(res, 1000)); 
        alert("Attendance settings saved successfully!");
        setIsSaving(false);
    };

    if (isLoading || !settings) {
        return <div className="text-center p-8 text-slate-500">Loading settings...</div>;
    }

    // --- REFACTORED: The main form now uses a card-based layout ---
    return (
        <div className="space-y-10">
            <PositionRateModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingRate(null); }}
                onSave={handleSavePositionRate}
                positions={allPositions}
                existingRates={settings.positionRates}
                editingRate={editingRate}
            />

            <div>
                <h2 className="text-2xl font-bold text-slate-900">Attendance Requirements</h2>
                <p className="text-sm text-slate-500 mt-1">Set defaults and position-specific rates for salary calculations.</p>
            </div>
            
            <form onSubmit={handleSubmit}>
                <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 space-y-8">
                    {/* Section 1: Default Settings */}
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">Default Settings</h3>
                        <p className="text-sm text-slate-500 mt-1">This value is the standard working hours for all positions unless overridden.</p>
                        <div className="mt-6 max-w-sm">
                            <label htmlFor="defaultDailyHours" className="block text-sm font-medium text-slate-700">Default Daily Working Hours</label>
                            <InputField 
                                type="number" 
                                id="defaultDailyHours" 
                                name="defaultDailyHours" 
                                value={settings.defaultDailyHours === 0 ? '' : settings.defaultDailyHours} 
                                onChange={handleChange} 
                                min="0" 
                                placeholder="e.g., 8"
                            />
                        </div>
                    </div>

                    <div className="border-t border-slate-200 -mx-8"></div>
                    
                    {/* Section 2: Position-Specific Rates */}
                    <div>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">Position-Specific Rates</h3>
                                <p className="text-sm text-slate-500 mt-1">Set specific OT and Extra Day rates to override the defaults for certain job roles.</p>
                            </div>
                            <Button
                                type="button"
                                onClick={() => { setEditingRate(null); setIsModalOpen(true); }}
                                className="flex-shrink-0"
                            >
                                <PlusCircle size={16} className="mr-2" />
                                Add Rate
                            </Button>
                        </div>

                        <div className="mt-6 flow-root">
                            <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                                <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                                    {settings.positionRates.length === 0 ? (
                                        <div className="text-center py-10 border-2 border-dashed border-slate-300 rounded-lg">
                                            <h3 className="text-sm font-medium text-slate-900">No position-specific rates</h3>
                                            <p className="mt-1 text-sm text-slate-500">Get started by adding a new rate.</p>
                                        </div>
                                    ) : (
                                        // --- REFACTORED: Using a table for better alignment and structure ---
                                        <table className="min-w-full divide-y divide-slate-200">
                                            <thead>
                                                <tr>
                                                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-0">Position</th>
                                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">OT Rate (/hr)</th>
                                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Extra Day Rate</th>
                                                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0">
                                                        <span className="sr-only">Edit</span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {settings.positionRates.map((rate) => (
                                                    <tr key={rate.positionName}>
                                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-0">{rate.positionName}</td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">₹{rate.otRate}</td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">₹{rate.extraDayRate}</td>
                                                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                                                            <div className="flex items-center justify-end space-x-2">
                                                                <Button variant="ghost" type="button" onClick={() => { setEditingRate(rate); setIsModalOpen(true); }} title="Edit Rate"><Edit size={16} /></Button>
                                                                <Button variant="ghost" type="button" onClick={() => handleDeletePositionRate(rate.positionName)} className="text-red-600 hover:bg-red-50" title="Delete Rate"><Trash2 size={16} /></Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="mt-8 pt-5 flex justify-end">
                    <Button type="submit" disabled={isSaving || isLoading} className="w-full sm:w-auto">
                        {isSaving ? 'Saving...' : 'Save All Settings'}
                    </Button>
                </div>
            </form>
        </div>
    );
};

// --- REFACTORED: Main Page Component with improved styling ---
const SettingsPage = () => {
    const [activeTab, setActiveTab] = useState('attendance');
    const settingsTabs = [
        { id: 'attendance', label: 'Attendance & Salary', icon: FileText },
        { id: 'billing', label: 'Billing', icon: Settings, disabled: true },
        { id: 'integrations', label: 'Integrations', icon: Puzzle, disabled: true },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'attendance': return <AttendanceSettingsForm />;
            default: return <div className="text-center text-slate-500 py-16">This feature is coming soon.</div>;
        }
    };

    return (
        // Using a light background for the page to make the white content cards stand out
        <div className="bg-slate-50 text-slate-800">
          <div className="flex flex-col md:flex-row min-h-screen">
            {/* Sidebar with improved styling */}
            <aside className="w-full md:w-[260px] border-b md:border-b-0 md:border-r border-slate-200 flex-shrink-0 bg-white md:bg-transparent">
              <div className="p-4 md:p-6 sticky top-0">
                <h1 className="text-lg font-semibold text-slate-900 px-2 mb-4">Settings</h1>
                <ul className="space-y-1">
                  {settingsTabs.map(tab => (
                    <li key={tab.id}>
                      <button
                        onClick={() => !tab.disabled && setActiveTab(tab.id)}
                        disabled={tab.disabled}
                        className={`w-full flex items-center text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                            activeTab === tab.id 
                                ? 'bg-slate-900 text-white' 
                                : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                        } ${
                            tab.disabled 
                                ? 'text-slate-400 cursor-not-allowed hover:bg-transparent hover:text-slate-400' 
                                : ''
                        }`}
                      >
                        <tab.icon className="mr-3 h-5 w-5" />
                        {tab.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
            <main className="w-full">
              <div className="p-6 md:p-10 h-full">
                {renderContent()}
              </div>
            </main>
          </div>
        </div>
    );
};

export default SettingsPage;