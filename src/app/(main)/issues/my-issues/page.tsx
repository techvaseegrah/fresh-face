'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { CheckCircle2, Loader2, RefreshCw, AlertTriangle, ArrowUp, ArrowRight, ArrowDown, Clock, Inbox } from 'lucide-react';
import IssueSubmissionModal from '@/app/(main)/issues/components/IssueSubmissionModal';
import { format } from 'date-fns';
import React from 'react';

// --- Type Definitions ---
interface IssueForMyIssues {
    _id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low' | 'none';
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

// --- Main Component ---
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

    // --- Helper Components for Styling ---

    const PriorityBadge = ({ priority }: { priority: 'high' | 'medium' | 'low' | 'none' }) => {
        const styles = {
            high: 'text-red-700 bg-red-100',
            medium: 'text-amber-700 bg-amber-100',
            low: 'text-sky-700 bg-sky-100',
            none: 'text-gray-600 bg-gray-100'
        };
        const text = {
            high: 'High',
            medium: 'Medium',
            low: 'Low',
            none: 'None'
        };
        if (priority === 'none') return null;

        return (
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${styles[priority]}`}>
                {text[priority]}
            </span>
        );
    };

    const StatusDisplay = ({ issue }: { issue: IssueForMyIssues }) => {
        if (issue.submission?.status === 'rejected') {
            return (
                <button onClick={() => handleStartIssue(issue, true)} className="w-full btn-danger-outline flex items-center justify-center gap-2 transition-all hover:bg-red-600 hover:text-white">
                    <RefreshCw size={16} /> Resubmit
                </button>
            );
        }
        if (issue.submission?.status === 'pending_review') {
            return (
                <div className="flex items-center justify-center gap-2 text-amber-600 font-semibold bg-amber-50 rounded-md py-2.5 text-sm">
                    <Clock size={16} />
                    <span>Awaiting Review</span>
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
        return (
            <button onClick={() => handleStartIssue(issue)} className="w-full btn-primary">
                Start Issue
            </button>
        );
    };

    const FilterButton = ({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) => {
        const isActive = priorityFilter === value;
        const baseClasses = "px-4 py-2 text-sm font-semibold rounded-md flex items-center gap-2 transition-all duration-200";
        const activeClasses = "bg-blue-600 text-white shadow";
        const inactiveClasses = "bg-white text-gray-600 hover:bg-gray-100";
        
        return (
            <button onClick={() => setPriorityFilter(value as any)} className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}>
                {Icon && <Icon size={16} />}
                {label}
            </button>
        );
    };

    // --- Render Logic ---

    if (sessionStatus === 'loading' || (!issues && !error)) {
        return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-gray-500" size={40}/></div>;
    }

    return (
        <>
            <div className="bg-slate-50 min-h-screen">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-4xl font-bold text-gray-800 tracking-tight">My Daily Issues</h1>
                        <p className="text-gray-500 mt-2 text-lg">Here are the tasks assigned to you for {format(new Date(), 'eeee, MMMM d')}.</p>
                    </div>

                    {/* Filters */}
                    <div className="bg-white p-2 rounded-lg shadow-sm flex items-center space-x-2 mb-8 max-w-max">
                        <FilterButton label="All" value="all" />
                        <FilterButton label="High" value="high" icon={ArrowUp} />
                        <FilterButton label="Medium" value="medium" icon={ArrowRight} />
                        <FilterButton label="Low" value="low" icon={ArrowDown} />
                    </div>

                    {/* Error State */}
                    {error && (
                        <div className="text-red-600 p-4 bg-red-50 rounded-lg border border-red-200 flex items-center gap-3">
                            <AlertTriangle className="h-6 w-6"/>
                            <div>
                                <h3 className="font-bold">Error Loading Issues</h3>
                                <p>{error.message}</p>
                            </div>
                        </div>
                    )}
                    
                    {/* Empty State */}
                    {issues && issues.length === 0 && (
                        <div className="text-center py-20 px-6 bg-white rounded-lg shadow-sm border">
                            <Inbox className="h-16 w-16 text-gray-400 mx-auto" strokeWidth={1} />
                            <h3 className="mt-4 text-xl font-semibold text-gray-900">You're all clear!</h3>
                            <p className="mt-2 text-md text-gray-500">There are no pending issues with the current filter.</p>
                        </div>
                    )}

                    {/* Issues Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {issues && issues.map((issue) => {
                            const priorityBorders = {
                                high: 'border-t-4 border-red-500',
                                medium: 'border-t-4 border-amber-500',
                                low: 'border-t-4 border-sky-500',
                                none: 'border-t-4 border-gray-300'
                            };
                            return (
                                <div 
                                    key={issue._id} 
                                    className={`bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col ${priorityBorders[issue.priority]}`}
                                >
                                    <div className="p-5 flex-grow">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-lg font-bold text-gray-800 pr-2">{issue.title}</h3>
                                            <PriorityBadge priority={issue.priority} />
                                        </div>
                                        <p className="text-sm text-gray-600 line-clamp-2">{issue.description}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50/70 rounded-b-lg">
                                        <StatusDisplay issue={issue} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Modal */}
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