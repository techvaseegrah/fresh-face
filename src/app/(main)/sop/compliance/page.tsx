'use client';

import { Fragment, useState } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { format, eachDayOfInterval } from 'date-fns';
import { CheckCircleIcon, XCircleIcon, MinusCircleIcon, ClockIcon, ExclamationTriangleIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import { Loader2, Download, FileText, FileSpreadsheet } from 'lucide-react';
import SubmissionDetailsModal from '../components/SubmissionDetailsModal';

// --- UI Component for Dropdown ---
import { Menu, Transition } from '@headlessui/react';

// --- Imports for Exporting ---
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Type Definitions ---
interface Role { _id: string; displayName: string; }
interface Staff { _id: string; name: string; roleId: Role; }
interface ChecklistItem { _id: string; questionText: string; responseType: 'yes_no' | 'yes_no_remarks'; mediaUpload: 'none' | 'optional' | 'required'; }
interface Checklist { _id: string; title: string; roles: string[]; checklistItems: ChecklistItem[]; }
interface SubmissionResponse { _id: string; checklistItem: string; answer: 'yes' | 'no' | ''; remarks?: string; mediaUrl?: string; }
interface Submission { _id: string; sop: string; staff: string; submissionDate: string; status: 'pending_review' | 'approved' | 'rejected'; responses: SubmissionResponse[]; }
interface ReportData { staff: Staff[]; checklists: Checklist[]; submissions: Submission[]; }
interface EnrichedSubmission extends Submission { checklistTitle: string; responses: (SubmissionResponse & { text: string })[]; }
interface ViewingDetailsData { staffName: string; date: Date; submissions: EnrichedSubmission[]; }


// --- Fetcher function for useSWR ---
const fetcherWithAuth = async (url: string, tenantId: string) => {
    if (!tenantId) {
        throw new Error("Tenant ID is not available.");
    }
    const headers = new Headers();
    headers.append('x-tenant-id', tenantId);
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errorInfo = await res.json();
      throw new Error(errorInfo.message || 'Failed to load report data.');
    }
    return res.json();
};

