'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { Loader2, AlertTriangle, Eye, X, Inbox, FileText, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { hasPermission, PERMISSIONS } from '../../../../lib/permissions'; // Path to your permissions file

// --- TYPE DEFINITIONS ---
interface IssueProp {
    _id: string; title: string; description: string; priority: 'high' | 'medium' | 'low' | 'none';
    roles: { _id: string; displayName: string; }[];
    fileUrl?: string;
}
interface DisplayIssue {
    _id: string; issueId: string; title: string;
    status: 'pending_review' | 'approved' | 'rejected' | 'pending_assignment';
    submissionDate: string | null; createdDate: string;
    assignee: { name: string | null; roles: string[]; };
    reviewer: { name: string; role: string; } | null;
    priority: 'high' | 'medium' | 'low' | 'none';
    submittedBy: { name: string; role: string; } | null;
}

// --- FETCHER & HELPER COMPONENTS ---
const fetcherWithAuth = async ([url, tenantId]: [string, string]) => {
    if (!tenantId) throw new Error("Tenant ID not available.");
    const headers = new Headers({ 'x-tenant-id': tenantId });
    const res = await fetch(url, { headers });
    if (!res.ok) {
        const errorInfo = await res.json();
        throw new Error(errorInfo.message || 'Failed to load data.');
    }
    return res.json();
};

const ViewIssueModal = ({ issue, onClose }: { issue: IssueProp | null, onClose: () => void }) => {
    if (!issue) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-start md:items-center z-50 p-2 sm:p-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white rounded-xl shadow-2xl w-full max-w-lg md:max-w-xl flex flex-col max-h-[95vh]">
                <div className="flex justify-between items-center p-4 sm:p-6 border-b">
                    <h2 className="text-lg md:text-xl font-bold text-gray-900">Issue Details</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <p><strong className="font-semibold text-gray-600">Title:</strong> {issue.title}</p>
                    <p><strong className="font-semibold text-gray-600">Priority:</strong> {issue.priority}</p>
                    {issue.description && <p><strong className="font-semibold text-gray-600">Description:</strong> {issue.description}</p>}
                    <div>
                        <strong className="font-semibold text-gray-600">Assigned Roles:</strong>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {issue.roles.map(role => <span key={role._id} className="px-3 py-1 text-sm bg-gray-200 text-gray-800 rounded-full">{role.displayName}</span>)}
                        </div>
                    </div>
                </div>
                 <div className="p-4 bg-gray-50/50 border-t flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">Close</button>
                </div>
            </motion.div>
        </div>
    );
};

const StatusBadge = ({ status }: { status: DisplayIssue['status'] }) => {
    const styles = {
        approved: "bg-green-100 text-green-800",
        pending_review: "bg-yellow-100 text-yellow-800",
        rejected: "bg-red-100 text-red-800",
        pending_assignment: "bg-gray-200 text-gray-800",
    };
    const text = {
        approved: "Approved",
        pending_review: "Pending",
        rejected: "Rejected",
        pending_assignment: "Not Assigned",
    }
    return <span className={`px-2.5 py-1 text-xs font-semibold rounded-full inline-block ${styles[status]}`}>{text[status]}</span>;
};

const UserAvatar = ({ name }: { name?: string | null }) => {
    if (!name || name.toLowerCase() === 'platform administrator') {
        return <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center font-bold text-sm flex-shrink-0" title="Platform Administrator">P</div>;
    }
    const initial = name.charAt(0).toUpperCase();
    return <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0" title={name}>{initial}</div>;
};

