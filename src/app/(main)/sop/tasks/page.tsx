'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { ListChecks, CheckCircle2 } from 'lucide-react';
import ChecklistSubmissionModal from '../components/ChecklistSubmissionModal'; // Adjust path if needed
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { format } from 'date-fns';

// Use the same fetcher with manual header injection
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

export default function MyDailyTasksPage() {
    const { data: session } = useSession();
    const [selectedChecklist, setSelectedChecklist] = useState(null);

    const apiUrl = session ? '/api/sop/checklist/daily' : null;
    const { data: checklists, error, mutate } = useSWR(apiUrl, (url) => fetcherWithAuth(url, session!.user.tenantId));

    // This permission is for submitting, which is what this page is for.
    const canSubmit = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.SOP_SUBMIT_CHECKLIST);

    const handleSuccess = () => {
        setSelectedChecklist(null);
        mutate(); // Re-fetch data to update the status on the page
    };

    if (!canSubmit) {
        return <p className="p-6 text-gray-500">You do not have any daily tasks assigned.</p>;
    }

    return (
        <>
            <div className="p-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold">My Daily Tasks</h1>
                    <p className="text-gray-500 mt-1">Checklists to be completed for {format(new Date(), 'eeee, MMMM d')}</p>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    {error && <div className="text-red-500">{error.message}</div>}
                    {!checklists && !error && <div>Loading tasks...</div>}
                    
                    {checklists && checklists.length === 0 && (
                        <div className="text-center py-8">
                            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                            <h3 className="mt-2 text-lg font-medium text-gray-900">All tasks completed!</h3>
                            <p className="mt-1 text-sm text-gray-500">You have no pending checklists for today.</p>
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