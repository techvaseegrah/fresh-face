'use client';

import { useState } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { useSession } from 'next-auth/react';
// --- ADDED ---: Import toast from react-toastify
import { toast } from 'react-toastify';
import { ListChecks, CheckCircle2, Calendar, CalendarDays, Loader2, Clock, XCircle, RefreshCw } from 'lucide-react';
import ChecklistSubmissionModal from '../components/ChecklistSubmissionModal';
// --- ADDED ---: Import your new confirmation dialog
import ConfirmDialog from '@/components/ConfirmDialog'; // Adjust path if needed
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// --- ROBUSTNESS: Define all necessary types within this file for clarity ---
interface ChecklistItem {
    _id: string;
    questionText: string;
    responseType: 'yes_no' | 'yes_no_remarks';
    mediaUpload: 'none' | 'optional' | 'required';
}

// Type for the data as it comes from the API. `checklistItems` can be undefined.
interface ChecklistFromApi {
  _id: string;
  title: string;
  description: string;
  checklistItems?: ChecklistItem[]; // Optional property
  submission?: {
    _id: string;
    status: 'pending_review' | 'approved' | 'rejected';
    reviewNotes?: string;
  } | null;
}

// Type for a checklist that has been validated and is ready to be sent to the modal.
// `checklistItems` is a REQUIRED property for the modal to function.
type ChecklistForModal = Omit<ChecklistFromApi, 'checklistItems'> & {
  checklistItems: ChecklistItem[]; // Required property
};

type ChecklistType = 'daily' | 'weekly' | 'monthly';

// --- Fetcher function for useSWR ---
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

