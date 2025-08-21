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
    ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import Image from 'next/image';
import Link from 'next/link';

// Components
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
  user: { 
    id: string; 
    name: string; 
  };
  changes: { 
    field: string; 
    oldValue?: number; 
    newValue?: number; 
  }[];
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

interface EBReadingCardProps {
  reading: IEBReading;
  nextDayMorningUnits?: number;
  onUpdate: (id: string, morningUnits: number | undefined) => void;
  onImageZoom: (url: string) => void;
  onHistoryOpen: (history: IHistoryEntry[]) => void;
}


// --- EBReadingCard COMPONENT (மாற்றம் இல்லை) ---
const EBReadingCard: FC<EBReadingCardProps> = ({ reading, nextDayMorningUnits, onUpdate, onImageZoom, onHistoryOpen }) => {
    const { data: session } = useSession() as { data: CustomSession | null };
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [editMorningUnits, setEditMorningUnits] = useState<number | undefined>();

    const handleEnterEditMode = () => { 
        setEditMorningUnits(reading.morningUnits); 
        setIsEditing(true); 
    };
    
    const handleUpdate = async (): Promise<void> => { 
        if (editMorningUnits !== undefined && editMorningUnits < 0) { 
            alert('Units must be a non-negative number.'); 
            return; 
        } 
        await onUpdate(reading._id, editMorningUnits); 
        setIsEditing(false); 
    };

    const handleCancelEdit = () => setIsEditing(false);
    
    return (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl border-t-4 border-indigo-500">
            <div className="px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">{new Date(reading.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
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

// --- MAIN PAGE COMPONENT ---
export default function EBViewPage(): JSX.Element {
    const { data: session } = useSession() as { data: CustomSession | null };
    const [readings, setReadings] = useState<IEBReadingWithAppointments[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [activeMeter, setActiveMeter] = useState<'meter-1' | 'meter-2'>('meter-1');
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [isCostModalOpen, setIsCostModalOpen] = useState<boolean>(false);
    const [globalCost, setGlobalCost] = useState<number>(8);
    const [isSavingCost, setIsSavingCost] = useState<boolean>(false);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
    const [currentHistory, setCurrentHistory] = useState<IHistoryEntry[]>([]);

    const canViewCalculateEB = useMemo(() => 
        session && hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE),
    [session]);

    const fetchPageData = useCallback(async (): Promise<void> => {
        const tenantId = session?.user?.tenantId;
        if (!tenantId) {
            setIsLoading(false);
            alert('Could not identify your salon. Please refresh the page.');
            return;
        }

        setIsLoading(true);
        try {
            const headers = { 'x-tenant-id': tenantId };
            const [ebRes, appointmentsRes, costRes] = await Promise.all([
                fetch('/api/eb', { headers }), 
                fetch('/api/appointment/summary', { headers }),
                fetch('/api/settings/ebCostPerUnit', { headers })
            ]);
            
            const ebData = await ebRes.json();
            const appointmentsData = await appointmentsRes.json();

            if (!ebData.success) throw new Error(ebData.message || 'Failed to fetch EB readings.');

            const appointmentCounts = appointmentsData.success ? appointmentsData.counts : {};
            
            const combinedData: IEBReadingWithAppointments[] = (ebData.readings as IEBReading[]).map(reading => {
                const dateKey = new Date(reading.date).toISOString().split('T')[0];
                return { ...reading, appointmentCount: appointmentCounts[dateKey] || 0 };
            });
            setReadings(combinedData);

            const costData = await costRes.json();
            if (costData.success && costData.setting.value !== null) {
                setGlobalCost(costData.setting.value);
            }
        } catch (error) { 
            console.error('Error fetching page data:', error); 
            alert('An error occurred while fetching data.'); 
        } finally { 
            setIsLoading(false); 
        }
    }, [session]);

    useEffect(() => {
        if(canViewCalculateEB) { fetchPageData(); } else if (session) { setIsLoading(false); }
    }, [session, canViewCalculateEB, fetchPageData]);
    
    const handleUnitUpdate = async (id: string, morningUnits: number | undefined): Promise<void> => {
      const tenantId = session?.user?.tenantId;
      if (!tenantId) {
          alert('Could not identify your salon. Update failed.');
          return;
      }
      try {
        const res = await fetch('/api/eb', { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId }, 
            body: JSON.stringify({ readingId: id, morningUnits }) 
        });
        if (!res.ok) { const errorData = await res.json(); throw new Error(errorData.message || "Failed to update reading."); }
        await fetchPageData();
      } catch (error) { 
        alert((error as Error).message); 
      }
    };
    
    const handleSetGlobalCost = async (newCost: number): Promise<void> => {
        const tenantId = session?.user?.tenantId;
        if (!tenantId) {
            alert('Could not identify your salon. Cost update failed.');
            return;
        }
        setIsSavingCost(true);
        try {
            const res = await fetch('/api/settings/ebCostPerUnit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId }, body: JSON.stringify({ value: newCost }) });
            if (!res.ok) { throw new Error('Failed to update cost setting.'); }
            setGlobalCost(newCost);
            setIsCostModalOpen(false);
            alert('Global cost per unit has been updated for all future readings.');
        } catch (error) {
            alert(`An error occurred while setting the new cost: ${(error as Error).message}`);
        } finally { setIsSavingCost(false); }
    };

    const handleHistoryOpen = (history: IHistoryEntry[]): void => {
        setCurrentHistory(history);
        setIsHistoryModalOpen(true);
    };

    // --- மாற்றப்பட்ட மற்றும் சரிசெய்யப்பட்ட ரிப்போர்ட் டவுன்லோட் ஃபங்ஷன் ---
    const handleDownloadEbReport = async (params: { startDate: Date; endDate: Date; format: "pdf" | "excel" }): Promise<void> => {
        const tenantId = session?.user?.tenantId;
        if (!tenantId) {
            alert('Could not identify your salon. Report download failed.');
            return;
        }
        setIsDownloading(true);
        try {
            const response = await fetch('/api/eb/report', { 
                method: 'POST', 
                headers: { 
                    'Content-Type': 'application/json', 
                    'x-tenant-id': tenantId 
                }, 
                body: JSON.stringify(params) 
            });

            if (!response.ok) { 
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to generate report.'); 
            }

            // Backend-லிருந்து வரும் file-ஐப் பெறுகிறோம்
            const blob = await response.blob();
            
            // ஒரு தற்காலிக URL-ஐ உருவாக்குகிறோம்
            const url = window.URL.createObjectURL(blob);
            
            // ஒரு தற்காலிக link-ஐ உருவாக்கி, அதை click செய்கிறோம்
            const link = document.createElement('a');
            link.href = url;
            const filename = params.format === 'excel' ? 'EB_Report.xlsx' : 'EB_Report.pdf';
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            
            // தற்காலிக link-ஐ நீக்கிவிடுகிறோம்
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);

            setIsReportModalOpen(false);
        } catch (error) {
            alert(`Download failed: ${(error as Error).message}`);
        } finally {
            setIsDownloading(false);
        }
    };

    const displayedReadings = useMemo(() => {
        // டேட்டாபேஸிலிருந்து வரும் டேட்டாவை தேதி வாரியாக வரிசைப்படுத்தவும்
        const sortedReadings = [...readings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return sortedReadings.filter(r => {
            // பழைய டேட்டாவில் meterIdentifier இல்லாமல் இருக்கலாம், அதை meter-1 ஆகக் கருதவும்
            if (activeMeter === 'meter-1' && (r.meterIdentifier === 'meter-1' || !r.meterIdentifier)) { 
                return true; 
            }
            return r.meterIdentifier === activeMeter;
        });
    }, [readings, activeMeter]);

    if (isLoading) {
        return <div className="p-4 sm:p-6 lg:p-8 bg-slate-100"><div className="animate-pulse"><div className="h-10 bg-slate-200 rounded w-80 mb-8"></div><div className="grid grid-cols-1 xl:grid-cols-2 gap-8">{[1, 2].map(i => <div key={i} className="h-80 bg-slate-200 rounded-2xl"></div>)}</div></div></div>;
    }

    if (!canViewCalculateEB) {
        return <div className="p-6 bg-slate-100"><p className="text-red-600">You do not have permission to view or calculate EB readings.</p></div>;
    }

    return (
        <>
            <CostModal isOpen={isCostModalOpen} onClose={() => setIsCostModalOpen(false)} onSave={handleSetGlobalCost} cost={globalCost} isLoading={isSavingCost} />
            <ReadingsSummaryModal isOpen={isSummaryModalOpen} onClose={() => setIsSummaryModalOpen(false)} readings={readings} />
            <HistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} history={currentHistory} />
            {zoomedImageUrl && <ImageZoomModal src={zoomedImageUrl} onClose={() => setZoomedImageUrl(null)} />}
            <ReportDownloadModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} onDownload={handleDownloadEbReport} isDownloading={isDownloading} />

            <main className="bg-slate-100 min-h-screen">
                <div className="max-w-7xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
                    <div className="flex flex-wrap justify-between items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">EB Readings</h1>
                            <p className="text-slate-500 mt-1">View, update, and calculate electricity consumption.</p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button onClick={() => setIsCostModalOpen(true)} className="text-sm bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium flex items-center px-4 py-2 rounded-lg shadow-sm transition-colors"><CurrencyRupeeIcon className="h-5 w-5 mr-2" />Set Cost Per Unit</button>
                            <button onClick={() => setIsReportModalOpen(true)} className="text-sm bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium flex items-center px-4 py-2 rounded-lg shadow-sm transition-colors"><ArrowDownTrayIcon className="h-5 w-5 mr-2" />Download Report</button>
                            <button onClick={() => setIsSummaryModalOpen(true)} className="text-sm bg-indigo-600 text-white hover:bg-indigo-700 font-medium flex items-center px-4 py-2 rounded-lg shadow-sm transition-colors"><DocumentTextIcon className="h-5 w-5 mr-2" />View Summary</button>
                        </div>
                    </div>
                    
                    <div className="border-b border-slate-200">
                        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                            <button onClick={() => setActiveMeter('meter-1')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeMeter === 'meter-1' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                                EB Meter 01
                            </button>
                            <button onClick={() => setActiveMeter('meter-2')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeMeter === 'meter-2' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                                EB Meter 02
                            </button>
                        </nav>
                    </div>

                    <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
                        {displayedReadings.length === 0 ? (
                            <div className="text-center py-16">
                                <DocumentTextIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-slate-700">No Readings Found for {activeMeter === 'meter-1' ? 'Meter 1' : 'Meter 2'}</h3>
                                <p className="text-slate-500 mt-2">Upload a reading for this meter to get started.</p>
                                <Link href="/eb-upload" className="mt-6 inline-block bg-indigo-600 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm hover:bg-indigo-700">
                                    Upload Reading
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                {displayedReadings.map((reading, index) => {
                                    // அடுத்த நாள் என்பது, வரிசைப்படுத்தப்பட்ட array-ல் அதற்கு முந்தைய index-ல் இருக்கும்
                                    const nextDayReading = index > 0 ? displayedReadings[index - 1] : null;
                                    return (
                                        <EBReadingCard 
                                            key={reading._id} 
                                            reading={reading} 
                                            nextDayMorningUnits={nextDayReading?.morningUnits} 
                                            onUpdate={handleUnitUpdate} 
                                            onImageZoom={(url) => setZoomedImageUrl(url as string)} 
                                            onHistoryOpen={handleHistoryOpen}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}