// --- Main Component ---
export default function SopReportPage() {
    // --- State Management ---
    const { data: session } = useSession();
    const [endDate, setEndDate] = useState(new Date());
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        return d;
    });
    
    const [viewingDetails, setViewingDetails] = useState<ViewingDetailsData | null>(null);
    const [filter, setFilter] = useState<'unreviewed' | 'all'>('unreviewed');
    const [isExporting, setIsExporting] = useState(false);

    // --- Data Fetching ---
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
    const apiUrl = session ? `/api/sop/reports/submissions?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}` : null;
    const { data, error, mutate } = useSWR<ReportData>(apiUrl, (url: string) => fetcherWithAuth(url, session!.user.tenantId));
    const canViewReport = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.SOP_REPORTS_READ);

    // --- Helper Functions for Exports ---
    const getStatusTextForCell = (staff: Staff, date: Date): string => {
        if (!data) return "Loading...";
        const assignedChecklists = data.checklists.filter(c => c.roles.includes(staff.roleId._id));
        const dateStringToCheck = format(date, 'yyyy-MM-dd');
        const submissionsForDay = data.submissions.filter(s => s.staff === staff._id && format(new Date(s.submissionDate), 'yyyy-MM-dd') === dateStringToCheck);

        if (assignedChecklists.length === 0) return "Not Assigned";
        if (submissionsForDay.length === 0) return "Missed";
        if (submissionsForDay.some(s => s.status === 'rejected')) return "Rejected";
        if (submissionsForDay.length < assignedChecklists.length) return "Partial Completion";
        if (submissionsForDay.some(s => s.status === 'pending_review')) return "Pending Review";
        return "Approved";
    };

    const prepareSummaryExportData = () => {
        if (!data) return null;
        const headers = ['Staff Member', 'Role', ...dateRange.map(date => format(date, 'MMM d'))];
        const body = data.staff.map(staff => {
            const rowData = [staff.name, staff.roleId.displayName];
            dateRange.forEach(date => rowData.push(getStatusTextForCell(staff, date)));
            return rowData;
        });
        return { headers, body };
    };

    const prepareDetailedExportData = () => {
        if (!data) return null;
        const headers = ['Date', 'Staff Name', 'SOP Title', 'Status', 'Question', 'Answer', 'Remarks'];
        const body: string[][] = [];

        const submissionsInRange = data.submissions.filter(sub => {
            const subDate = new Date(sub.submissionDate);
            return subDate >= startDate && subDate <= endDate;
        });

        for (const submission of submissionsInRange) {
            const staff = data.staff.find(s => s._id === submission.staff);
            const checklist = data.checklists.find(c => c._id === submission.sop);
            if (!staff || !checklist) continue;

            for (const response of submission.responses) {
                if (response.remarks && response.remarks.trim() !== '') {
                    const question = checklist.checklistItems.find(item => item._id === response.checklistItem);
                    body.push([
                        // --- FIX: Removed the time component (HH:mm) ---
                        format(new Date(submission.submissionDate), 'yyyy-MM-dd'),
                        staff.name,
                        checklist.title,
                        submission.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        question?.questionText || 'Question Not Found',
                        response.answer.toUpperCase(),
                        response.remarks,
                    ]);
                }
            }
        }
        return { headers, body };
    };

    // --- Export Handlers ---
    const handleExportSummaryExcel = () => {
        const exportData = prepareSummaryExportData();
        if (!exportData) return;
        setIsExporting(true);
        try {
            const worksheet = XLSX.utils.aoa_to_sheet([exportData.headers, ...exportData.body]);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'SOP Compliance Summary');
            const colWidths = [{ wch: 25 }, { wch: 20 }, ...dateRange.map(() => ({ wch: 15 }))];
            worksheet['!cols'] = colWidths;
            const f_start = format(startDate, 'yyyy-MM-dd');
            const f_end = format(endDate, 'yyyy-MM-dd');
            XLSX.writeFile(workbook, `SOP_Summary_Report_${f_start}_to_${f_end}.xlsx`);
        } catch (e) { console.error("Failed to export summary Excel:", e); alert("An error occurred generating the Excel file."); } 
        finally { setIsExporting(false); }
    };

    const handleExportSummaryPDF = () => {
        const exportData = prepareSummaryExportData();
        if (!exportData) return;
        setIsExporting(true);
        try {
            const doc = new jsPDF({ orientation: 'landscape' });
            doc.text('SOP Compliance Summary Report', 14, 15);
            doc.setFontSize(10);
            doc.text(`Date Range: ${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`, 14, 21);
            autoTable(doc, {
                head: [exportData.headers],
                body: exportData.body,
                startY: 25,
                theme: 'grid',
                headStyles: { fillColor: [22, 160, 133] },
                styles: { fontSize: 7 },
            });
            doc.save(`SOP_Summary_Report_${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}.pdf`);
        } catch (e) { console.error("Failed to export summary PDF:", e); alert("An error occurred generating the PDF file."); } 
        finally { setIsExporting(false); }
    };

    const handleExportDetailedExcel = () => {
        const exportData = prepareDetailedExportData();
        if (!exportData || exportData.body.length === 0) {
            alert("No remarks found in the selected date range to export.");
            return;
        }
        setIsExporting(true);
        try {
            const worksheet = XLSX.utils.aoa_to_sheet([exportData.headers, ...exportData.body]);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Detailed Remarks Report');
            // --- FIX: Adjusted date column width ---
            const colWidths = [{ wch: 12 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 40 }, { wch: 8 }, { wch: 50 }];
            worksheet['!cols'] = colWidths;
            const f_start = format(startDate, 'yyyy-MM-dd');
            const f_end = format(endDate, 'yyyy-MM-dd');
            XLSX.writeFile(workbook, `SOP_Detailed_Report_${f_start}_to_${f_end}.xlsx`);
        } catch (e) { console.error("Failed to export detailed Excel:", e); alert("An error occurred generating the detailed Excel file."); } 
        finally { setIsExporting(false); }
    };

    const handleExportDetailedPDF = () => {
        const exportData = prepareDetailedExportData();
        if (!exportData || exportData.body.length === 0) {
            alert("No remarks found in the selected date range to export.");
            return;
        }
        setIsExporting(true);
        try {
            const doc = new jsPDF({ orientation: 'landscape' });
            doc.text('SOP Detailed Remarks Report', 14, 15);
            doc.setFontSize(10);
            doc.text(`Date Range: ${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`, 14, 21);
            autoTable(doc, {
                head: [exportData.headers],
                body: exportData.body,
                startY: 25,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185] },
                styles: { fontSize: 7, cellPadding: 1.5 },
                columnStyles: { 4: { cellWidth: 60 }, 6: { cellWidth: 60 } }
            });
            doc.save(`SOP_Detailed_Report_${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}.pdf`);
        } catch (e) { console.error("Failed to export detailed PDF:", e); alert("An error occurred generating the detailed PDF file."); }
        finally { setIsExporting(false); }
    };

    // --- Modal and Data Update Handlers ---
    const handleAcknowledged = (submissionId: string, newStatus: 'approved' | 'rejected') => {
        mutate((currentData) => {
            if (!currentData) return currentData;
            const newSubmissions = currentData.submissions.map((sub) => {
                if (sub._id === submissionId) return { ...sub, status: newStatus };
                return sub;
            });
            return { ...currentData, submissions: newSubmissions };
        }, false);
        setViewingDetails(prev => {
            if (!prev) return null;
            const newSubmissionsInModal = prev.submissions.map((sub) => {
                 if (sub._id === submissionId) return { ...sub, status: newStatus };
                return sub;
            });
            if (newSubmissionsInModal.every((s) => s.status !== 'pending_review')) onClose();
            return { ...prev, submissions: newSubmissionsInModal };
        });
    };
    
    const onClose = () => setViewingDetails(null);

    const handleViewDetails = (staff: Staff, date: Date) => {
        if (!data) return;
        const dateStringToCheck = format(date, 'yyyy-MM-dd');
        const submissionsForDay: EnrichedSubmission[] = data.submissions
            .filter(s => s.staff === staff._id && format(new Date(s.submissionDate), 'yyyy-MM-dd') === dateStringToCheck)
            .map(sub => {
                const checklist = data.checklists.find(c => c._id === sub.sop);
                if (!checklist) {
                    return { ...sub, checklistTitle: 'Archived or Deleted SOP', responses: sub.responses.map(r => ({...r, text: "Question not found"})) };
                }
                const enrichedResponses = sub.responses.map(response => {
                    const question = checklist.checklistItems.find(item => item._id === response.checklistItem);
                    return { ...response, text: question?.questionText || "Question not found" };
                });
                return { ...sub, checklistTitle: checklist.title, responses: enrichedResponses };
            });
        setViewingDetails({ staffName: staff.name, date: date, submissions: submissionsForDay });
    };

    if (!canViewReport) {
        return <p className="p-6 text-red-500">You do not have permission to view this report.</p>;
    }

    return (
        <>
            <div className="p-6 bg-gray-50 min-h-screen">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">SOP Compliance Report</h1>
                
                <div className="flex flex-wrap justify-between items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div>
                            <label htmlFor="startDate" className="text-sm font-medium text-gray-700">Start Date</label>
                            <input id="startDate" type="date" value={format(startDate, 'yyyy-MM-dd')} onChange={e => setStartDate(new Date(e.target.value))} className="form-input ml-2" />
                        </div>
                        <div>
                            <label htmlFor="endDate" className="text-sm font-medium text-gray-700">End Date</label>
                            <input id="endDate" type="date" value={format(endDate, 'yyyy-MM-dd')} onChange={e => setEndDate(new Date(e.target.value))} className="form-input ml-2" />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setFilter('unreviewed')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${filter === 'unreviewed' ? 'bg-blue-600 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Awaiting Review</button>
                            <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${filter === 'all' ? 'bg-blue-600 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Show All</button>
                        </div>
                        <div className="flex items-center gap-2 border-l pl-4">
                             <Menu as="div" className="relative inline-block text-left">
                                <div>
                                    <Menu.Button disabled={!data || isExporting} className="inline-flex w-full justify-center items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75 disabled:bg-gray-400 disabled:cursor-not-allowed">
                                        {isExporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                                        Export Report
                                        <ChevronDownIcon className="ml-2 -mr-1 h-5 w-5 text-blue-200 hover:text-blue-100" aria-hidden="true" />
                                    </Menu.Button>
                                </div>
                                <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                    <Menu.Items className="absolute right-0 mt-2 w-64 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none z-20">
                                        <div className="px-1 py-1 ">
                                            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Summary Report</div>
                                            <Menu.Item>{({ active }) => (<button onClick={handleExportSummaryExcel} className={`${active ? 'bg-green-500 text-white' : 'text-gray-900'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}><FileSpreadsheet className="mr-2 h-5 w-5 text-green-700" aria-hidden="true" />Export as Excel (.xlsx)</button>)}</Menu.Item>
                                            <Menu.Item>{({ active }) => (<button onClick={handleExportSummaryPDF} className={`${active ? 'bg-red-500 text-white' : 'text-gray-900'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}><FileText className="mr-2 h-5 w-5 text-red-700" aria-hidden="true" />Export as PDF</button>)}</Menu.Item>
                                        </div>
                                        <div className="px-1 py-1">
                                            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Detailed Report (with Remarks)</div>
                                            <Menu.Item>{({ active }) => (<button onClick={handleExportDetailedExcel} className={`${active ? 'bg-green-500 text-white' : 'text-gray-900'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}><FileSpreadsheet className="mr-2 h-5 w-5 text-green-700" aria-hidden="true" />Export as Excel (.xlsx)</button>)}</Menu.Item>
                                            <Menu.Item>{({ active }) => (<button onClick={handleExportDetailedPDF} className={`${active ? 'bg-red-500 text-white' : 'text-gray-900'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}><FileText className="mr-2 h-5 w-5 text-red-700" aria-hidden="true" />Export as PDF</button>)}</Menu.Item>
                                        </div>
                                    </Menu.Items>
                                </Transition>
                            </Menu>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
                    {error && <div className="p-4 text-red-500 font-medium">{error.message}</div>}
                    {(!data && !error) && <div className="p-10 flex justify-center items-center"><Loader2 className="animate-spin text-gray-400" size={32} /></div>}
                    {data && Array.isArray(data.staff) && (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 border-r">Staff Member</th>
                                    {dateRange.map(date => (<th key={date.toISOString()} scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{format(date, 'MMM d')}</th>))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {data.staff.map((staff: Staff) => (
                                    <tr key={staff._id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white hover:bg-gray-50 z-10 border-r">
                                            <div className="font-medium text-gray-900">{staff.name}</div>
                                            <div className="text-sm text-gray-500">{staff.roleId.displayName}</div>
                                        </td>
                                        {dateRange.map(date => {
                                            const assignedChecklists = data.checklists.filter(c => c.roles.includes(staff.roleId._id));
                                            const submissionsForDay = data.submissions.filter(s => s.staff === staff._id && format(new Date(s.submissionDate), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
                                            let tooltipText = "No checklists assigned", statusIcon = <MinusCircleIcon className="h-6 w-6 text-gray-400" />, isClickable = false;
                                            if (assignedChecklists.length > 0) {
                                                if (submissionsForDay.length === 0) { statusIcon = <XCircleIcon className="h-6 w-6 text-red-500" />; tooltipText = "Missed"; } 
                                                else {
                                                    isClickable = true;
                                                    if (submissionsForDay.some(s => s.status === 'rejected')) { statusIcon = <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />; tooltipText = "Rejected - Click to view"; } 
                                                    else if (submissionsForDay.length < assignedChecklists.length) { statusIcon = <ClockIcon className="h-6 w-6 text-yellow-500" />; tooltipText = "Partial Completion - Click to view"; } 
                                                    else if (submissionsForDay.some(s => s.status === 'pending_review')) { statusIcon = <ClockIcon className="h-6 w-6 text-blue-500" />; tooltipText = "Pending Review - Click to view"; } 
                                                    else { statusIcon = <CheckCircleIcon className="h-6 w-6 text-green-500" />; tooltipText = "Approved - Click to view"; }
                                                }
                                            }
                                            const isActionable = submissionsForDay.some(s => s.status === 'pending_review' || s.status === 'rejected');
                                            let shouldRender = !(filter === 'unreviewed' && !isActionable && submissionsForDay.length > 0 && submissionsForDay.length === assignedChecklists.length);
                                            return (<td key={date.toISOString()} className="px-6 py-4 whitespace-nowrap text-center">{shouldRender ? <div title={tooltipText} className={`flex justify-center items-center ${isClickable ? 'cursor-pointer' : ''}`} onClick={isClickable ? () => handleViewDetails(staff, date) : undefined}>{statusIcon}</div> : <div className="h-6 w-6" />}</td>);
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
            {viewingDetails && <SubmissionDetailsModal details={viewingDetails} onClose={onClose} onAcknowledged={handleAcknowledged} />}
        </>
    );
}