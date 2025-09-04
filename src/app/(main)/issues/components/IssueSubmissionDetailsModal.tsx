'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { XCircle, CheckCircle, Paperclip, Loader2, MessageSquare, AlertTriangle, HelpCircle, X } from 'lucide-react';

interface EnrichedSubmission {
    _id: string; 
    checklistTitle: string; 
    status: 'pending_review' | 'approved' | 'rejected';
    responses: {
        answer: 'yes' | 'no' | '';
        remarks?: string;
        mediaUrl?: string;
    }[];
}
export interface IssueModalDetails {
    staffName: string;
    date: Date;
    submissions: EnrichedSubmission[];
}
interface IssueSubmissionDetailsModalProps {
    details: IssueModalDetails;
    onClose: () => void;
    onActionSuccess: () => void; 
}

export default function IssueSubmissionDetailsModal({ details, onClose, onActionSuccess }: IssueSubmissionDetailsModalProps) {
    const { data: session } = useSession();
    const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});

    const handleAction = async (submissionId: string, newStatus: 'approved' | 'rejected') => {
        if (!session) { toast.error("Session expired."); return; }
        setIsSubmitting(prev => ({ ...prev, [submissionId]: true }));
        try {
            const res = await fetch('/api/issue/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-tenant-id': session.user.tenantId },
                body: JSON.stringify({ submissionId, newStatus }),
            });
            const result = await res.json();
            if (!res.ok || !result.success) throw new Error(result.message || 'Failed to update status.');
            toast.success(`Submission has been ${newStatus}.`);
            onActionSuccess();
            onClose(); // Close modal on success
        } catch (error: any) {
            toast.error(error.message);
            setIsSubmitting(prev => ({ ...prev, [submissionId]: false }));
        }
    };
    
    const StatusChip = ({ status }: { status: EnrichedSubmission['status'] }) => {
        switch (status) {
            case 'approved': return <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full"><CheckCircle className="h-4 w-4" /> Approved</span>;
            case 'rejected': return <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full"><XCircle className="h-4 w-4" /> Rejected</span>;
            default: return <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full"><HelpCircle className="h-4 w-4" /> Awaiting Review</span>;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-start pt-10 sm:items-center sm:pt-0" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">{details.staffName}'s Submissions</h3>
                        <p className="text-sm text-gray-500">{format(details.date, 'EEEE, MMMM d, yyyy')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full"><X className="h-6 w-6"/></button>
                </div>

                <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
                    {details.submissions.length > 0 ? details.submissions.map(sub => (
                        <div key={sub._id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex justify-between items-start">
                                <h4 className="text-base font-semibold text-gray-800">{sub.checklistTitle}</h4>
                                <StatusChip status={sub.status} />
                            </div>
                            
                            {/* ✅ THE FIX: This block now correctly renders the submission details. */}
                            {sub.responses && sub.responses.length > 0 ? (
                                <div className="mt-3 space-y-3 text-sm border-t pt-3">
                                    {sub.responses.map((response, index) => (
                                      <React.Fragment key={index}>
                                        <div className="flex justify-between items-center gap-4">
                                            <p className="text-gray-600 font-medium">Is the issue resolved?</p>
                                            <span className={`font-bold capitalize px-2 py-0.5 rounded text-xs ${response.answer === 'yes' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{response.answer || 'N/A'}</span>
                                        </div>
                                        {response.remarks && (
                                            <div className="flex items-start gap-2 text-gray-600">
                                                <MessageSquare size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
                                                <p className="italic bg-gray-50 p-2 rounded w-full">"{response.remarks}"</p>
                                            </div>
                                        )}
                                        {response.mediaUrl && (
                                            <div className="flex items-start gap-2">
                                                 <Paperclip size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
                                                 <a href={response.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View Attached Proof</a>
                                            </div>
                                        )}
                                      </React.Fragment>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic mt-2 border-t pt-2">This issue was submitted without details.</p>
                            )}

                            {sub.status === 'pending_review' && (
                                <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
                                    <button onClick={() => handleAction(sub._id, 'rejected')} disabled={isSubmitting[sub._id]} className="px-4 py-1.5 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-red-400 flex items-center justify-center w-24">
                                        {isSubmitting[sub._id] ? <Loader2 size={16} className="animate-spin" /> : 'Reject'}
                                    </button>
                                    <button onClick={() => handleAction(sub._id, 'approved')} disabled={isSubmitting[sub._id]} className="px-4 py-1.5 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-green-400 flex items-center justify-center w-24">
                                        {isSubmitting[sub._id] ? <Loader2 size={16} className="animate-spin" /> : 'Approve'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )) : (
                         <div className="text-center py-10">
                            <AlertTriangle className="mx-auto h-10 w-10 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No Submissions Found</h3>
                            <p className="mt-1 text-sm text-gray-500">There are no issue submissions to display for this staff member on this date.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}