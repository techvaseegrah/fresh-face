'use client';

import React, { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { format, eachDayOfInterval, isAfter } from 'date-fns';
import { CheckCircleIcon, XCircleIcon, MinusCircleIcon, ClockIcon, ExclamationTriangleIcon, InformationCircleIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import { Loader2, Download, FileText, FileSpreadsheet, Paperclip, MessageSquare, Eye, X } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Menu, Transition } from '@headlessui/react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { hasPermission, PERMISSIONS } from '../../../../lib/permissions';

// --- Type Definitions ---
interface Role { _id: string; displayName: string; }
interface Staff { _id: string; name: string; roleId: Role; }
interface ChecklistItem { _id: string; questionText: string; }
interface Checklist { _id: string; title: string; roles: string[]; checklistItems: ChecklistItem[]; }
interface SubmissionResponse { _id: string; checklistItem: string; answer: 'yes' | 'no' | ''; remarks?: string; mediaUrl?: string; }
interface Submission { _id: string; sop: string; staff: string; submissionDate: string; status: 'pending_review' | 'approved' | 'rejected'; responses: SubmissionResponse[]; }
interface ReportData { staff: Staff[]; checklists: Checklist[]; submissions: Submission[]; }
interface EnrichedSubmission extends Submission { checklistTitle: string; responses: (SubmissionResponse & { text: string })[]; }
interface ViewingDetailsData { staffName: string; date: Date; submissions: EnrichedSubmission[]; }

// --- Reusable Fetcher ---
const fetcherWithAuth = async (url: string, tenantId: string) => {
    if (!tenantId) throw new Error("Tenant ID is not available.");
    const headers = new Headers({ 'x-tenant-id': tenantId });
    const res = await fetch(url, { headers });
    if (!res.ok) {
        const errorInfo = await res.json();
        // This makes sure the error thrown is a proper Error object
        throw new Error(errorInfo.message || 'Failed to load report data.');
    }
    return res.json();
};

// --- Read-Only Details Modal ---
const SopReportDetailsModal = ({ details, onClose }: { details: ViewingDetailsData; onClose: () => void; }) => {
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
                    {details.submissions.map(sub => (
                        <div key={sub._id} className="bg-gray-50 p-4 rounded-lg border">
                            <h4 className="font-semibold text-gray-800">{sub.checklistTitle}</h4>
                            {sub.responses?.map((response) => (
                                <div key={response._id} className="mt-2 space-y-2 text-sm border-t pt-2">
                                    <p className="font-medium text-gray-700">{response.text}</p>
                                    <div className="flex items-start gap-2 text-gray-600">
                                        <MessageSquare size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
                                        <p className="italic">"{response.remarks || 'No remarks.'}"</p>
                                    </div>
                                    {response.mediaUrl && (
                                        <div className="flex items-start gap-2">
                                            <Paperclip size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
                                            <a href={response.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View Attachment</a>
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
                        This is a read-only view of the submission.
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main Page Component ---
export default function SopComplianceReportPage() {
    const { data: session } = useSession();
    const userPermissions = session?.user?.role?.permissions || [];
    
    const [endDate, setEndDate] = useState(new Date());
    const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 6); return d; });
    const [viewingDetails, setViewingDetails] = useState<ViewingDetailsData | null>(null);
    const [filter, setFilter] = useState<'unreviewed' | 'all'>('unreviewed');
    const [isExporting, setIsExporting] = useState(false);
    
    const apiUrl = session ? `/api/sop/reports/submissions?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}` : null;
    const { data: reportData, error, isLoading } = useSWR<ReportData>(
        apiUrl,
        (url: string) => fetcherWithAuth(url, session!.user.tenantId)
    );
    
    const datesInRange = useMemo(() => { try { return eachDayOfInterval({ start: startDate, end: endDate }); } catch { return []; } }, [startDate, endDate]);

    const filteredStaff = useMemo(() => {
        if (!reportData) return [];
        if (filter === 'all') return reportData.staff;
        return reportData.staff.filter(staff => reportData.submissions.some(sub => sub.staff === staff._id && sub.status === 'pending_review'));
    }, [reportData, filter]);

    const getStatusTextForCell = (staff: Staff, date: Date): string => {
        if (!reportData) return "Loading...";
        const assignedChecklists = reportData.checklists.filter(c => c.roles.includes(staff.roleId._id));
        const submissionsForDay = reportData.submissions.filter(s => s.staff === staff._id && format(new Date(s.submissionDate), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
        if (assignedChecklists.length === 0) return "Not Assigned";
        if (submissionsForDay.length === 0) return "Missed";
        if (submissionsForDay.some(s => s.status === 'rejected')) return "Rejected";
        if (submissionsForDay.length < assignedChecklists.length) return "Partial Completion";
        if (submissionsForDay.some(s => s.status === 'pending_review')) return "Pending Review";
        return "Approved";
    };

    const prepareSummaryExportData = () => {
        if (!reportData) return null;
        const headers = ['Staff Member', 'Role', ...datesInRange.map(date => format(date, 'MMM d'))];
        const body = filteredStaff.map(staff => {
            const rowData = [staff.name, staff.roleId.displayName];
            datesInRange.forEach(date => rowData.push(getStatusTextForCell(staff, date)));
            return rowData;
        });
        return { headers, body };
    };

    const prepareDetailedExportData = () => {
        if (!reportData) return null;
        const headers = ['Date', 'Staff Name', 'SOP Title', 'Status', 'Question', 'Answer', 'Remarks'];
        const body: string[][] = [];
        const submissionsInRange = reportData.submissions.filter(sub => new Date(sub.submissionDate) >= startDate && new Date(sub.submissionDate) <= endDate);
        for (const submission of submissionsInRange) {
            const staff = reportData.staff.find(s => s._id === submission.staff);
            const checklist = reportData.checklists.find(c => c._id === submission.sop);
            if (!staff || !checklist) continue;
            for (const response of submission.responses) {
                if (response.remarks && response.remarks.trim() !== '') {
                    const question = checklist.checklistItems.find(item => item._id === response.checklistItem);
                    body.push([
                        format(new Date(submission.submissionDate), 'yyyy-MM-dd'),
                        staff.name,
                        checklist.title,
                        submission.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        question?.questionText || 'N/A',
                        response.answer.toUpperCase(),
                        response.remarks,
                    ]);
                }
            }
        }
        return { headers, body };
    };

    const handleExportSummaryExcel = () => {
        const exportData = prepareSummaryExportData();
        if (!exportData) return;
        setIsExporting(true);
        try {
            const worksheet = XLSX.utils.aoa_to_sheet([exportData.headers, ...exportData.body]);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'SOP Summary');
            XLSX.writeFile(workbook, `SOP_Summary_Report.xlsx`);
        } catch (e) { toast.error("Failed to generate Excel file."); } 
        finally { setIsExporting(false); }
    };

    const handleExportSummaryPDF = () => {
        const exportData = prepareSummaryExportData();
        if (!exportData) return;
        setIsExporting(true);
        try {
            const doc = new jsPDF({ orientation: 'landscape' });
            doc.text('SOP Compliance Summary Report', 14, 15);
            autoTable(doc, { head: [exportData.headers], body: exportData.body, startY: 25 });
            doc.save(`SOP_Summary_Report.pdf`);
        } catch (e) { toast.error("Failed to generate PDF file."); } 
        finally { setIsExporting(false); }
    };

    const handleExportDetailedExcel = () => {
        const exportData = prepareDetailedExportData();
        if (!exportData || exportData.body.length === 0) return toast.info("No remarks found to export.");
        setIsExporting(true);
        try {
            const worksheet = XLSX.utils.aoa_to_sheet([exportData.headers, ...exportData.body]);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'SOP Detailed Report');
            XLSX.writeFile(workbook, `SOP_Detailed_Report.xlsx`);
        } catch (e) { toast.error("Failed to generate Excel file."); } 
        finally { setIsExporting(false); }
    };

    const handleExportDetailedPDF = () => {
        const exportData = prepareDetailedExportData();
        if (!exportData || exportData.body.length === 0) return toast.info("No remarks found to export.");
        setIsExporting(true);
        try {
            const doc = new jsPDF({ orientation: 'landscape' });
            doc.text('SOP Detailed Remarks Report', 14, 15);
            autoTable(doc, { head: [exportData.headers], body: exportData.body, startY: 25 });
            doc.save(`SOP_Detailed_Report.pdf`);
        } catch (e) { toast.error("Failed to generate PDF file."); }
        finally { setIsExporting(false); }
    };

    const getStatusForCell = (staff: Staff, date: Date) => {
        if (!reportData) return { icon: <Loader2 className="animate-spin text-gray-400" />, isClickable: false };
        const assignedChecklists = reportData.checklists.filter(c => c.roles.includes(staff.roleId._id));
        const submissionsForDay = reportData.submissions.filter(s => s.staff === staff._id && format(new Date(s.submissionDate), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
        if (assignedChecklists.length === 0) return { icon: <MinusCircleIcon className="h-6 w-6 text-gray-300" />, isClickable: false };
        if (submissionsForDay.length === 0) return { icon: <XCircleIcon className="h-6 w-6 text-red-400" />, isClickable: false };
        if (submissionsForDay.some(s => s.status === 'rejected')) return { icon: <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />, isClickable: true };
        if (submissionsForDay.length < assignedChecklists.length) return { icon: <ClockIcon className="h-6 w-6 text-yellow-500" />, isClickable: true };
        if (submissionsForDay.some(s => s.status === 'pending_review')) return { icon: <ClockIcon className="h-6 w-6 text-blue-500" />, isClickable: true };
        return { icon: <CheckCircleIcon className="h-6 w-6 text-green-500" />, isClickable: true };
    };

    const handleViewDetails = (staff: Staff, date: Date) => {
        if (!reportData) return;
        const submissionsForDay: EnrichedSubmission[] = reportData.submissions
            .filter(s => s.staff === staff._id && format(new Date(s.submissionDate), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'))
            .map(sub => {
                const checklist = reportData.checklists.find(c => c._id === sub.sop);
                const enrichedResponses = sub.responses.map(response => {
                    const question = checklist?.checklistItems.find(item => item._id === response.checklistItem);
                    return { ...response, text: question?.questionText || "Question not found" };
                });
                return { ...sub, checklistTitle: checklist?.title || 'Archived SOP', responses: enrichedResponses };
            });
        setViewingDetails({ staffName: staff.name, date, submissions: submissionsForDay });
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <ToastContainer position="top-right" autoClose={3000} />
            <h1 className="text-3xl font-bold text-gray-900 mb-4">SOP Compliance Report</h1>
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex flex-wrap gap-4 items-center">
                    <div>
                        <label className="text-sm font-medium">Start Date</label>
                        <input type="date" value={format(startDate, 'yyyy-MM-dd')} onChange={e => setStartDate(new Date(e.target.value))} className="form-input ml-2"/>
                    </div>
                    <div>
                        <label className="text-sm font-medium">End Date</label>
                        <input type="date" value={format(endDate, 'yyyy-MM-dd')} onChange={e => setEndDate(new Date(e.target.value))} className="form-input ml-2"/>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setFilter('unreviewed')} className={`px-3 py-1.5 text-sm font-semibold rounded-md ${filter === 'unreviewed' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Awaiting Review</button>
                        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-sm font-semibold rounded-md ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Show All</button>
                    </div>

                    {hasPermission(userPermissions, PERMISSIONS.REPORT_SOP_COMPLIANCE_MANAGE) && (
                        <Menu as="div" className="relative inline-block text-left">
                            <div>
                                <Menu.Button disabled={!reportData || isExporting} className="inline-flex w-full justify-center items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400">
                                    {isExporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                                    Export Report
                                    <ChevronDownIcon className="ml-2 -mr-1 h-5 w-5 text-blue-200" />
                                </Menu.Button>
                            </div>
                            <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                <Menu.Items className="absolute right-0 mt-2 w-64 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black/5 z-20">
                                    <div className="px-1 py-1 ">
                                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Summary Report</div>
                                        <Menu.Item>{({ active }) => (<button onClick={handleExportSummaryExcel} className={`${active ? 'bg-blue-500 text-white' : 'text-gray-900'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}><FileSpreadsheet className="mr-2 h-5 w-5 text-green-700" />Export as Excel (.xlsx)</button>)}</Menu.Item>
                                        <Menu.Item>{({ active }) => (<button onClick={handleExportSummaryPDF} className={`${active ? 'bg-blue-500 text-white' : 'text-gray-900'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}><FileText className="mr-2 h-5 w-5 text-red-700" />Export as PDF</button>)}</Menu.Item>
                                    </div>
                                    <div className="px-1 py-1">
                                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Detailed Report (with Remarks)</div>
                                        <Menu.Item>{({ active }) => (<button onClick={handleExportDetailedExcel} className={`${active ? 'bg-blue-500 text-white' : 'text-gray-900'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}><FileSpreadsheet className="mr-2 h-5 w-5 text-green-700" />Export as Excel (.xlsx)</button>)}</Menu.Item>
                                        <Menu.Item>{({ active }) => (<button onClick={handleExportDetailedPDF} className={`${active ? 'bg-blue-500 text-white' : 'text-gray-900'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}><FileText className="mr-2 h-5 w-5 text-red-700" />Export as PDF</button>)}</Menu.Item>
                                    </div>
                                </Menu.Items>
                            </Transition>
                        </Menu>
                    )}
                </div>
            </div>
            
            <div className="overflow-x-auto bg-white rounded-lg shadow border">
                {isLoading ? <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-gray-400" size={32} /></div> :
                 // ▼▼▼ THIS LINE IS CORRECTED ▼▼▼
                 error ? <div className="p-4 text-red-500">{error.toString()}</div> :
                 <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10 border-r">Staff Member</th>
                            {datesInRange.map(date => <th key={date.toISOString()} className="px-6 py-3 text-center text-xs font-medium uppercase">{format(date, 'MMM d')}</th>)}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredStaff.map((staff) => (
                            <tr key={staff._id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 sticky left-0 bg-white hover:bg-gray-50 z-10 border-r">
                                    <div className="font-medium text-gray-900">{staff.name}</div>
                                    <div className="text-sm text-gray-500">{staff.roleId.displayName}</div>
                                </td>
                                {datesInRange.map(date => {
                                    const { icon, isClickable } = getStatusForCell(staff, date);
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
                }
            </div>
            {viewingDetails && <SopReportDetailsModal details={viewingDetails} onClose={() => setViewingDetails(null)} />}
        </div>
    );
}