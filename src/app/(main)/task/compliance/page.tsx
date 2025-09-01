// src/app/(main)/task/compliance/page.tsx - FINAL CORRECTED VERSION

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { CheckCircleIcon, XCircleIcon, MinusCircleIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { Eye, Loader2 } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- Interfaces (No changes needed) ---
interface Staff { _id: string; name: string; }
interface Submission {
  _id: string; taskName: string; assignedTo: string; dueDate: string;
  status: 'Awaiting Review' | 'Approved' | 'Rejected';
  checklistAnswers: {
    _id: string; questionText: string; answer: 'Yes' | 'No' | null;
    remarks?: string; mediaUrl?: string;
  }[];
}
interface AssignedTask { assignedTo: string; dueDate: string; }
interface ReportData { staff: Staff[]; submissions: Submission[]; assignedTasks: AssignedTask[]; }
interface ReviewModalData { staffName: string; date: Date; submissions: Submission[]; staffId: string; }

// --- Reusable Fetcher (No changes needed) ---
const fetcher = async (url: string, tenantId: string) => {
    const res = await fetch(url, { headers: { 'x-tenant-id': tenantId } });
    if (!res.ok) {
      const errorInfo = await res.json();
      throw new Error(errorInfo.error || 'Failed to load report data.');
    }
    return res.json();
};

// --- Review Modal Component (Corrected) ---
const ReviewModal = ({ data, onClose, onActionSuccess }: { data: ReviewModalData | null, onClose: () => void, onActionSuccess: () => void }) => {
    const { data: session } = useSession();
    const [isSubmitting, setIsSubmitting] = useState(false);
    if (!data) return null;

    const handleAction = async (newStatus: 'Approved' | 'Rejected') => {
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/tasks/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-tenant-id': session!.user.tenantId! },
                body: JSON.stringify({ staffId: data.staffId, date: data.date.toISOString(), newStatus })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || `Failed to ${newStatus.toLowerCase()} submission.`);
            toast.success(`Submission has been ${newStatus.toLowerCase()}!`);
            onActionSuccess();
            onClose();
        // --- FIX WAS HERE: Removed the incorrect "a =>" ---
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">{data.staffName}'s Submissions</h3>
                        <p className="text-sm text-gray-500">{format(data.date, 'EEEE, MMMM d, yyyy')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 rounded-full"><XCircleIcon className="h-6 w-6"/></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    {data.submissions.map(sub => (
                        <div key={sub._id} className="bg-gray-50 p-4 rounded-md border">
                            <h4 className="font-semibold text-gray-700">{sub.taskName}</h4>
                            <div className="mt-2 space-y-2 text-sm">
                                {sub.checklistAnswers?.map((ans, index) => (
                                    <div key={index} className="flex justify-between items-start gap-4 py-1">
                                        <p className="flex-1 text-gray-600">{index + 1}. {ans.questionText}</p>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold px-2 py-0.5 rounded text-xs ${ans.answer === 'Yes' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{ans.answer}</span>
                                            {ans.mediaUrl && <a href={ans.mediaUrl} target="_blank" rel="noopener noreferrer" title="View Media"><Eye size={16} className="text-blue-500"/></a>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
                    <button onClick={() => handleAction('Rejected')} disabled={isSubmitting} className="px-5 py-2 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">Reject</button>
                    <button onClick={() => handleAction('Approved')} disabled={isSubmitting} className="px-5 py-2 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50">Approve</button>
                </div>
            </div>
        </div>
    );
};

// --- Main Page Component (No changes from before) ---
const TaskCompliancePage = () => {
    const { data: session, status: sessionStatus } = useSession();
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'review' | 'all'>('review');
    const [reviewModalData, setReviewModalData] = useState<ReviewModalData | null>(null);

    const fetchReport = useCallback(async () => {
        if (sessionStatus !== 'authenticated' || !startDate || !endDate) return;
        setIsLoading(true);
        setError(null);
        try {
            const apiUrl = `/api/tasks?view=reportGrid&startDate=${startDate}&endDate=${endDate}`;
            const result = await fetcher(apiUrl, session!.user.tenantId!);
            if (result.success) {
                setReportData(result.data);
            } else {
                throw new Error(result.error);
            }
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [sessionStatus, startDate, endDate, session]);

    useEffect(() => { fetchReport(); }, [fetchReport]);

    const datesInRange = useMemo(() => {
        try { return eachDayOfInterval({ start: new Date(startDate), end: new Date(endDate) }); } 
        catch { return []; }
    }, [startDate, endDate]);

    const filteredStaff = useMemo(() => {
        if (!reportData || filter === 'all') return reportData?.staff || [];
        return reportData.staff.filter(staff => {
            return reportData.submissions.some(sub => sub.assignedTo === staff._id && sub.status === 'Awaiting Review');
        });
    }, [reportData, filter]);

    const handleViewDetails = (staff: Staff, date: Date) => {
        if (!reportData) return;
        const dateString = format(date, 'yyyy-MM-dd');
        const submissionsForDay = reportData.submissions.filter(s => s.assignedTo === staff._id && format(new Date(s.dueDate), 'yyyy-MM-dd') === dateString);
        setReviewModalData({ staffName: staff.name, date, submissions: submissionsForDay, staffId: staff._id });
    };

    return (
        <div className="p-6 sm:p-8 bg-gray-50 min-h-screen">
            <ToastContainer position="top-right" autoClose={3000} />
            {reviewModalData && <ReviewModal data={reviewModalData} onClose={() => setReviewModalData(null)} onActionSuccess={fetchReport} />}
            
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Task Compliance Report</h1>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-4">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input text-sm"/>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input text-sm"/>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setFilter('review')} className={`px-4 py-2 text-sm font-semibold rounded-md ${filter === 'review' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>Awaiting Review</button>
                    <button onClick={() => setFilter('all')} className={`px-4 py-2 text-sm font-semibold rounded-md ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>Show All</button>
                </div>
            </div>

            {isLoading ? <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-gray-400" size={32} /></div> :
            error ? <div className="p-10 text-center text-red-500 bg-white rounded-lg shadow">{error}</div> :
            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">Staff Member</th>
                            {datesInRange.map(date => (<th key={date.toISOString()} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{format(date, 'MMM d')}</th>))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredStaff.map((staff) => (
                            <tr key={staff._id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white hover:bg-gray-50 z-10">{staff.name}</td>
                                {datesInRange.map(date => {
                                    const dateString = format(date, 'yyyy-MM-dd');
                                    const wasTaskAssigned = reportData!.assignedTasks.some(t => t.assignedTo === staff._id && format(new Date(t.dueDate), 'yyyy-MM-dd') === dateString);
                                    const submissions = reportData!.submissions.filter(s => s.assignedTo === staff._id && format(new Date(s.dueDate), 'yyyy-MM-dd') === dateString);
                                    
                                    let icon = <MinusCircleIcon className="h-6 w-6 text-gray-300" />;
                                    let isClickable = false;

                                    if (submissions.length > 0) {
                                        isClickable = true;
                                        if (submissions.some(s => s.status === 'Awaiting Review')) icon = <ClockIcon className="h-6 w-6 text-yellow-500" />;
                                        else if (submissions.some(s => s.status === 'Rejected')) icon = <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />;
                                        else icon = <CheckCircleIcon className="h-6 w-6 text-green-500" />;
                                    } else if (wasTaskAssigned) {
                                        icon = <XCircleIcon className="h-6 w-6 text-red-400" />;
                                    }

                                    return (
                                        <td key={date.toISOString()} className="px-6 py-4 text-center">
                                            <div className={`flex justify-center items-center ${isClickable ? 'cursor-pointer' : ''}`} onClick={isClickable ? () => handleViewDetails(staff, date) : undefined}>
                                                {icon}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>}
        </div>
    );
};

export default TaskCompliancePage;