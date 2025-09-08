'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react'; // ✅ FIXED: Corrected import statement
import { useSession } from 'next-auth/react';
import { format, eachDayOfInterval, isAfter } from 'date-fns';
import { CheckCircleIcon, XCircleIcon, MinusCircleIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { Loader2, FileDown, FileType, Check, X } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import IssueSubmissionDetailsModal, { IssueModalDetails } from '../components/IssueSubmissionDetailsModal';

// --- Excel/PDF Download Libraries ---
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Type Definitions ---
interface Role { _id: string; displayName:string; }
interface Staff { _id: string; name: string; roleId?: Role; }
interface IssueTemplate { _id: string; title: string; roles: string[]; }
interface Submission { _id: string; issue: string; staff: string; submissionDate: string; status: 'pending_review' | 'approved' | 'rejected'; responses: any[]; }
interface ReportData {
    staff: Staff[];
    issues: IssueTemplate[];
    submissions: Submission[];
}
interface PendingSubmission extends Submission { staffName: string; issueTitle: string; }

// Reusable Fetcher
const fetcher = async ([url, tenantId]: [string, string | undefined]) => {
    if (!tenantId) throw new Error("Tenant ID not available.");
    const res = await fetch(url, { headers: { 'x-tenant-id': tenantId } });
    if (!res.ok) {
        const errorInfo = await res.json();
        throw new Error(errorInfo.message || 'Failed to load report data.');
    }
    return res.json();
};

// --- Status Component for Readability ---
const StatusIcon = ({ status }: { status: 'approved' | 'rejected' | 'pending' | 'missed' | 'none' }) => {
    switch (status) {
        case 'approved': return <CheckCircleIcon className="h-6 w-6 text-green-500" title="Approved" />;
        case 'rejected': return <ExclamationTriangleIcon className="h-6 w-6 text-red-600" title="Rejected" />;
        case 'pending': return <ClockIcon className="h-6 w-6 text-yellow-500" title="Awaiting Review" />;
        case 'missed': return <XCircleIcon className="h-6 w-6 text-red-400" title="Not Submitted" />;
        case 'none': return <MinusCircleIcon className="h-6 w-6 text-gray-400" title="No Issues Assigned" />;
        default: return <MinusCircleIcon className="h-6 w-6 text-gray-400" />;
    }
};

export default function IssueCompliancePage() {
    const { data: session } = useSession();
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
    const [updatingSubmissionId, setUpdatingSubmissionId] = useState<string | null>(null);

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
        // ✅ FIXED: Added types for staff and sub
        return reportData.staff.filter((staff: Staff) =>
            reportData.submissions.some((sub: Submission) => sub.staff === staff._id && sub.status === 'pending_review')
        );
    }, [reportData, filter]);

    const assignmentMap = useMemo(() => {
        if (!reportData?.submissions) return new Set();
        const map = new Set<string>();
        // ✅ FIXED: Added type for sub
        reportData.submissions.forEach((sub: Submission) => {
            const key = `${sub.staff}-${format(new Date(sub.submissionDate), 'yyyy-MM-dd')}`;
            map.add(key);
        });
        return map;
    }, [reportData?.submissions]);

    const getStatusForCell = (staff: Staff, date: Date): { status: 'approved' | 'rejected' | 'pending' | 'missed' | 'none'; isClickable: boolean } => {
        if (!reportData) return { status: 'none', isClickable: false };

        const dateString = format(date, 'yyyy-MM-dd');
        const assignmentKey = `${staff._id}-${dateString}`;
        
        if (!assignmentMap.has(assignmentKey)) {
            return { status: 'none', isClickable: false };
        }

        // ✅ FIXED: Added type for sub
        const submissionsForDay = reportData.submissions.filter((sub: Submission) =>
            sub.staff === staff._id && format(new Date(sub.submissionDate), 'yyyy-MM-dd') === dateString
        );

        // ✅ FIXED: Added type for s
        if (submissionsForDay.some((s: Submission) => s.status === 'rejected')) return { status: 'rejected', isClickable: true };
        if (submissionsForDay.some((s: Submission) => s.status === 'pending_review')) return { status: 'pending', isClickable: true };
        if (submissionsForDay.every((s: Submission) => s.status === 'approved')) return { status: 'approved', isClickable: true };

        return { status: 'pending', isClickable: true };
    };

    const handleViewDetails = (staff: Staff, date: Date) => {
        if (!reportData) return;
        const dateString = format(date, 'yyyy-MM-dd');
        const statusOrder: { [key: string]: number } = { 'pending_review': 1, 'approved': 2, 'rejected': 3 };

        const submissionsForDay = reportData.submissions
             // ✅ FIXED: Added type for s
            .filter((s: Submission) => s.staff === staff._id && format(new Date(s.submissionDate), 'yyyy-MM-dd') === dateString)
             // ✅ FIXED: Added type for sub
            .map((sub: Submission) => {
                // ✅ FIXED: Added type for issue
                const issueTemplate = reportData.issues.find((issue: IssueTemplate) => issue._id === sub.issue);
                return { ...sub, checklistTitle: issueTemplate?.title || 'Deleted Issue' };
            })
             // ✅ FIXED: Added types for a and b
            .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

        if (submissionsForDay.length === 0) return;
        setReviewModalData({ staffName: staff.name, date: date, submissions: submissionsForDay });
    };

    const handleDownloadExcel = () => {
        if (!reportData) return;
        // ✅ FIXED: Added type for staff
        const body = filteredStaff.map((staff: Staff) => {
            const row: Record<string, any> = { "Staff Member": staff.name, "Role": staff.roleId?.displayName || 'N/A' };
            // ✅ FIXED: Added type for date
            datesInRange.forEach((date: Date) => {
                const { status } = getStatusForCell(staff, date);
                row[format(date, 'MMM d')] = status.charAt(0).toUpperCase() + status.slice(1);
            });
            return row;
        });
        const worksheet = XLSX.utils.json_to_sheet(body);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Compliance Report");
        XLSX.writeFile(workbook, `Issue_Compliance_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    const handleDownloadPdf = () => {
        if (!reportData) return;
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text("Issue Compliance Report", 14, 16);
        const head = [["Staff Member", "Role", ...datesInRange.map(d => format(d, 'MMM d'))]];
        // ✅ FIXED: Added type for staff
        const body = filteredStaff.map((staff: Staff) => [
            staff.name,
            staff.roleId?.displayName || 'N/A',
            // ✅ FIXED: Added type for date
            ...datesInRange.map((date: Date) => {
                const { status } = getStatusForCell(staff, date);
                return status.charAt(0).toUpperCase() + status.slice(1);
            })
        ]);
        autoTable(doc, { head, body, startY: 30, theme: 'striped' });
        doc.save(`Issue_Compliance_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const pendingSubmissions = useMemo((): PendingSubmission[] => {
        if (!reportData) return [];
        // ✅ FIXED: Added type for sub, staffMember, issueTemplate
        return reportData.submissions
            .filter((sub: Submission) => sub.status === 'pending_review')
            .map((sub: Submission) => {
                const staffMember = reportData.staff.find((s: Staff) => s._id === sub.staff);
                const issueTemplate = reportData.issues.find((i: IssueTemplate) => i._id === sub.issue);
                return { ...sub, staffName: staffMember?.name || 'Unknown', issueTitle: issueTemplate?.title || 'Deleted' };
            });
    }, [reportData]);

    const handleUpdateSubmissionStatus = async (submissionId: string, newStatus: 'approved' | 'rejected') => {
        if (!session?.user?.tenantId) return;
        setUpdatingSubmissionId(submissionId);
        try {
            await fetch(`/api/issue/submissions/${submissionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-tenant-id': session.user.tenantId },
                body: JSON.stringify({ status: newStatus }),
            });
            toast.success(`Submission ${newStatus}.`);
            await fetchReport();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setUpdatingSubmissionId(null);
        }
    };

    return (
         <div className="p-4 sm:p-6 lg:p-8 bg-gray-100 min-h-screen font-sans">
             <header className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Issue Compliance Report</h1>
                <p className="text-sm text-gray-600 mt-1">Review daily issue submission status across all staff members.</p>
            </header>

            <div className="mb-6 p-4 bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="font-semibold text-gray-700 text-sm">Start Date</label>
                        <input type="date" value={format(startDate, 'yyyy-MM-dd')} onChange={e => setStartDate(new Date(e.target.value))} className="form-input rounded-md"/>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="font-semibold text-gray-700 text-sm">End Date</label>
                        <input type="date" value={format(endDate, 'yyyy-MM-dd')} onChange={e => setEndDate(new Date(e.target.value))} className="form-input rounded-md"/>
                    </div>
                    <div className="flex flex-col gap-4">
                        <div className='flex flex-col'>
                            <label className="font-semibold text-gray-700 text-sm mb-2">Filter Staff</label>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setFilter('unreviewed')} className={`flex-1 px-4 py-2 text-sm font-semibold rounded-md ${filter === 'unreviewed' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>Awaiting Review</button>
                                <button onClick={() => setFilter('all')} className={`flex-1 px-4 py-2 text-sm font-semibold rounded-md ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>Show All</button>
                            </div>
                        </div>
                        <div className='flex items-center gap-2'>
                            <button onClick={handleDownloadExcel} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm text-green-700 bg-green-100 rounded-md"><FileType size={16}/> Excel</button>
                            <button onClick={handleDownloadPdf} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-700 bg-red-100 rounded-md"><FileDown size={16}/> PDF</button>
                        </div>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
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
                                <tr key={staff._id} className="hover:bg-indigo-50/50">
                                    <td className="px-6 py-4 sticky left-0 bg-white hover:bg-indigo-50/50 z-10">
                                        <div className="font-semibold">{staff.name}</div>
                                        <div className="text-sm text-gray-500">{staff.roleId?.displayName || 'No Role'}</div>
                                    </td>
                                    {datesInRange.map((date: Date) => {
                                        const { status, isClickable } = getStatusForCell(staff, date);
                                        return (
                                            <td key={date.toISOString()} className="px-6 py-4 text-center">
                                                <div className={`flex justify-center ${isClickable ? 'cursor-pointer' : ''}`} onClick={isClickable ? () => handleViewDetails(staff, date) : undefined}>
                                                   <StatusIcon status={status} />
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
            
            {reviewModalData && <IssueSubmissionDetailsModal details={reviewModalData} onClose={() => setReviewModalData(null)} onActionSuccess={fetchReport} />}
        </div>
    );
};