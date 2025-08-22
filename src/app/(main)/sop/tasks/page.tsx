'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
// --- ADDED Calendar and CalendarDays ---
import { ListChecks, CheckCircle2, Calendar, CalendarDays, Loader2 } from 'lucide-react';
import ChecklistSubmissionModal from '../components/ChecklistSubmissionModal'; // Adjust path
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { format } from 'date-fns';

// Define types for better code
type ChecklistType = 'daily' | 'weekly' | 'monthly';

// Fetcher remains the same
const fetcherWithAuth = async (url: string, tenantId: string) => {
    const headers = new Headers();
    headers.append('x-tenant-id', tenantId);
    const res = await fetch(url, { headers });
    if (!res.ok) {
        const errorInfo = await res.json();
        throw new Error(errorInfo.message || 'Failed to load tasks.');
    }
    return res.json();
};

// --- RENAMED the component ---
export default function MyTasksPage() {
    const { data: session } = useSession();
    const [selectedChecklist, setSelectedChecklist] = useState(null);

    // --- STEP 1: ADDED state for active tab ---
    const [activeTab, setActiveTab] = useState<ChecklistType>('daily');

    // --- STEP 2: MADE the API URL dynamic ---
    // Note the path change to /api/checklists/ for consistency
   const apiUrl = session ? `/api/sop/checklist/${activeTab}` : null;
    const { data: checklists, error, mutate } = useSWR(apiUrl, (url) => fetcherWithAuth(url, session!.user.tenantId));

    const canSubmit = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.SOP_SUBMIT_CHECKLIST);

    const handleSuccess = () => {
        setSelectedChecklist(null);
        mutate(); // Re-fetch data for the current active tab
    };

    if (!canSubmit) {
        return <p className="p-6 text-gray-500">You do not have any tasks assigned.</p>;
    }

    const tabStyles = "flex-1 text-center px-4 py-2.5 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-2";
    const activeTabStyles = "bg-blue-600 text-white shadow";
    const inactiveTabStyles = "text-gray-600 hover:bg-gray-200";

    return (
        <>
            <div className="max-w-4xl mx-auto p-4 md:p-6">
                <div className="mb-6">
                    {/* --- STEP 3: UPDATED the title --- */}
                    <h1 className="text-3xl font-bold">My Checklists</h1>
                    <p className="text-gray-500 mt-1">Tasks to be completed for {format(new Date(), 'eeee, MMMM d')}</p>
                </div>

                {/* --- STEP 4: ADDED the tab navigation --- */}
                <div className="flex space-x-2 p-1 bg-gray-100 rounded-lg mb-6">
                    <button onClick={() => setActiveTab('daily')} className={`${tabStyles} ${activeTab === 'daily' ? activeTabStyles : inactiveTabStyles}`}>
                        <ListChecks size={16} /> Daily
                    </button>
                    <button onClick={() => setActiveTab('weekly')} className={`${tabStyles} ${activeTab === 'weekly' ? activeTabStyles : inactiveTabStyles}`}>
                        <CalendarDays size={16} /> Weekly
                    </button>
                    <button onClick={() => setActiveTab('monthly')} className={`${tabStyles} ${activeTab === 'monthly' ? activeTabStyles : inactiveTabStyles}`}>
                        <Calendar size={16} /> Monthly
                    </button>
                </div>

                <div className="bg-white rounded-lg shadow p-6 min-h-[200px]">
                    {error && <div className="text-red-500 text-center">{error.message}</div>}
                    {!checklists && !error && (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 className="animate-spin text-gray-400" size={32}/>
                        </div>
                    )}
                    
                    {checklists && checklists.length === 0 && (
                        <div className="text-center py-8">
                            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                            <h3 className="mt-2 text-lg font-medium text-gray-900">All tasks completed!</h3>
                            <p className="mt-1 text-sm text-gray-500">You have no pending {activeTab} checklists for this period.</p>
                        </div>
                    )}
                    
                    {checklists && checklists.length > 0 && (
                         <ul className="space-y-3">
                            {checklists.map((checklist: any) => (
                                <li key={checklist._id} className="flex justify-between items-center p-4 rounded-md bg-gray-50 border">
                                    <div className="flex items-center gap-4">
                                        <ListChecks className="text-gray-500 h-6 w-6" />
                                        <div>
                                            <p className="font-semibold text-gray-800">{checklist.title}</p>
                                            <p className="text-sm text-gray-500">{checklist.description}</p>
                                        </div>
                                    </div>
                                    {checklist.submitted ? (
                                        <div className="flex items-center gap-2 text-green-600 font-semibold">
                                            <CheckCircle2 size={20} />
                                            <span>Completed</span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setSelectedChecklist(checklist)}
                                            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            Start Task
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {selectedChecklist && (
                <ChecklistSubmissionModal
                    checklist={selectedChecklist}
                    onClose={() => setSelectedChecklist(null)}
                    onSuccess={handleSuccess}
                />
            )}
        </>
    );
}