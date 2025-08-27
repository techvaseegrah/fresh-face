'use client';

import { useState, useEffect, useMemo, useCallback, FC, ChangeEvent } from 'react';
import { useSession, Session } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { 
    DocumentTextIcon, 
    CurrencyRupeeIcon, 
    ClockIcon, 
    SunIcon, 
    ArrowUpRightIcon, 
    CalendarDaysIcon,
    ArrowDownTrayIcon,
    PencilSquareIcon,
    TrashIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import Image from 'next/image';
import Link from 'next/link';

// Component Imports (ensure these paths are correct for your project)
import ReportDownloadModal from '@/components/ReportDownloadModal';
import CostModal from '@/components/CostModal';
import HistoryModal from '@/components/HistoryModal';
import ReadingsSummaryModal from '@/components/ReadingsSummaryModal';
import ImageZoomModal from '@/components/ImageZoomModal';

// --- TYPE DEFINITIONS & INTERFACES ---

interface CustomSession extends Session {
    user: { 
        id: string; 
        name?: string | null; 
        email?: string | null; 
        image?: string | null; 
        role: { permissions: string[] };
        tenantId: string;
    };
}

interface IHistoryEntry {
  timestamp: string;
  user: { id: string; name: string; };
  changes: { field: string; oldValue?: number; newValue?: number; }[];
}

interface IEBReading {
  _id: string;
  date: string;
  meterIdentifier: string;
  morningUnits?: number;
  unitsConsumed?: number;
  costPerUnit?: number;
  totalCost?: number;
  morningImageUrl?: string;
  history: IHistoryEntry[];
}

interface IEBReadingWithAppointments extends IEBReading {
  appointmentCount?: number;
}

interface EBMeter {
  identifier: string;
  name: string;
}

interface EBReadingCardProps {
  reading: IEBReading;
  nextDayMorningUnits?: number;
  onUpdate: (id: string, morningUnits: number | undefined) => void;
  onImageZoom: (url: string) => void;
  onHistoryOpen: (history: IHistoryEntry[]) => void;
}


// --- INTERNAL COMPONENTS ---

const EBReadingCard: FC<EBReadingCardProps> = ({ reading, nextDayMorningUnits, onUpdate, onImageZoom, onHistoryOpen }) => {
    const { data: session } = useSession() as { data: CustomSession | null };
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [editMorningUnits, setEditMorningUnits] = useState<number | undefined>();

    const handleEnterEditMode = () => { setEditMorningUnits(reading.morningUnits); setIsEditing(true); };
    const handleUpdate = async (): Promise<void> => { 
        if (editMorningUnits !== undefined && editMorningUnits < 0) { alert('Units must be a non-negative number.'); return; } 
        await onUpdate(reading._id, editMorningUnits); setIsEditing(false); 
    };
    const handleCancelEdit = () => setIsEditing(false);
    
    return (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl border-t-4 border-indigo-500">
            <div className="px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">{new Date(reading.date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                {session && hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE) && (
                    <button onClick={isEditing ? handleCancelEdit : handleEnterEditMode} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1 rounded-md hover:bg-indigo-50 transition-colors">
                        {isEditing ? 'Cancel' : 'Update Units'}
                    </button>
                )}
            </div>
            <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-50/80 rounded-lg p-4 space-y-4">
                    <div>
                        <div className="flex items-center text-slate-600 mb-2">
                            <SunIcon className="h-5 w-5 mr-2 text-yellow-500" />
                            <p className="text-sm font-medium">Morning Reading (Today)</p>
                        </div>
                        {isEditing ? (
                            <input type="number" value={editMorningUnits ?? ''} onChange={(e: ChangeEvent<HTMLInputElement>) => { const val = e.target.value; setEditMorningUnits(val === '' ? undefined : parseFloat(val)); }} className="w-full p-2 border border-slate-300 rounded-md text-lg font-semibold text-slate-900" step="0.01" placeholder="Enter reading" />
                        ) : (
                            <p className="text-2xl font-semibold text-slate-900">{(reading.morningUnits !== undefined) ? reading.morningUnits.toFixed(2) : 'N/A'} <span className="text-base font-normal text-slate-500">units</span></p>
                        )}
                        {reading.morningImageUrl && (
                            <div onClick={() => onImageZoom(reading.morningImageUrl as string)} className="mt-3 cursor-pointer group">
                                <Image src={reading.morningImageUrl} alt="Morning Meter Reading" width={200} height={120} className="rounded-md object-cover w-full h-auto group-hover:opacity-80 transition-opacity" />
                            </div>
                        )}
                    </div>
                    <hr className="border-slate-200" />
                    <div>
                        <div className="flex items-center text-slate-600 mb-2">
                            <CalendarDaysIcon className="h-5 w-5 mr-2 text-sky-600" />
                            <p className="text-sm font-medium">Morning Reading (Next Day)</p>
                        </div>
                        <p className="text-2xl font-semibold text-slate-900">{nextDayMorningUnits !== undefined ? nextDayMorningUnits.toFixed(2) : 'N/A'} <span className="text-base font-normal text-slate-500">units</span></p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="bg-slate-50/80 rounded-lg p-4 flex items-center h-full">
                        <div className="flex-shrink-0 bg-teal-100 text-teal-700 rounded-lg p-3"><ArrowUpRightIcon className="h-6 w-6" /></div>
                        <div className="ml-4">
                            <p className="text-sm text-slate-600">Units Consumed (for this day)</p>
                            <p className="text-lg font-bold text-slate-800">{reading.unitsConsumed !== undefined ? `${reading.unitsConsumed.toFixed(2)} units` : 'N/A'}</p>
                        </div>
                    </div>
                    <div className="bg-slate-50/80 rounded-lg p-4 flex items-center h-full">
                        <div className="flex-shrink-0 bg-amber-100 text-amber-700 rounded-lg p-3"><CurrencyRupeeIcon className="h-6 w-6" /></div>
                        <div className="ml-4">
                            <p className="text-sm text-slate-600">Total Cost</p>
                            <p className="text-lg font-bold text-slate-800">{reading.totalCost !== undefined ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(reading.totalCost) : 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="px-6 py-4 flex items-center justify-between bg-slate-50 border-t border-slate-200">
                {isEditing ? (
                    <button onClick={handleUpdate} className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 w-full sm:w-auto font-semibold shadow-sm">Save Changes</button>
                ) : <div />}
                {reading.history && reading.history.length > 0 && (
                    <button onClick={() => onHistoryOpen(reading.history)} className="flex items-center text-sm text-slate-500 hover:text-slate-800 font-medium p-2 rounded-md hover:bg-slate-100 transition-colors">
                        <ClockIcon className="h-4 w-4 mr-1.5"/>View History
                    </button>
                )}
            </div>
        </div>
    );
};

const EditMeterModal: FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (newName: string) => Promise<void>;
  meter: EBMeter | null;
  isSaving: boolean;
}> = ({ isOpen, onClose, onSave, meter, isSaving }) => {
  const [name, setName] = useState('');
  useEffect(() => { if (meter) { setName(meter.name); } }, [meter]);

  if (!isOpen || !meter) return null;

  const handleSave = () => { if (name.trim().length >= 3) { onSave(name.trim()); } };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 transition-opacity duration-300">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-transform scale-95 animate-zoom-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-800">Edit Meter Name</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><XMarkIcon className="h-6 w-6 text-slate-500" /></button>
        </div>
        <div>
          <label htmlFor="meter-name" className="block text-sm font-medium text-slate-700">Meter Name</label>
          <input
            type="text"
            id="meter-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            disabled={isSaving}
          />
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={isSaving || name.trim().length < 3} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};


// --- MAIN PAGE COMPONENT ---
export default function EBViewPage(): JSX.Element {
    const { data: session } = useSession() as { data: CustomSession | null };
    const [readings, setReadings] = useState<IEBReadingWithAppointments[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [meters, setMeters] = useState<EBMeter[]>([]);
    const [isMetersLoading, setIsMetersLoading] = useState<boolean>(true);
    const [activeMeter, setActiveMeter] = useState<string>('');
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [isCostModalOpen, setIsCostModalOpen] = useState<boolean>(false);
    const [globalCost, setGlobalCost] = useState<number>(8);
    const [isSavingCost, setIsSavingCost] = useState<boolean>(false);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
    const [currentHistory, setCurrentHistory] = useState<IHistoryEntry[]>([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [meterToEdit, setMeterToEdit] = useState<EBMeter | null>(null);
    const [isSavingMeter, setIsSavingMeter] = useState(false);

    const canViewCalculateEB = useMemo(() => session && hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE), [session]);
    const canManageMeters = useMemo(() => session && hasPermission(session.user.role.permissions, PERMISSIONS.EB_UPLOAD), [session]);

    const fetchAllData = useCallback(async () => {
        if (!session?.user?.tenantId || !canViewCalculateEB) {
            setIsLoading(false);
            setIsMetersLoading(false);
            return;
        }
        setIsLoading(true);
        setIsMetersLoading(true);

        try {
            const headers = { 'x-tenant-id': session.user.tenantId };
            const [metersRes, readingsRes, costRes, appointmentsRes] = await Promise.all([
                fetch('/api/eb/meters', { headers }),
                fetch('/api/eb', { headers }),
                fetch('/api/settings/ebCostPerUnit', { headers }),
                fetch('/api/appointment/summary', { headers }),
            ]);

            const metersData = await metersRes.json();
            if (!metersRes.ok) throw new Error(metersData.message || "Failed to fetch meters");
            const fetchedMeters = metersData.meters || [];
            setMeters(fetchedMeters);
            if (fetchedMeters.length > 0) {
                setActiveMeter(currentActive => fetchedMeters.some((m: EBMeter) => m.identifier === currentActive) ? currentActive : fetchedMeters[0].identifier);
            } else {
                setActiveMeter('');
            }

            const costData = await costRes.json();
            if (costRes.ok && costData.setting.value !== null) {
                setGlobalCost(costData.setting.value);
            }

            const readingsData = await readingsRes.json();
            if (!readingsRes.ok) throw new Error(readingsData.message || 'Failed to fetch readings.');
            const appointmentsData = await appointmentsRes.json();
            const appointmentCounts = appointmentsData.success ? appointmentsData.counts : {};
            
            const combinedData: IEBReadingWithAppointments[] = (readingsData.readings as IEBReading[]).map(reading => {
                const dateKey = new Date(reading.date).toISOString().split('T')[0];
                return { 
                    ...reading, 
                    appointmentCount: appointmentCounts[dateKey] || 0 
                };
            });
            
            setReadings(combinedData);

        } catch (error) {
            console.error("Error fetching page data:", error);
        } finally {
            setIsLoading(false);
            setIsMetersLoading(false);
        }
    }, [session, canViewCalculateEB]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);
    
    const handleUnitUpdate = async (id: string, morningUnits: number | undefined): Promise<void> => {
      const tenantId = session?.user?.tenantId;
      if (!tenantId) { alert('Update failed.'); return; }
      try {
        const res = await fetch('/api/eb', { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId }, 
            body: JSON.stringify({ readingId: id, morningUnits }) 
        });
        if (!res.ok) throw new Error('Failed to update units.');
        await fetchAllData();
      } catch (error) { alert((error as Error).message); }
    };
    
    const handleSetGlobalCost = async (newCost: number): Promise<void> => {
        const tenantId = session?.user?.tenantId;
        if (!tenantId) { alert('Cost update failed.'); return; }
        setIsSavingCost(true);
        try {
            await fetch('/api/settings/ebCostPerUnit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId }, body: JSON.stringify({ value: newCost }) });
            setGlobalCost(newCost);
            setIsCostModalOpen(false);
        } catch (error) { alert(`Error: ${(error as Error).message}`); } 
        finally { setIsSavingCost(false); }
    };

    const handleHistoryOpen = (history: IHistoryEntry[]): void => { setCurrentHistory(history); setIsHistoryModalOpen(true); };

    const handleDownloadEbReport = async (params: { startDate: Date; endDate: Date; format: "pdf" | "excel" }): Promise<void> => {
        const tenantId = session?.user?.tenantId;
        if (!tenantId) { alert('Report download failed.'); return; }
        setIsDownloading(true);
        try {
            const response = await fetch('/api/eb/report', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId }, 
                body: JSON.stringify(params) 
            });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Failed to generate report.'); }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', params.format === 'excel' ? 'EB_Report.xlsx' : 'EB_Report.pdf');
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);
            setIsReportModalOpen(false);
        } catch (error) { alert(`Download failed: ${(error as Error).message}`); } 
        finally { setIsDownloading(false); }
    };

    const handleOpenEditModal = (meter: EBMeter) => { setMeterToEdit(meter); setIsEditModalOpen(true); };

    const handleUpdateMeterName = async (newName: string) => {
        if (!meterToEdit || !session?.user?.tenantId) return;
        setIsSavingMeter(true);
        try {
            const res = await fetch(`/api/eb/meters/${meterToEdit.identifier}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-tenant-id': session.user.tenantId },
                body: JSON.stringify({ name: newName }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            await fetchAllData();
            setIsEditModalOpen(false);
        } catch (error) { alert(`Error: ${(error as Error).message}`); } 
        finally { setIsSavingMeter(false); }
    };

    const handleDeleteMeter = async (meterToDelete: EBMeter) => {
        if (!session?.user?.tenantId || !window.confirm(`Are you sure you want to delete "${meterToDelete.name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/eb/meters/${meterToDelete.identifier}`, {
                method: 'DELETE',
                headers: { 'x-tenant-id': session.user.tenantId },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            await fetchAllData();
        } catch (error) { alert(`Error: ${(error as Error).message}`); }
    };

    const displayedReadings = useMemo(() => {
        if (!activeMeter) return [];
        return [...readings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).filter(r => r.meterIdentifier === activeMeter);
    }, [readings, activeMeter]);

    const activeMeterName = useMemo(() => meters.find(m => m.identifier === activeMeter)?.name || '', [meters, activeMeter]);

    if (isLoading || isMetersLoading) {
        return <div className="p-8 bg-slate-100 min-h-screen"><div className="animate-pulse h-96 bg-slate-200 rounded-2xl"></div></div>;
    }
    if (!canViewCalculateEB) {
        return <div className="p-6 bg-slate-100 min-h-screen"><p className="text-red-600">You do not have permission to view EB readings.</p></div>;
    }

    return (
        <>
            <EditMeterModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSave={handleUpdateMeterName} meter={meterToEdit} isSaving={isSavingMeter} />
            <CostModal isOpen={isCostModalOpen} onClose={() => setIsCostModalOpen(false)} onSave={handleSetGlobalCost} cost={globalCost} isLoading={isSavingCost} />
            <ReadingsSummaryModal isOpen={isSummaryModalOpen} onClose={() => setIsSummaryModalOpen(false)} readings={readings} meters={meters} />
            <HistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} history={currentHistory} />
            {zoomedImageUrl && <ImageZoomModal src={zoomedImageUrl} onClose={() => setZoomedImageUrl(null)} />}
            <ReportDownloadModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} onDownload={handleDownloadEbReport} isDownloading={isDownloading} />

            <main className="bg-slate-100 min-h-screen">
                <div className="max-w-7xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
                    <div className="flex flex-wrap justify-between items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">EB Readings</h1>
                            <p className="text-slate-500 mt-1">View, update, and manage electricity consumption.</p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button onClick={() => setIsCostModalOpen(true)} className="text-sm bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium flex items-center px-4 py-2 rounded-lg shadow-sm"><CurrencyRupeeIcon className="h-5 w-5 mr-2" />Set Cost</button>
                            <button onClick={() => setIsReportModalOpen(true)} className="text-sm bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium flex items-center px-4 py-2 rounded-lg shadow-sm"><ArrowDownTrayIcon className="h-5 w-5 mr-2" />Download</button>
                            <button onClick={() => setIsSummaryModalOpen(true)} className="text-sm bg-indigo-600 text-white hover:bg-indigo-700 font-medium flex items-center px-4 py-2 rounded-lg shadow-sm"><DocumentTextIcon className="h-5 w-5 mr-2" />Summary</button>
                        </div>
                    </div>
                    
                    <div className="border-b border-slate-200">
                        <nav className="-mb-px flex space-x-6 items-center" aria-label="Tabs">
                            {meters.map((meter) => (
                                <div key={meter.identifier} className="relative group flex items-center">
                                    <button onClick={() => setActiveMeter(meter.identifier)} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeMeter === meter.identifier ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                                        {meter.name}
                                    </button>
                                    {canManageMeters && (
                                      <div className="flex items-center ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                          <button onClick={() => handleOpenEditModal(meter)} title="Edit name" className="p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600"><PencilSquareIcon className="h-4 w-4" /></button>
                                          <button onClick={() => handleDeleteMeter(meter)} title="Delete meter" className="p-1 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>
                                      </div>
                                    )}
                                </div>
                            ))}
                            {meters.length === 0 && !isMetersLoading && <p className="py-4 text-sm text-slate-500">No meters have been added yet.</p>}
                        </nav>
                    </div>

                    <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
                        {displayedReadings.length === 0 && meters.length > 0 ? (
                            <div className="text-center py-16">
                                <DocumentTextIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-slate-700">No Readings Found for {activeMeterName}</h3>
                                <p className="text-slate-500 mt-2">Upload a reading for this meter to get started.</p>
                                <Link href="/eb-upload" className="mt-6 inline-block bg-indigo-600 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm hover:bg-indigo-700">Upload Reading</Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                {displayedReadings.map((reading, index) => {
                                    const nextDayReading = index > 0 ? displayedReadings[index - 1] : null;
                                    return <EBReadingCard key={reading._id} reading={reading} nextDayMorningUnits={nextDayReading?.morningUnits} onUpdate={handleUnitUpdate} onImageZoom={setZoomedImageUrl} onHistoryOpen={handleHistoryOpen} />;
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}