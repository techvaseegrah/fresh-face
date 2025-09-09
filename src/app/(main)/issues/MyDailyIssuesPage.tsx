// src/app/(main)/issues/MyDailyIssuesPage.tsx

'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { CheckCircle2, Loader2, RefreshCw, AlertTriangle, ArrowUp, ArrowRight, ArrowDown, Clock } from 'lucide-react';
import IssueSubmissionModal from '@/app/(main)/issues/components/IssueSubmissionModal';
import { format } from 'date-fns';
import React from 'react';

// --- Type Definitions ---
interface IssueForMyIssues {
    _id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low' | 'none';
    // ✅ FIX: Add checklistItems to the type so it can be passed to the modal.
    checklistItems: {
        _id: string;
        questionText: string;
        responseType: 'yes_no' | 'yes_no_remarks';
        mediaUpload: 'none' | 'optional' | 'required';
    }[];
    submission?: { 
        _id: string; 
        status: 'pending_review' | 'approved' | 'rejected'; 
    } | null;
}
const fetcherWithAuth = async ([url, tenantId]: [string, string]) => {
    const headers = new Headers({ 'x-tenant-id': tenantId });
    const res = await fetch(url, { headers });
    if (!res.ok) {
        const errorInfo = await res.json();
        throw new Error(errorInfo.message || 'Failed to load issues.');
    }
    return res.json();
};

export default function MyDailyIssuesPage() {
    const { data: session, status: sessionStatus } = useSession();
    const [selectedIssue, setSelectedIssue] = useState<IssueForMyIssues | null>(null);
    const [isResubmitting, setIsResubmitting] = useState(false);
    const [priorityFilter, setPriorityFilter] = useState<'high' | 'medium' | 'low' | 'all'>('all');

    const tenantId = session?.user?.tenantId;
    const apiUrl = tenantId ? `/api/issue/my-issues?priority=${priorityFilter === 'all' ? '' : priorityFilter}` : null;
    
    const { data: issues, error, mutate } = useSWR<IssueForMyIssues[]>(
        apiUrl ? [apiUrl, tenantId] : null, 
        fetcherWithAuth
    );
    
    const handleSuccess = (response: any) => {
        setSelectedIssue(null);
        setIsResubmitting(false);
        mutate();
        toast.success(response.message || "Issue submitted successfully! It is now awaiting review.");
    };

    const handleStartIssue = (issue: IssueForMyIssues, isRejected = false) => {
        setIsResubmitting(isRejected);
        setSelectedIssue(issue);
    };

    // ✅ FIX: This component now correctly displays all possible statuses.
    const StatusDisplay = ({ issue }: { issue: IssueForMyIssues }) => {
        if (issue.submission?.status === 'rejected') {
            return (
                <button onClick={() => handleStartIssue(issue, true)} className="w-full btn-danger flex items-center justify-center gap-2">
                    <RefreshCw size={16} /> Resubmit Issue
                </button>
            );
        }
        if (issue.submission?.status === 'pending_review') {
            return (
                <div className="flex items-center justify-center gap-2 text-yellow-700 font-semibold bg-yellow-50 border border-yellow-200 rounded-md py-2 text-sm">
                    <Clock size={16} />
                    <span>Pending Review</span>
                </div>
            );
        }
        if (issue.submission?.status === 'approved') {
            return (
                <div className="flex items-center justify-center gap-2 text-green-600 font-semibold">
                    <CheckCircle2 size={18} />
                    <span>Approved</span>
                </div>
            );
        }
        // Default: The issue has not been submitted yet.
        return (
            <button onClick={() => handleStartIssue(issue)} className="w-full btn-primary">
                Start Issue
            </button>
        );
    };

    if (sessionStatus === 'loading') {
        return <div className="p-6 flex justify-center"><Loader2 className="animate-spin text-gray-400" size={32}/></div>;
    }

    return (
        <>
            <div className="p-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold">My Daily Issues</h1>
                    <p className="text-gray-500 mt-1">Issues assigned to you for {format(new Date(), 'eeee, MMMM d')}</p>
                </div>
                 <div className="flex space-x-2 mb-6">
                    <button onClick={() => setPriorityFilter('all')} className={priorityFilter === 'all' ? 'btn-primary' : 'btn-secondary'}>All</button>
                    <button onClick={() => setPriorityFilter('high')} className={`${priorityFilter === 'high' ? 'bg-red-600 text-white' : 'bg-white text-gray-700'} btn flex items-center gap-1.5`}><ArrowUp size={16}/> High</button>
                    <button onClick={() => setPriorityFilter('medium')} className={`${priorityFilter === 'medium' ? 'bg-yellow-500 text-white' : 'bg-white text-gray-700'} btn flex items-center gap-1.5`}><ArrowRight size={16}/> Medium</button>
                    <button onClick={() => setPriorityFilter('low')} className={`${priorityFilter === 'low' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'} btn flex items-center gap-1.5`}><ArrowDown size={16}/> Low</button>
                </div>

                {error && <div className="text-red-500 p-4 bg-red-50 rounded-lg"><AlertTriangle className="inline-block mr-2"/>{error.message}</div>}
                {!issues && !error && <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-400" size={32}/></div>}

                {issues && issues.length === 0 && (
                    <div className="text-center py-10 bg-white rounded-lg shadow">
                        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                        <h3 className="mt-2 text-lg font-medium text-gray-900">All Done!</h3>
                        <p className="mt-1 text-sm text-gray-500">You have no pending issues for this filter.</p>
                    </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {issues && issues.map((issue) => (
                        <div key={issue._id} className="bg-white rounded-lg shadow p-5 flex flex-col justify-between">
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-lg font-bold text-gray-800 pr-2">{issue.title}</h3>
                                    {issue.priority === 'high' && <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded-full flex-shrink-0">High</span>}
                                    {issue.priority === 'medium' && <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full flex-shrink-0">Medium</span>}
                                    {issue.priority === 'low' && <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded-full flex-shrink-0">Low</span>}
                                </div>
                                <p className="text-sm text-gray-500 mt-1 h-10 overflow-hidden">{issue.description}</p>
                            </div>
                            <div className="mt-4 pt-4 border-t">
                                <StatusDisplay issue={issue} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {selectedIssue && (
                <IssueSubmissionModal
                    issue={selectedIssue}
                    isResubmitting={isResubmitting}
                    onClose={() => setSelectedIssue(null)}
                    onSuccess={handleSuccess}
                />
            )}
        </>
    );
}