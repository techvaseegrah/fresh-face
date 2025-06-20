'use client';
import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { DocumentTextIcon, CurrencyRupeeIcon, XMarkIcon, ClockIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import Link from 'next/link';

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

// --- REUSABLE COMPONENTS ---

const ImageZoomModal = ({ src, onClose }: { src: string; onClose: () => void; }) => { useEffect(() => { const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { onClose(); } }; window.addEventListener('keydown', handleKeyDown); return () => { window.removeEventListener('keydown', handleKeyDown); }; }, [onClose]); return ( <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center p-4 transition-opacity duration-300" onClick={onClose}> <button className="absolute top-4 right-4 text-white hover:text-gray-300 z-50 p-2" onClick={onClose} aria-label="Close image zoom view"> <XMarkIcon className="h-8 w-8" /> </button> <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()} > <img src={src} alt="Zoomed meter reading" className="object-contain w-full h-full rounded-lg" /> </div> </div> ); };
const CostModal = ({ isOpen, onClose, onSave, cost, setCost, isLoading }: { isOpen: boolean; onClose: () => void; onSave: (cost: number) => void; cost: number; setCost: (cost: number) => void; isLoading: boolean; }) => { if (!isOpen) return null; const handleSave = () => { if (cost < 0) { alert('Cost must be a positive number.'); return; } onSave(cost); }; return ( <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"> <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"> <h2 className="text-xl font-semibold text-gray-900">Set Cost Per Unit</h2> <p className="text-sm text-gray-600 mt-1">This cost will be applied to all currently displayed readings.</p> <div className="mt-4"> <label htmlFor="cost" className="block text-sm font-medium text-gray-700">Cost (INR)</label> <div className="relative mt-1 rounded-md shadow-sm"> <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"> <CurrencyRupeeIcon className="h-5 w-5 text-gray-400" aria-hidden="true" /> </div> <input type="number" name="cost" id="cost" className="block w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" placeholder="0.00" step="0.01" value={cost} onChange={(e) => setCost(parseFloat(e.target.value) || 0)} disabled={isLoading} /> </div> </div> <div className="mt-6 flex justify-end space-x-3"> <button type="button" className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none" onClick={onClose} disabled={isLoading}>Cancel</button> <button type="button" className={`inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={handleSave} disabled={isLoading}> {isLoading ? 'Saving...' : 'Save and Recalculate'} </button> </div> </div> </div> ); };

/**
 * [UPDATED] A modal to display update history with filtering options by user and date.
 */
const HistoryModal = ({ isOpen, onClose, history }: { isOpen: boolean; onClose: () => void; history: UpdateHistory[] }) => {
    // State for filters
    const [selectedUser, setSelectedUser] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Memoize the list of unique users for the dropdown filter
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

    // Memoize the filtered history list based on active filters
    const filteredHistory = useMemo(() => {
        return history
            .filter(entry => {
                // Filter by user
                if (selectedUser && entry.user.id !== selectedUser) {
                    return false;
                }
                
                // Filter by date range (normalizing dates to avoid time issues)
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
            .slice() // Create a shallow copy to avoid mutating the original prop
            .reverse(); // Display newest changes first
    }, [history, selectedUser, startDate, endDate]);

    const handleResetFilters = () => {
        setSelectedUser('');
        setStartDate('');
        setEndDate('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-semibold text-gray-900">Update History</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800">
                        <XMarkIcon className="h-6 w-6"/>
                    </button>
                </div>

                {/* --- FILTER CONTROLS --- */}
                {history.length > 0 && (
                     <div className="p-4 border-b bg-gray-50 flex flex-wrap items-end gap-4">
                        <div>
                            <label htmlFor="user-filter" className="block text-sm font-medium text-gray-700">User</label>
                            <select id="user-filter" value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="mt-1 block w-full min-w-[150px] rounded-md border-gray-300 shadow-sm sm:text-sm p-2">
                                <option value="">All Users</option>
                                {uniqueUsers.map(user => (
                                    <option key={user.id} value={user.id}>{user.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="start-date-filter" className="block text-sm font-medium text-gray-700">From Date</label>
                            <input type="date" id="start-date-filter" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2"/>
                        </div>
                        <div>
                            <label htmlFor="end-date-filter" className="block text-sm font-medium text-gray-700">To Date</label>
                            <input type="date" id="end-date-filter" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2"/>
                        </div>
                        <div>
                            <button onClick={handleResetFilters} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-100">Reset</button>
                        </div>
                    </div>
                )}
               
                <div className="p-6 overflow-y-auto space-y-4">
                    {history.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No update history found for this entry.</p>
                    ) : filteredHistory.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No history entries match the current filters.</p>
                    ) : (
                        filteredHistory.map((entry, index) => (
                            <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-sm font-medium text-gray-800">Changed by: <span className="font-bold">{entry.user.name || 'N/A'}</span></p>
                                    <p className="text-xs text-gray-500 whitespace-nowrap pl-4">{new Date(entry.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                </div>
                                <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-700">
                                    {entry.changes.map((change, cIndex) => (
                                        <li key={cIndex}>
                                            Updated <strong className="text-gray-900">{change.field}</strong> from <code className="text-xs bg-red-100 text-red-800 font-semibold px-1.5 py-0.5 rounded-md">{change.oldValue ?? 'Not Set'}</code> to <code className="text-xs bg-green-100 text-green-800 font-semibold px-1.5 py-0.5 rounded-md">{change.newValue ?? 'Not Set'}</code>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end">
                    <button type="button" className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={onClose}>Close</button>
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
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-semibold text-gray-900">Readings Summary</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800"><XMarkIcon className="h-6 w-6"/></button>
                </div>
                <div className="p-4 border-b bg-gray-50 flex flex-wrap items-center gap-4">
                    <div>
                        <label htmlFor="start-date-summary" className="block text-sm font-medium text-gray-700">Start Date</label>
                        <input type="date" id="start-date-summary" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2" />
                    </div>
                    <div>
                        <label htmlFor="end-date-summary" className="block text-sm font-medium text-gray-700">End Date</label>
                        <input type="date" id="end-date-summary" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2" />
                    </div>
                    <div className="pt-6">
                        <button onClick={handleResetFilters} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-100">Reset</button>
                    </div>
                </div>
                <div className="p-6 overflow-y-auto"><div className="flow-root"><div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8"><div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8"><table className="min-w-full divide-y divide-gray-300"><thead><tr><th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">Date</th><th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Start Units</th><th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">End Units</th><th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Consumed</th><th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Cost/Unit</th><th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0 text-left text-sm font-semibold text-gray-900">Total Cost</th></tr></thead><tbody className="divide-y divide-gray-200 bg-white">{filteredReadings.map((reading) => (<tr key={reading._id}><td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">{new Date(reading.date).toLocaleDateString('en-CA')}</td><td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{reading.startUnits?.toFixed(2) ?? 'N/A'}</td><td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{reading.endUnits?.toFixed(2) ?? 'N/A'}</td><td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{reading.unitsConsumed?.toFixed(2) ?? 'N/A'}</td><td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{reading.costPerUnit !== undefined ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(reading.costPerUnit) : 'N/A'}</td><td className="whitespace-nowrap py-4 pl-3 pr-4 text-sm font-medium text-gray-900 sm:pr-0">{reading.totalCost !== undefined ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(reading.totalCost) : 'N/A'}</td></tr>))}</tbody><tfoot><tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold"><th scope="row" colSpan={3} className="pl-4 pr-3 py-3 text-left text-sm text-gray-900 sm:pl-0">Filtered Total</th><td className="pl-3 pr-3 py-3 text-sm text-gray-900">{totals.unitsConsumed.toFixed(2)} units</td><td className="pl-3 pr-3 py-3 text-sm text-gray-500"></td><td className="pl-3 pr-4 py-3 text-sm text-gray-900 sm:pr-0">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totals.totalCost)}</td></tr></tfoot></table></div></div></div></div>
                <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end"><button type="button" className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={onClose}>Close</button></div>
            </div>
        </div>
    );
};

const EBReadingCard = ({ reading, onUpdate, onImageZoom }: { reading: EBReading; onUpdate: (id: string, startUnits: number, endUnits: number) => void; onImageZoom: (url: string) => void; }) => {
  const { data: session } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [startUnits, setStartUnits] = useState(reading.startUnits || 0);
  const [endUnits, setEndUnits] = useState(reading.endUnits || 0);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  const handleUpdate = async () => {
    if (startUnits < 0 || endUnits < 0) {
      alert('Units must be non-negative');
      return;
    }
    await onUpdate(reading._id, startUnits, endUnits);
    setIsEditing(false);
  };
  
  const handleCancelEdit = () => {
      setIsEditing(false);
      setStartUnits(reading.startUnits || 0);
      setEndUnits(reading.endUnits || 0);
  };

  return (
    <>
      <HistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} history={reading.history || []} />
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4 last:mb-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{new Date(reading.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
          {session && hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE) && (
            <button onClick={isEditing ? handleCancelEdit : () => setIsEditing(true)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">{isEditing ? 'Cancel' : 'Update Units'}</button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">Morning Reading</p>
            {isEditing ? <input type="number" value={startUnits} onChange={(e) => setStartUnits(parseFloat(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md" step="0.01" /> : <p className="text-lg font-medium text-gray-900">{reading.startUnits !== undefined ? `${reading.startUnits} units` : 'Not set'}</p>}
            {reading.startImageUrl && (
              <div className="mt-2 cursor-pointer" onClick={() => onImageZoom(reading.startImageUrl!)}>
                <Image src={reading.startImageUrl} alt="Morning Meter Reading" width={200} height={200} className="rounded-md object-cover w-full h-48 hover:opacity-90 transition-opacity" />
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Evening Reading</p>
            {isEditing ? <input type="number" value={endUnits} onChange={(e) => setEndUnits(parseFloat(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md" step="0.01" /> : <p className="text-lg font-medium text-gray-900">{reading.endUnits !== undefined ? `${reading.endUnits} units` : 'Not set'}</p>}
            {reading.endImageUrl && (
              <div className="mt-2 cursor-pointer" onClick={() => onImageZoom(reading.endImageUrl!)}>
                <Image src={reading.endImageUrl} alt="Evening Meter Reading" width={200} height={200} className="rounded-md object-cover w-full h-48 hover:opacity-90 transition-opacity" />
              </div>
            )}
          </div>
        </div>
        {(reading.unitsConsumed !== undefined || reading.totalCost !== undefined) && (
          <div className="mt-4 flex justify-between bg-gray-50 p-3 rounded-md">
            <p className="text-sm text-gray-600">Units Consumed: <span className="font-medium text-gray-900">{reading.unitsConsumed !== undefined ? `${reading.unitsConsumed.toFixed(2)} units` : 'N/A'}</span></p>
            <p className="text-sm text-gray-600">Total Cost: <span className="font-medium text-gray-900">{reading.totalCost !== undefined ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(reading.totalCost) : 'N/A'}</span></p>
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
            {isEditing ? (
                <button onClick={handleUpdate} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 w-full sm:w-auto">Save Units</button>
            ) : <div />}
            {reading.history && reading.history.length > 0 && (
                <button onClick={() => setIsHistoryModalOpen(true)} className="flex items-center text-sm text-gray-500 hover:text-gray-800 font-medium p-2 rounded-md hover:bg-gray-100 transition-colors">
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

  const fetchEBReadings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/eb');
      const data = await response.json();
      if (data.success) {
        setReadings(data.readings);
      } else {
        alert(data.message || 'Failed to fetch readings.');
      }
    } catch (error) {
      console.error('Error fetching EB readings:', error);
      alert('An error occurred while fetching data.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const updateReadingAPI = async (id: string, startUnits: number, endUnits: number, costPerUnit: number) => {
    const response = await fetch('/api/eb', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ readingId: id, startUnits, endUnits, costPerUnit }) });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update reading');
    }
    return await response.json();
  };
  
  const handleSetGlobalCost = async (newCost: number) => {
    setIsSavingCost(true);
    try {
      await Promise.all(readings.map(reading => updateReadingAPI(reading._id, reading.startUnits || 0, reading.endUnits || 0, newCost)));
      await fetchEBReadings();
    } catch (error) {
      console.error('Failed to apply global cost', error);
      alert(`An error occurred: ${(error as Error).message}`);
    } finally {
      setIsSavingCost(false);
      setIsCostModalOpen(false);
    }
  };

  const handleUnitUpdate = async (id: string, startUnits: number, endUnits: number) => {
    const readingToUpdate = readings.find(r => r._id === id);
    if (!readingToUpdate) return;
    try {
      await updateReadingAPI(id, startUnits, endUnits, readingToUpdate.costPerUnit || globalCost);
      await fetchEBReadings();
    } catch (error) {
      alert((error as Error).message);
    }
  };

  if (isLoading) {
    return <div className="p-6 bg-gray-50 min-h-screen"><div className="animate-pulse"><div className="h-8 bg-gray-200 rounded w-64 mb-6"></div><div className="grid grid-cols-1 gap-6">{[1, 2, 3].map(i => <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>)}</div></div></div>;
  }

  if (!canViewCalculateEB) {
    return <div className="p-6 bg-gray-50 min-h-screen"><p className="text-red-600">You do not have permission to view or calculate EB readings.</p></div>;
  }

  return (
    <>
      <CostModal isOpen={isCostModalOpen} onClose={() => setIsCostModalOpen(false)} onSave={handleSetGlobalCost} cost={globalCost} setCost={setGlobalCost} isLoading={isSavingCost} />
      <ReadingsSummaryModal isOpen={isSummaryModalOpen} onClose={() => setIsSummaryModalOpen(false)} readings={readings} />
      {zoomedImageUrl && <ImageZoomModal src={zoomedImageUrl} onClose={() => setZoomedImageUrl(null)} />}

      <div className="p-6 bg-gray-50 min-h-screen space-y-8">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div><h1 className="text-3xl font-bold text-gray-900">EB Readings View & Calculate</h1><p className="text-gray-600 mt-1"></p></div>
          <div className="text-sm text-gray-500 flex-shrink-0">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex flex-wrap justify-between items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-900">All Readings</h2>
            <div className="flex items-center space-x-2">
              <button onClick={() => setIsCostModalOpen(true)} className="text-sm bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-medium flex items-center px-3 py-1.5 rounded-md">
                <CurrencyRupeeIcon className="h-4 w-4 mr-2" />
                Set Cost Per Unit
              </button>
              <button onClick={() => setIsSummaryModalOpen(true)} className="text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium flex items-center px-3 py-1.5 rounded-md">
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                View Summary List
              </button>
            </div>
          </div>
          <div className="p-6">
            {readings.length === 0 ? (
              <div className="text-center py-8">
                <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No EB readings recorded yet. Go to <Link href="/eb-upload" className="text-indigo-600 hover:underline">EB Upload</Link> to add one.</p>
              </div>
            ) : (
              readings.map((reading) => (
                <EBReadingCard key={reading._id} reading={reading} onUpdate={handleUnitUpdate} onImageZoom={setZoomedImageUrl} />
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}