const NotificationBadge = ({ count }: { count: number }) => {
    return (
        <AnimatePresence>
            {count > 0 && (
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center pointer-events-none"
                >
                    {count}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default function MyTasksPage() {
    const { data: session } = useSession();
    const [selectedChecklist, setSelectedChecklist] = useState<ChecklistForModal | null>(null);
    const [isResubmitting, setIsResubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<ChecklistType>('daily');

    const apiUrl = session ? `/api/sop/checklist/${activeTab}` : null;
    const { data: checklists, error, mutate } = useSWR<ChecklistFromApi[]>(apiUrl, (url: string) => fetcherWithAuth(url, session!.user.tenantId));

    // Data fetching for counts
    const { data: dailyCountData } = useSWR(
        session ? `/api/sop/checklist/pending-count?type=daily` : null,
        (url: string) => fetcherWithAuth(url, session!.user.tenantId)
    );
    const { data: weeklyCountData } = useSWR(
        session ? `/api/sop/checklist/pending-count?type=weekly` : null,
        (url: string) => fetcherWithAuth(url, session!.user.tenantId)
    );
    const { data: monthlyCountData } = useSWR(
        session ? `/api/sop/checklist/pending-count?type=monthly` : null,
        (url: string) => fetcherWithAuth(url, session!.user.tenantId)
    );

    const canSubmit = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.SOP_SUBMIT_CHECKLIST);

    const handleSuccess = () => {
        setSelectedChecklist(null);
        setIsResubmitting(false);
        mutate();
        globalMutate(`/api/sop/checklist/pending-count?type=daily`);
        globalMutate(`/api/sop/checklist/pending-count?type=weekly`);
        globalMutate(`/api/sop/checklist/pending-count?type=monthly`);
    };

    const handleStartTask = (checklist: ChecklistFromApi) => {
        if (!checklist.checklistItems || checklist.checklistItems.length === 0) {
            toast.error("This checklist has no tasks defined. Please contact an administrator.");
            return;
        }
        setIsResubmitting(false);
        setSelectedChecklist(checklist as ChecklistForModal);
    };

    // --- UPDATED: Uses a custom react-toastify dialog instead of window.confirm ---
    const handleResubmit = (checklist: ChecklistFromApi) => {
        if (!checklist.checklistItems || checklist.checklistItems.length === 0) {
            toast.error("This checklist has no tasks defined.");
            return;
        }

        const confirmAndProceed = () => {
            setIsResubmitting(true);
            setSelectedChecklist(checklist as ChecklistForModal);
            toast.dismiss(); // Close the confirmation toast
        };

        const cancel = () => {
            toast.dismiss(); // Close the confirmation toast
        };

        // Render our custom component inside the toast
        toast.info(
            <ConfirmDialog
                message="Do you want to re-submit this rejected task?"
                feedback={checklist.submission?.reviewNotes || 'No feedback was provided.'}
                onConfirm={confirmAndProceed}
                onCancel={cancel}
            />,
            {
                position: "top-center",
                autoClose: false,
                closeOnClick: false,
                draggable: false,
                closeButton: true,
            }
        );
    };

    if (!canSubmit) {
        return <p className="p-6 text-gray-500">You do not have any tasks assigned.</p>;
    }

    const tabStyles = "relative flex-1 text-center px-4 py-2.5 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-2";
    const activeTabStyles = "bg-blue-600 text-white shadow";
    const inactiveTabStyles = "text-gray-600 hover:bg-gray-200";

    return (
        <>
            <div className="max-w-4xl mx-auto p-4 md:p-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold">My Checklists</h1>
                    <p className="text-gray-500 mt-1">Tasks to be completed for {format(new Date(), 'eeee, MMMM d')}</p>
                </div>

                <div className="flex space-x-2 p-1 bg-gray-100 rounded-lg mb-6">
                    <button onClick={() => setActiveTab('daily')} className={`${tabStyles} ${activeTab === 'daily' ? activeTabStyles : inactiveTabStyles}`}>
                        <span className="flex items-center gap-2"><ListChecks size={16} /> Daily</span>
                        <NotificationBadge count={dailyCountData?.pendingCount || 0} />
                    </button>
                    <button onClick={() => setActiveTab('weekly')} className={`${tabStyles} ${activeTab === 'weekly' ? activeTabStyles : inactiveTabStyles}`}>
                         <span className="flex items-center gap-2"><CalendarDays size={16} /> Weekly</span>
                        <NotificationBadge count={weeklyCountData?.pendingCount || 0} />
                    </button>
                    <button onClick={() => setActiveTab('monthly')} className={`${tabStyles} ${activeTab === 'monthly' ? activeTabStyles : inactiveTabStyles}`}>
                         <span className="flex items-center gap-2"><Calendar size={16} /> Monthly</span>
                        <NotificationBadge count={monthlyCountData?.pendingCount || 0} />
                    </button>
                </div>

                <div className="bg-white rounded-lg shadow p-6 min-h-[200px]">
                    {error && <div className="text-red-500 text-center">{error.message}</div>}
                    {!checklists && !error && (
                        <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-gray-400" size={32}/></div>
                    )}
                    
                    {Array.isArray(checklists) && checklists.length === 0 && (
                        <div className="text-center py-8">
                            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                            <h3 className="mt-2 text-lg font-medium text-gray-900">All tasks completed!</h3>
                            <p className="mt-1 text-sm text-gray-500">You have no pending {activeTab} checklists for this period.</p>
                        </div>
                    )}
                    
                    {Array.isArray(checklists) && checklists.length > 0 && (
                         <ul className="space-y-3">
                            {checklists.map((checklist: ChecklistFromApi) => {
                                const status = checklist.submission?.status;
                                return (
                                <li key={checklist._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-md bg-gray-50 border gap-4">
                                    <div className="flex items-center gap-4 w-full">
                                        <ListChecks className="text-gray-500 h-6 w-6 flex-shrink-0" />
                                        <div className="flex-grow">
                                            <p className="font-semibold text-gray-800">{checklist.title}</p>
                                            <p className="text-sm text-gray-500">{checklist.description}</p>
                                        </div>
                                    </div>
                                    <div className="w-full sm:w-auto flex-shrink-0">
                                        {status === 'approved' ? (
                                            <div className="flex items-center justify-center gap-2 text-green-600 font-semibold bg-green-100 px-3 py-1.5 rounded-full text-center">
                                                <CheckCircle2 size={20} /><span>Approved</span>
                                            </div>
                                        ) : status === 'pending_review' ? (
                                            <div className="flex items-center justify-center gap-2 text-yellow-600 font-semibold bg-yellow-100 px-3 py-1.5 rounded-full text-center">
                                                <Clock size={20} /><span>Pending Review</span>
                                            </div>
                                        ) : status === 'rejected' ? (
                                            <button onClick={() => handleResubmit(checklist)} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors">
                                                <RefreshCw size={16} /><span>Re-submit</span>
                                            </button>
                                        ) : (
                                            <button onClick={() => handleStartTask(checklist)} className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                                                Start Task
                                            </button>
                                        )}
                                    </div>
                                </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>

            {selectedChecklist && (
                <ChecklistSubmissionModal
                    checklist={selectedChecklist}
                    isResubmitting={isResubmitting}
                    onClose={() => { setSelectedChecklist(null); setIsResubmitting(false); }}
                    onSuccess={handleSuccess}
                />
            )}
        </>
    );
}