export default function IssueDashboardReportPage() {
    const { data: session, status: sessionStatus } = useSession();
    const userPermissions = session?.user?.role?.permissions || [];
    
    const [viewingIssue, setViewingIssue] = useState<IssueProp | null>(null);
    const [activeTab, setActiveTab] = useState('today');
    
    const tenantId = session?.user?.tenantId;
    const apiUrl = tenantId ? `/api/issue?filter=${activeTab}` : null;
    const { data: issues, error } = useSWR<DisplayIssue[]>(
        apiUrl ? [apiUrl, tenantId] : null,
        fetcherWithAuth
    );

    const handleView = async (issue: DisplayIssue) => {
        if (!tenantId) return;
        try {
            const issueToView: IssueProp = await fetcherWithAuth([`/api/issue/${issue.issueId}`, tenantId]);
            setViewingIssue(issueToView);
        } catch (err: any) {
            toast.error(`Failed to load issue details: ${err.message}`);
        }
    };
    
    const priorityBorderMap: { [key: string]: string } = {
        high: 'border-l-red-500',
        medium: 'border-l-yellow-500',
        low: 'border-l-blue-500',
    };

    const handleExportPDF = () => {
        if (!issues || issues.length === 0) return toast.info("No data to export.");
        const doc = new jsPDF();
        doc.text(`Issue Dashboard Report - ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`, 14, 16);
        const tableColumn = ["Issue Title", "Solved By", "Submitted By", "Status", "Submitted Date", "Solved Date"];
        const tableRows = issues.map(issue => [
            issue.title,
            issue.assignee?.name || 'N/A',
            issue.submittedBy?.name || 'N/A',
            issue.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            issue.createdDate ? format(new Date(issue.createdDate), 'MMM d, yyyy') : '—',
            issue.submissionDate ? format(new Date(issue.submissionDate), 'MMM d, yyyy') : '—',
        ]);
        autoTable(doc, { head: [tableColumn], body: tableRows, startY: 25 });
        doc.save(`issue_dashboard_report_${activeTab}.pdf`);
    };

    const handleExportExcel = () => {
        if (!issues || issues.length === 0) return toast.info("No data to export.");
        const worksheetData = issues.map(issue => ({
            "Issue Title": issue.title,
            "Priority": issue.priority,
            "Solved By": issue.assignee?.name || 'N/A',
            "Submitted By": issue.submittedBy?.name || 'N/A',
            "Submitter Role": issue.submittedBy?.role || 'N/A',
            "Status": issue.status,
            "Submitted Date": issue.createdDate ? format(new Date(issue.createdDate), 'yyyy-MM-dd') : '—',
            "Solved Date": issue.submissionDate ? format(new Date(issue.submissionDate), 'yyyy-MM-dd') : '—',
        }));
        const ws = XLSX.utils.json_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Issues");
        XLSX.writeFile(wb, `issue_dashboard_report_${activeTab}.xlsx`);
    };

    if (sessionStatus === 'loading') {
        return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            <ToastContainer position="top-right" autoClose={3000} />
            <header className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Issue Dashboard Report</h1>
                    <p className="text-gray-600 mt-1">A read-only overview of all assigned issues.</p>
                </div>
                {hasPermission(userPermissions, PERMISSIONS.REPORT_ISSUE_LIBRARY_MANAGE) && (
                    <div className="flex items-center gap-2">
                        <button onClick={handleExportPDF} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border rounded-md hover:bg-gray-50">
                            <FileText size={16} className="text-red-500"/> PDF
                        </button>
                        <button onClick={handleExportExcel} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border rounded-md hover:bg-gray-50">
                            <FileSpreadsheet size={16} className="text-green-600"/> Excel
                        </button>
                    </div>
                )}
            </header>

            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    {[{key: 'today', label: "Overall Issues"}, {key: 'ongoing', label: "Ongoing"}, {key: 'completed', label: "Completed"}, {key: 'rejected', label: "Rejected"}].map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === tab.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <main className="bg-white rounded-lg shadow-md">
                <div className="hidden md:grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)] gap-4 items-center px-4 py-3 bg-gray-50 rounded-t-lg">
                    <div className="text-xs font-semibold text-gray-500 uppercase">Issue</div>
                    <div className="text-xs font-semibold text-gray-500 uppercase">Solved By</div>
                    <div className="text-xs font-semibold text-gray-500 uppercase">Submitted By</div>
                    <div className="text-center text-xs font-semibold text-gray-500 uppercase">Status</div>
                    <div className="text-center text-xs font-semibold text-gray-500 uppercase">Submitted Date</div>
                    <div className="text-center text-xs font-semibold text-gray-500 uppercase">Solved Date</div>
                    <div className="text-right text-xs font-semibold text-gray-500 uppercase">Actions</div>
                </div>

                {error && <div className="p-4 text-red-700 bg-red-100 flex items-center gap-3"><AlertTriangle size={20}/> API Error: {error.message}</div>}
                {!issues && !error && <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>}
                
                {issues && issues.length === 0 && (
                    <div className="text-center py-16 px-6">
                        <Inbox className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-lg font-semibold text-gray-900">No issues found</h3>
                        <p className="mt-1 text-sm text-gray-500">There are no issues to display for this filter.</p>
                    </div>
                )}
                
                <div className="divide-y divide-gray-200">
                    {issues && issues.map(issue => (
                        <div key={issue._id} className={`p-4 grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)] gap-y-4 md:gap-4 items-center border-l-4 ${priorityBorderMap[issue.priority] || 'border-l-gray-300'}`}>
                            <div>
                                <p className="font-semibold text-gray-800">{issue.title}</p>
                                <p className="text-sm text-gray-500">{issue.submittedBy?.role || 'N/A'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <UserAvatar name={issue.assignee?.name} />
                                {issue.assignee?.name ? <span>{issue.assignee.name}</span> : <span className="text-gray-500">N/A</span>}
                            </div>
                            <div>
                                {issue.submittedBy ? (
                                    <div>
                                        <p className="font-medium text-sm text-gray-800">{issue.submittedBy.name}</p>
                                        <p className="text-xs text-gray-500">{issue.submittedBy.role}</p>
                                    </div>
                                ) : <span className="text-gray-500">—</span>}
                            </div>
                            <div className="flex justify-start md:justify-center"><StatusBadge status={issue.status} /></div>
                            <div className="text-sm text-gray-600 text-left md:text-center">{issue.createdDate ? format(new Date(issue.createdDate), 'MMM d, yyyy') : '—'}</div>
                            <div className="text-sm text-gray-600 text-left md:text-center">{issue.submissionDate ? format(new Date(issue.submissionDate), 'MMM d, yyyy') : '—'}</div>
                            <div className="flex justify-end items-center gap-1">
                                <button onClick={() => handleView(issue)} className="p-2 rounded-md hover:bg-blue-100 text-gray-400 hover:text-blue-600"><Eye size={18}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            <AnimatePresence>
                {viewingIssue && ( <ViewIssueModal issue={viewingIssue} onClose={() => setViewingIssue(null)} /> )}
            </AnimatePresence>
        </div>
    );
}