'use client';
import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { 
    DocumentTextIcon, 
    CurrencyRupeeIcon, 
    XMarkIcon, 
    ClockIcon, 
    SunIcon, 
    MoonIcon, 
    ArrowUpRightIcon, 
    CalendarDaysIcon,
    ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import Image from 'next/image';
import Link from 'next/link';

// --- Import Reusable Report Components ---
// Adjust these paths if your components are in a different directory
import ReportDownloadModal from '@/components/ReportDownloadModal';
import { downloadReport } from '@/lib/reportService';


// --- INTERFACES ---

interface UpdateHistory {
  timestamp: string;
  user: { id: string; name: string; };
  changes: { field: string; oldValue?: number | string; newValue?: number | string; }[];
}

interface EBReading {
  _id: string;
  date: string;
  startUnits?: number;
  endUnits?: number;
  unitsConsumed?: number;
  costPerUnit?: number;
  totalCost?: number;
  startImageUrl?: string;
  endImageUrl?: string;
  createdBy: string;
  history: UpdateHistory[];
}


// --- REUSABLE SUB-COMPONENTS ---

const ImageZoomModal = ({ src, onClose }: { src: string; onClose: () => void; }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center p-4 transition-opacity duration-300" onClick={onClose}>
            <button className="absolute top-4 right-4 text-white hover:text-gray-300 z-50 p-2" onClick={onClose} aria-label="Close image zoom view">
                <XMarkIcon className="h-8 w-8" />
            </button>
            <div className="relative max-w-4xl max-h-[90vh] transition-transform duration-300 scale-95 animate-zoom-in" onClick={(e) => e.stopPropagation()}>
                <img src={src} alt="Zoomed meter reading" className="object-contain w-full h-full rounded-lg" />
            </div>
        </div>
    );
};

