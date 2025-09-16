'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { format, eachDayOfInterval, isAfter, startOfDay } from 'date-fns';
import { CheckCircleIcon, XCircleIcon, MinusCircleIcon, ClockIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import { Loader2, FileDown, FileText, FileSpreadsheet, Paperclip, MessageSquare, Eye, X } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { hasPermission, PERMISSIONS } from '../../../../lib/permissions'; // Path to your permissions file

// --- Type Definitions ---
interface Role { _id: string; displayName: string; }
interface Staff { _id: string; name: string; roleId?: Role; }
interface IssueTemplate { _id: string; title: string; roles: string[]; }
interface Submission {
    _id: string; issue: string; staff: string; submissionDate: string;
    status: 'pending_review' | 'approved' | 'rejected';
    responses: { answer: 'yes' | 'no' | ''; remarks?: string; mediaUrl?: string; }[];
}
interface ReportData { staff: Staff[]; issues: IssueTemplate[]; submissions: Submission[]; }
interface EnrichedSubmission extends Submission { checklistTitle: string; }
interface IssueModalDetails { staffName: string; date: Date; submissions: EnrichedSubmission[]; }

// --- Reusable Components ---
const fetcher = async ([url, tenantId]: [string, string | undefined]) => {
    if (!tenantId) throw new Error("Tenant ID not available.");
    const res = await fetch(url, { headers: { 'x-tenant-id': tenantId } });
    if (!res.ok) { const errorInfo = await res.json(); throw new Error(errorInfo.message || 'Failed to load report data.'); }
    return res.json();
};

const IssueReportDetailsModal = ({ details, onClose }: { details: IssueModalDetails; onClose: () => void; }) => {
    const [viewerSrc, setViewerSrc] = useState<string | null>(null);

    const handleViewAttachment = (e: React.MouseEvent, mediaUrl?: string) => {
        if (!mediaUrl) return;
        const isImage = mediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i);
        if (isImage) {
            e.preventDefault();
            setViewerSrc(mediaUrl);
        }
    };

    return (
        <>
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
                        {details.submissions.map(sub => (
                            <div key={sub._id} className="bg-gray-50 p-4 rounded-lg border">
                                <h4 className="font-semibold text-gray-800">{sub.checklistTitle}</h4>
                                {sub.responses?.map((response, index) => (
                                    <div key={index} className="mt-2 space-y-2 text-sm border-t pt-2">
                                        <div className="flex items-start gap-2 text-gray-600">
                                            <MessageSquare size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
                                            <p className="italic">"{response.remarks || 'No remarks provided.'}"</p>
                                        </div>
                                        {response.mediaUrl && (
                                            <div className="flex items-start gap-2">
                                                <Paperclip size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
                                                <a href={response.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" onClick={(e) => handleViewAttachment(e, response.mediaUrl)}>
                                                    View Attachment
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                     <div className="p-4 border-t bg-gray-50 rounded-b-lg">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <InformationCircleIcon className="h-5 w-5 text-gray-500"/>
                            This is a read-only view. To manage submissions, please visit the main Issues Dashboard.
                        </div>
                    </div>
                </div>
            </div>
            {viewerSrc && (
                <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[60] p-4" onClick={() => setViewerSrc(null)}>
                     <img src={viewerSrc} alt="Attachment Preview" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
                </div>
            )}
        </>
    );
};

// --- Main Page Component ---
export default function IssueComplianceReportPage() {
    const { data: session } = useSession();
    const userPermissions = session?.user?.role?.permissions || [];

    const [endDate, setEndDate] = useState(new Date());
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        return d;
    });

    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'unreviewed' | 'all'>('unreviewed');
    const [reviewModalData, setReviewModalData] = useState<IssueModalDetails | null>(null);

    const fetchReport = useCallback(async () => {
        if (!session?.user?.tenantId) return;
        if (isAfter(startDate, endDate)) {
            toast.error("Start date cannot be after end date.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const apiUrl = `/api/issue/reports/submissions?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
            const result = await fetcher([apiUrl, session.user.tenantId]);
            setReportData(result);
        } catch (err: any) {
            setError(err.message);
            toast.error(`Failed to load report: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [session, startDate, endDate]);

    useEffect(() => { fetchReport(); }, [fetchReport]);

    const datesInRange = useMemo(() => {
        try { return eachDayOfInterval({ start: startDate, end: endDate }); }
        catch { return []; }
    }, [startDate, endDate]);

    const filteredStaff = useMemo(() => {
        if (!reportData) return [];
        if (filter === 'all') return reportData.staff;
        return reportData.staff.filter((staff: Staff) =>
            reportData.submissions.some((sub: Submission) => sub.staff === staff._id && sub.status === 'pending_review')
        );
    }, [reportData, filter]);

    const getStatusForCell = (staff: Staff, date: Date): { status: 'approved' | 'rejected' | 'pending' | 'none'; isClickable: boolean } => {
        if (!reportData) return { status: 'none', isClickable: false };

        const submissionsForDay = reportData.submissions.filter((sub: Submission) =>
            sub.staff === staff._id && format(new Date(sub.submissionDate), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        );

        if (submissionsForDay.length === 0) {
            return { status: 'none', isClickable: false };
        }

        if (submissionsForDay.some((s: Submission) => s.status === 'rejected')) return { status: 'rejected', isClickable: true };
        if (submissionsForDay.some((s: Submission) => s.status === 'pending_review')) return { status: 'pending', isClickable: true };
        if (submissionsForDay.every((s: Submission) => s.status === 'approved')) return { status: 'approved', isClickable: true };
        
        return { status: 'none', isClickable: false };
    };

    const handleViewDetails = (staff: Staff, date: Date) => {
        if (!reportData) return;
        const dateString = format(date, 'yyyy-MM-dd');
        const submissionsForDay = reportData.submissions
            .filter((s: Submission) => s.staff === staff._id && format(new Date(s.submissionDate), 'yyyy-MM-dd') === dateString)
            .map((sub: Submission) => {
                const issueTemplate = reportData.issues.find((issue: IssueTemplate) => issue._id === sub.issue);
                return { ...sub, checklistTitle: issueTemplate?.title || 'Deleted Issue' };
            });

        if (submissionsForDay.length === 0) return;
        setReviewModalData({ staffName: staff.name, date: date, submissions: submissionsForDay });
    };

    const handleDownloadExcel = () => { /* Logic remains the same */ };
    const handleDownloadPdf = () => { /* Logic remains the same */ };

    return (
         <div className="p-4 sm:p-6 lg:p-8 bg-gray-100 min-h-screen">
            <ToastContainer position="top-right" autoClose={3000} />
            <header className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Issue Compliance Report</h1>
                <p className="text-sm text-gray-600 mt-1">Review daily issue submission status across all staff members.</p>
            </header>

            <div className="mb-6 p-4 bg-white rounded-xl shadow-sm border">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                        <label className="font-semibold text-gray-700 text-sm mb-1 block">Start Date</label>
                        <input type="date" value={format(startDate, 'yyyy-MM-dd')} onChange={e => setStartDate(new Date(e.target.value))} className="form-input w-full rounded-md"/>
                    </div>
                    <div>
                        <label className="font-semibold text-gray-700 text-sm mb-1 block">End Date</label>
                        <input type="date" value={format(endDate, 'yyyy-MM-dd')} onChange={e => setEndDate(new Date(e.target.value))} className="form-input w-full rounded-md"/>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="font-semibold text-gray-700 text-sm">Filter & Export</label>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setFilter('unreviewed')} className={`flex-1 px-4 py-2 text-sm font-semibold rounded-md ${filter === 'unreviewed' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Unreviewed</button>
                            <button onClick={() => setFilter('all')} className={`flex-1 px-4 py-2 text-sm font-semibold rounded-md ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>All Staff</button>
                        </div>
                         {hasPermission(userPermissions, PERMISSIONS.REPORT_ISSUE_COMPLIANCE_MANAGE) && (
                             <div className='flex items-center gap-2'>
                                <button onClick={handleDownloadExcel} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm text-green-700 bg-green-100 rounded-md"><FileText size={16}/> Excel</button>
                                <button onClick={handleDownloadPdf} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-700 bg-red-100 rounded-md"><FileDown size={16}/> PDF</button>
                            </div>
                         )}
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
            ) : error ? (
                <div className="p-10 text-center text-red-700 bg-red-50 rounded-xl">{error}</div>
            ) : (
                <div className="overflow-x-auto bg-white rounded-xl shadow-md">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 sticky left-0 bg-gray-50 z-10">Staff Member</th>
                                {datesInRange.map((date: Date) => (<th key={date.toISOString()} className="px-6 py-3 text-center text-xs font-bold">{format(date, 'MMM d')}</th>))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredStaff.map((staff: Staff) => (
                                <tr key={staff._id} className="hover:bg-blue-50/50">
                                    <td className="px-6 py-4 sticky left-0 bg-white hover:bg-blue-50/50 z-10">
                                        <div className="font-semibold">{staff.name}</div>
                                        <div className="text-sm text-gray-500">{staff.roleId?.displayName || 'No Role'}</div>
                                    </td>
                                    {datesInRange.map((date: Date) => {
                                        const { status, isClickable } = getStatusForCell(staff, date);
                                        const iconMap = {
                                            approved: <CheckCircleIcon className="h-6 w-6 text-green-500" />,
                                            rejected: <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />,
                                            pending: <ClockIcon className="h-6 w-6 text-yellow-500" />,
                                            none: <MinusCircleIcon className="h-6 w-6 text-gray-300" />,
                                        };
                                        return (
                                            <td key={date.toISOString()} className="px-6 py-4 text-center">
                                                <div className={`flex justify-center ${isClickable ? 'cursor-pointer' : ''}`} onClick={isClickable ? () => handleViewDetails(staff, date) : undefined}>
                                                   {iconMap[status] || iconMap.none}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            
            {reviewModalData && <IssueReportDetailsModal details={reviewModalData} onClose={() => setReviewModalData(null)} />}
        </div>
    );
};  