const CostModal = ({ isOpen, onClose, onSave, cost, setCost, isLoading }: { isOpen: boolean; onClose: () => void; onSave: (cost: number) => void; cost: number; setCost: (cost: number) => void; isLoading: boolean; }) => {
    if (!isOpen) return null;

    const handleSave = () => {
        if (cost < 0) {
            alert('Cost must be a positive number.');
            return;
        }
        onSave(cost);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center transition-opacity duration-300" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md transition-transform duration-300 scale-95 animate-zoom-in" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-xl font-semibold text-slate-900">Set Cost Per Unit</h2>
                <p className="text-sm text-slate-500 mt-1">This cost will apply to all readings and recalculate totals.</p>
                <div className="mt-6">
                    <label htmlFor="cost" className="block text-sm font-medium text-slate-700">Cost (INR)</label>
                    <div className="relative mt-1 rounded-md shadow-sm">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <CurrencyRupeeIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                        </div>
                        <input type="number" name="cost" id="cost" className="block w-full rounded-md border-slate-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" placeholder="0.00" step="0.01" value={cost} onChange={(e) => setCost(parseFloat(e.target.value) || 0)} disabled={isLoading} />
                    </div>
                </div>
                <div className="mt-8 flex justify-end space-x-3">
                    <button type="button" className="bg-white py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none" onClick={onClose} disabled={isLoading}>Cancel</button>
                    <button
                        type="button"
                        className={`inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={handleSave}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Saving...' : 'Save & Recalculate'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const HistoryModal = ({ isOpen, onClose, history }: { isOpen: boolean; onClose: () => void; history: UpdateHistory[] }) => {
    const [selectedUser, setSelectedUser] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const uniqueUsers = useMemo(() => {
        if (!history || history.length === 0) return [];
        const usersMap = new Map<string, { id: string; name: string }>();
        history.forEach(entry => {
            if (entry.user && entry.user.id && !usersMap.has(entry.user.id)) {
                usersMap.set(entry.user.id, entry.user);
            }
        });
        return Array.from(usersMap.values());
    }, [history]);

    const filteredHistory = useMemo(() => {
        return history
            .filter(entry => {
                if (selectedUser && entry.user.id !== selectedUser) return false;
                const entryDate = new Date(new Date(entry.timestamp).setHours(0, 0, 0, 0));
                if (startDate) {
                    const start = new Date(startDate);
                    if (entryDate < start) return false;
                }
                if (endDate) {
                    const end = new Date(endDate);
                    if (entryDate > end) return false;
                }
                return true;
            })
            .slice()
            .reverse();
    }, [history, selectedUser, startDate, endDate]);

    const handleResetFilters = () => {
        setSelectedUser('');
        setStartDate('');
        setEndDate('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 transition-opacity" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col transition-transform duration-300 scale-95 animate-zoom-in" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-900">Update History</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800"><XMarkIcon className="h-6 w-6"/></button>
                </div>

                {history.length > 0 && (
                     <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-end gap-4">
                        <div>
                            <label htmlFor="user-filter" className="block text-sm font-medium text-slate-700">User</label>
                            <select id="user-filter" value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="mt-1 block w-full min-w-[150px] rounded-md border-slate-300 shadow-sm sm:text-sm p-2">
                                <option value="">All Users</option>
                                {uniqueUsers.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="start-date-filter" className="block text-sm font-medium text-slate-700">From Date</label>
                            <input type="date" id="start-date-filter" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm sm:text-sm p-2"/>
                        </div>
                        <div>
                            <label htmlFor="end-date-filter" className="block text-sm font-medium text-slate-700">To Date</label>
                            <input type="date" id="end-date-filter" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm sm:text-sm p-2"/>
                        </div>
                        <div>
                            <button onClick={handleResetFilters} className="bg-white py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-100">Reset</button>
                        </div>
                    </div>
                )}
               
                <div className="p-6 overflow-y-auto space-y-4 bg-slate-50/50">
                    {history.length === 0 ? (
                        <p className="text-center text-slate-500 py-8">No update history found for this entry.</p>
                    ) : filteredHistory.length === 0 ? (
                        <p className="text-center text-slate-500 py-8">No history entries match the current filters.</p>
                    ) : (
                        filteredHistory.map((entry, index) => (
                            <div key={index} className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-sm font-medium text-slate-800">Changed by: <span className="font-bold">{entry.user.name || 'N/A'}</span></p>
                                    <p className="text-xs text-slate-500 whitespace-nowrap pl-4">{new Date(entry.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                </div>
                                <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-700">
                                    {entry.changes.map((change, cIndex) => (
                                        <li key={cIndex}>
                                            Updated <strong className="text-slate-900">{change.field}</strong> from <code className="text-xs bg-red-100 text-red-800 font-semibold px-1.5 py-0.5 rounded-md">{change.oldValue ?? 'Not Set'}</code> to <code className="text-xs bg-green-100 text-green-800 font-semibold px-1.5 py-0.5 rounded-md">{change.newValue ?? 'Not Set'}</code>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-lg flex justify-end">
                    <button type="button" className="bg-white py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

const ReadingsSummaryModal = ({ isOpen, onClose, readings }: { isOpen: boolean; onClose: () => void; readings: EBReading[] }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const filteredReadings = useMemo(() => {
        if (!startDate && !endDate) return readings;
        return readings.filter(reading => {
            const readingDate = new Date(new Date(reading.date).setHours(0, 0, 0, 0));
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            if (start && readingDate < start) return false;
            if (end && readingDate > end) return false;
            return true;
        });
    }, [readings, startDate, endDate]);

    const totals = useMemo(() => {
        return filteredReadings.reduce((acc, reading) => {
            acc.unitsConsumed += reading.unitsConsumed || 0;
            acc.totalCost += reading.totalCost || 0;
            return acc;
        }, { unitsConsumed: 0, totalCost: 0 });
    }, [filteredReadings]);

    const handleResetFilters = () => {
        setStartDate('');
        setEndDate('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 transition-opacity" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col transition-transform duration-300 scale-95 animate-zoom-in" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-900">Readings Summary</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800"><XMarkIcon className="h-6 w-6"/></button>
                </div>
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-end gap-4">
                    <div>
                        <label htmlFor="start-date-summary" className="block text-sm font-medium text-slate-700">Start Date</label>
                        <input type="date" id="start-date-summary" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm sm:text-sm p-2" />
                    </div>
                    <div>
                        <label htmlFor="end-date-summary" className="block text-sm font-medium text-slate-700">End Date</label>
                        <input type="date" id="end-date-summary" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm sm:text-sm p-2" />
                    </div>
                    <div>
                        <button onClick={handleResetFilters} className="bg-white py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-100">Reset</button>
                    </div>
                </div>
                <div className="p-2 sm:p-6 flex-1 overflow-y-auto">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-100">
                                <tr>
                                    {['Date', 'Start Units', 'End Units', 'Consumed', 'Cost/Unit', 'Total Cost'].map(header => (
                                        <th key={header} scope="col" className="px-4 py-3.5 text-left text-sm font-semibold text-slate-800 first:pl-4 last:pr-4">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {filteredReadings.map((reading) => (
                                    <tr key={reading._id} className="hover:bg-slate-50/70">
                                        <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-800">{new Date(reading.date).toLocaleDateString('en-CA')}</td>
                                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">{reading.startUnits?.toFixed(2) ?? 'N/A'}</td>
                                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">{reading.endUnits?.toFixed(2) ?? 'N/A'}</td>
                                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 font-medium">{reading.unitsConsumed?.toFixed(2) ?? 'N/A'}</td>
                                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">{reading.costPerUnit !== undefined ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(reading.costPerUnit) : 'N/A'}</td>
                                        <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-800">{reading.totalCost !== undefined ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(reading.totalCost) : 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-semibold">
                                <tr>
                                    <th scope="row" colSpan={3} className="pl-4 pr-3 py-3.5 text-left text-sm text-slate-900">Filtered Total</th>
                                    <td className="pl-3 pr-3 py-3.5 text-sm text-slate-900">{totals.unitsConsumed.toFixed(2)} units</td>
                                    <td className="pl-3 pr-3 py-3.5 text-sm text-slate-500"></td>
                                    <td className="pl-3 pr-4 py-3.5 text-sm text-slate-900">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totals.totalCost)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end">
                    <button type="button" className="bg-white py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

const ReadingDetail = ({ icon: Icon, title, value, imageUrl, onImageZoom, isEditing, onValueChange }: { icon: React.ElementType, title: string, value?: number, imageUrl?: string, onImageZoom: (url: string) => void, isEditing: boolean, onValueChange: (val: number | undefined) => void }) => (
    <div className="bg-slate-50/80 rounded-lg p-4">
        <div className="flex items-center text-slate-600 mb-2">
            <Icon className="h-5 w-5 mr-2" />
            <p className="text-sm font-medium">{title}</p>
        </div>
        {isEditing ? (
            <input 
                type="number"
                value={(value === undefined || isNaN(value)) ? '' : value}
                onChange={(e) => {
                    const val = e.target.value;
                    onValueChange(val === '' ? undefined : parseFloat(val));
                }}
                className="w-full p-2 border border-slate-300 rounded-md text-lg font-semibold text-slate-900"
                step="0.01"
                placeholder="Enter reading"
            />
        ) : (
            <p className="text-2xl font-semibold text-slate-900">{(value !== undefined && !isNaN(value)) ? `${value.toFixed(2)}` : 'N/A'} <span className="text-base font-normal text-slate-500">units</span></p>
        )}
        {imageUrl && (
            <div className="mt-3 cursor-pointer group" onClick={() => onImageZoom(imageUrl)}>
                <Image src={imageUrl} alt={`${title} Meter Reading`} width={200} height={200} className="rounded-md object-cover w-full h-40 group-hover:opacity-80 transition-opacity" />
            </div>
        )}
    </div>
);

const EBReadingCard = ({ reading, onUpdate, onImageZoom }: { reading: EBReading; onUpdate: (id: string, startUnits: number | undefined, endUnits: number | undefined) => void; onImageZoom: (url: string) => void; }) => {
    const { data: session } = useSession();
    const [isEditing, setIsEditing] = useState(false);
    const [editStartUnits, setEditStartUnits] = useState<number | undefined>();
    const [editEndUnits, setEditEndUnits] = useState<number | undefined>();
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
    const handleEnterEditMode = () => {
        setEditStartUnits(reading.startUnits || undefined);
        setEditEndUnits(reading.endUnits || undefined);
        setIsEditing(true);
    };

    const handleUpdate = async () => {
        const sUnits = editStartUnits;
        const eUnits = editEndUnits;
        
        if ((sUnits !== undefined && sUnits < 0) || (eUnits !== undefined && eUnits < 0)) {
            alert('Units must be non-negative');
            return;
        }
        await onUpdate(reading._id, sUnits, eUnits);
        setIsEditing(false);
    };
  
    const handleCancelEdit = () => {
        setIsEditing(false);
    };

    return (
        <>
            <HistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} history={reading.history || []} />
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl border-t-4 border-indigo-500">
                <div className="px-6 py-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-800">{new Date(reading.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                    {session && hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE) && (
                        <button onClick={isEditing ? handleCancelEdit : handleEnterEditMode} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1 rounded-md hover:bg-indigo-50 transition-colors">
                            {isEditing ? 'Cancel' : 'Update Units'}
                        </button>
                    )}
                </div>

                <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ReadingDetail 
                        icon={SunIcon} 
                        title="Morning Reading" 
                        value={isEditing ? editStartUnits : reading.startUnits} 
                        imageUrl={reading.startImageUrl} 
                        onImageZoom={onImageZoom} 
                        isEditing={isEditing} 
                        onValueChange={setEditStartUnits}
                    />
                    <ReadingDetail 
                        icon={MoonIcon} 
                        title="Evening Reading" 
                        value={isEditing ? editEndUnits : reading.endUnits} 
                        imageUrl={reading.endImageUrl} 
                        onImageZoom={onImageZoom} 
                        isEditing={isEditing} 
                        onValueChange={setEditEndUnits}
                    />
                </div>

                {(reading.unitsConsumed !== undefined || reading.totalCost !== undefined) && (
                    <div className="bg-slate-50 px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div className="flex items-center">
                            <div className="flex-shrink-0 bg-teal-100 text-teal-700 rounded-lg p-3">
                                <ArrowUpRightIcon className="h-6 w-6" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm text-slate-600">Units Consumed</p>
                                <p className="text-lg font-bold text-slate-800">{reading.unitsConsumed !== undefined ? `${reading.unitsConsumed.toFixed(2)} units` : 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-center">
                            <div className="flex-shrink-0 bg-amber-100 text-amber-700 rounded-lg p-3">
                                <CurrencyRupeeIcon className="h-6 w-6" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm text-slate-600">Total Cost</p>
                                <p className="text-lg font-bold text-slate-800">{reading.totalCost !== undefined ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(reading.totalCost) : 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                )}
                
                 <div className="px-6 py-4 flex items-center justify-between bg-white">
                    {isEditing ? (
                        <button onClick={handleUpdate} className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 w-full sm:w-auto font-semibold shadow-sm">Save Changes</button>
                    ) : <div />}
                    {reading.history && reading.history.length > 0 && (
                        <button onClick={() => setIsHistoryModalOpen(true)} className="flex items-center text-sm text-slate-500 hover:text-slate-800 font-medium p-2 rounded-md hover:bg-slate-100 transition-colors">
                            <ClockIcon className="h-4 w-4 mr-1.5"/>View History
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};


// --- MAIN PAGE COMPONENT ---

export default function EBViewPage() {
    const { data: session } = useSession();
    const [readings, setReadings] = useState<EBReading[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCostModalOpen, setIsCostModalOpen] = useState(false);
    const [globalCost, setGlobalCost] = useState(8);
    const [isSavingCost, setIsSavingCost] = useState(false);
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const canViewCalculateEB = useMemo(() => 
        session && hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE),
    [session]);

    useEffect(() => {
        if(canViewCalculateEB) {
            fetchEBReadings();
        } else if (session) {
            setIsLoading(false);
        }
    }, [session, canViewCalculateEB]);

    const fetchEBReadings = async () => { setIsLoading(true); try { const response = await fetch('/api/eb'); const data = await response.json(); if (data.success) { setReadings(data.readings); } else { alert(data.message || 'Failed to fetch readings.'); } } catch (error) { console.error('Error fetching EB readings:', error); alert('An error occurred while fetching data.'); } finally { setIsLoading(false); } };
    const updateReadingAPI = async (id: string, startUnits: number | undefined, endUnits: number | undefined, costPerUnit: number) => { const response = await fetch('/api/eb', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ readingId: id, startUnits, endUnits, costPerUnit }) }); if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Failed to update reading'); } return await response.json(); };
    const handleSetGlobalCost = async (newCost: number) => { setIsSavingCost(true); try { await Promise.all(readings.map(reading => updateReadingAPI(reading._id, reading.startUnits, reading.endUnits, newCost))); await fetchEBReadings(); } catch (error) { console.error('Failed to apply global cost', error); alert(`An error occurred: ${(error as Error).message}`); } finally { setIsSavingCost(false); setIsCostModalOpen(false); } };
    const handleUnitUpdate = async (id: string, startUnits: number | undefined, endUnits: number | undefined) => { const readingToUpdate = readings.find(r => r._id === id); if (!readingToUpdate) return; try { await updateReadingAPI(id, startUnits, endUnits, readingToUpdate.costPerUnit || globalCost); await fetchEBReadings(); } catch (error) { alert((error as Error).message); } };

    // --- CORRECTED Handler for EB Report Download ---
    const handleDownloadEbReport = async (params: { startDate: Date; endDate: Date; format: "pdf" | "excel" }) => {
        setIsDownloading(true);
        try {
             console.log("2. EB PAGE received these params:", params);
            // This now calls the correct API endpoint for the EB report
            await downloadReport('/api/eb/report', params);
            
            setIsReportModalOpen(false);
        } catch (error: any) {
            alert(`Download failed: ${error.message}`);
        } finally {
            setIsDownloading(false);
        }
    };

    if (isLoading) {
        return <div className="p-4 sm:p-6 lg:p-8 bg-slate-100"><div className="animate-pulse"><div className="h-10 bg-slate-200 rounded w-80 mb-8"></div><div className="space-y-8">{[1, 2, 3].map(i => <div key={i} className="h-80 bg-slate-200 rounded-2xl"></div>)}</div></div></div>;
    }

    if (!canViewCalculateEB) {
        return <div className="p-6 bg-slate-100"><p className="text-red-600">You do not have permission to view or calculate EB readings.</p></div>;
    }

    return (
        <>
            <CostModal isOpen={isCostModalOpen} onClose={() => setIsCostModalOpen(false)} onSave={handleSetGlobalCost} cost={globalCost} setCost={setGlobalCost} isLoading={isSavingCost} />
            <ReadingsSummaryModal isOpen={isSummaryModalOpen} onClose={() => setIsSummaryModalOpen(false)} readings={readings} />
            {zoomedImageUrl && <ImageZoomModal src={zoomedImageUrl} onClose={() => setZoomedImageUrl(null)} />}

            <ReportDownloadModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                onDownload={handleDownloadEbReport}
                isDownloading={isDownloading}
            />

            <main className=" bg-slate-100">
                <div className="max-w-7xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
                    <div className="flex flex-wrap justify-between items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">EB Readings</h1>
                            <p className="text-slate-500 mt-1">View, update, and calculate electricity consumption.</p>
                        </div>
                        <div className="text-sm text-slate-500 flex items-center">
                            <CalendarDaysIcon className="h-5 w-5 mr-2 text-slate-400" />
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-md border border-slate-200">
                        <div className="p-6 border-b border-slate-200 flex flex-wrap justify-between items-center gap-4">
                            <h2 className="text-xl font-semibold text-slate-800">All Readings</h2>
                            <div className="flex items-center space-x-3">
                                <button onClick={() => setIsCostModalOpen(true)} className="text-sm bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium flex items-center px-4 py-2 rounded-lg shadow-sm transition-colors">
                                    <CurrencyRupeeIcon className="h-5 w-5 mr-2" />
                                    Set Cost Per Unit
                                </button>
                                
                                <button
                                    onClick={() => setIsReportModalOpen(true)}
                                    className="text-sm bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium flex items-center px-4 py-2 rounded-lg shadow-sm transition-colors"
                                >
                                    <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                                    Download Report
                                </button>
                                
                                <button onClick={() => setIsSummaryModalOpen(true)} className="text-sm bg-indigo-600 text-white hover:bg-indigo-700 font-medium flex items-center px-4 py-2 rounded-lg shadow-sm transition-colors">
                                    <DocumentTextIcon className="h-5 w-5 mr-2" />
                                    View Summary
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            {readings.length === 0 ? (
                                <div className="text-center py-16">
                                    <DocumentTextIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold text-slate-700">No EB Readings Found</h3>
                                    <p className="text-slate-500 mt-2">Get started by adding the first reading.</p>
                                    <Link href="/eb-upload" className="mt-6 inline-block bg-indigo-600 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm hover:bg-indigo-700">
                                        Upload First Reading
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {readings.map((reading) => (
                                        <EBReadingCard key={reading._id} reading={reading} onUpdate={handleUnitUpdate} onImageZoom={setZoomedImageUrl} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}

/*
  For the modal zoom-in animation, add this to your global CSS file (e.g., globals.css):

  @keyframes zoom-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  .animate-zoom-in {
    animation: zoom-in 0.2s ease-out forwards;
  }
*/