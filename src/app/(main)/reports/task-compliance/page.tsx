'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { CheckCircleIcon, XCircleIcon, MinusCircleIcon, ClockIcon, ExclamationTriangleIcon, InformationCircleIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import { Eye, Loader2, Paperclip, FileDown, FileText, FileSpreadsheet, X as LucideX } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { hasPermission, PERMISSIONS } from '../../../../lib/permissions';

// --- Interfaces ---
interface Staff { _id: string; name: string; }

interface Submission {
  _id: string;
  taskName: string;
  assignedTo: string;
  dueDate: string;
  status: 'Awaiting Review' | 'Approved' | 'Rejected';
  reviewedAt?: string;
  checklistAnswers: {
    _id: string;
    questionText: string;
    answer: 'Yes' | 'No' | null;
    remarks?: string;
    mediaUrl?: string;
  }[];
}
interface AssignedTask { assignedTo: string; dueDate: string; }
interface ReportData { staff: Staff[]; submissions: Submission[]; assignedTasks: AssignedTask[]; }
interface ReviewModalData {
    staffName: string;
    date: Date;
    submissions: Submission[];
    staffId: string;
    status: 'Awaiting Review' | 'Approved' | 'Rejected';
}

const fetcher = async (url: string, tenantId: string) => {
    const res = await fetch(url, { headers: { 'x-tenant-id': tenantId } });
    if (!res.ok) {
      const errorInfo = await res.json();
      throw new Error(errorInfo.error || 'Failed to load report data.');
    }
    return res.json();
};

const MediaModal = ({ url, onClose }: { url: string, onClose: () => void }) => {
    const isImage = /\.(jpeg|jpg|gif|png|webp)$/i.test(url);
    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-3 border-b">
                    <h4 className="font-semibold text-gray-700">Media Preview</h4>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 rounded-full"><LucideX size={20}/></button>
                </div>
                <div className="p-4 overflow-auto">
                    {isImage ? (<img src={url} alt="Media preview" className="max-w-full h-auto mx-auto rounded" />)
                     : (<div className="text-center p-8">
                            <p className="text-gray-600 mb-4">No preview available for this file type.</p>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
                                <Paperclip size={16} /> Download or View File
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ReviewModal = ({ data, onClose }: { data: ReviewModalData | null, onClose: () => void }) => {
    const [viewingMediaUrl, setViewingMediaUrl] = useState<string | null>(null);

    if (!data) return null;
    
    const getStatusChip = (status: string) => {
        switch (status) {
            case 'Approved': return <span className="text-xs font-semibold text-green-800 bg-green-100 px-2 py-1 rounded-full">{status}</span>;
            case 'Rejected': return <span className="text-xs font-semibold text-red-800 bg-red-100 px-2 py-1 rounded-full">{status}</span>;
            default: return <span className="text-xs font-semibold text-yellow-800 bg-yellow-100 px-2 py-1 rounded-full">Awaiting Review</span>;
        }
    };

    const reviewDate = useMemo(() => {
        if (data.status === 'Approved' || data.status === 'Rejected') {
            const latestReview = data.submissions.reduce((latest, sub) => {
                if (!sub.reviewedAt) return latest;
                const subDate = new Date(sub.reviewedAt);
                return subDate > latest ? subDate : latest;
            }, new Date(0));
            return latestReview.getTime() > 0 ? format(latestReview, 'PPpp') : 'N/A';
        }
        return null;
    }, [data]);

    return (
        <>
            {viewingMediaUrl && <MediaModal url={viewingMediaUrl} onClose={() => setViewingMediaUrl(null)} />}
            <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4" onClick={onClose}>
                <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-4 border-b">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">{data.staffName}'s Submissions</h3>
                            <p className="text-sm text-gray-500">{format(data.date, 'EEEE, MMMM d, yyyy')}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            {getStatusChip(data.status)}
                            <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 rounded-full"><LucideX size={20}/></button>
                        </div>
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
                                                {ans.mediaUrl && (<button onClick={() => setViewingMediaUrl(ans.mediaUrl!)} title="View Media" className="text-blue-500 hover:text-blue-700"><Eye size={16}/></button>)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 border-t bg-gray-50 rounded-b-lg">
                        <div className="flex items-center gap-2 text-sm">
                            <InformationCircleIcon className={`h-5 w-5 ${
                                data.status === 'Approved' ? 'text-green-600' : 
                                data.status === 'Rejected' ? 'text-red-600' : 
                                'text-yellow-600'
                            }`} />
                            <p className="text-gray-700">
                                {data.status === 'Awaiting Review' 
                                    ? <span className="font-medium">This submission is currently awaiting review.</span>
                                    : <>This submission was <span className="font-bold">{data.status.toLowerCase()}</span> on <span className="font-bold">{reviewDate}</span>.</>
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

const TaskCompliancePage = () => {
    const { data: session, status: sessionStatus } = useSession();
    
    // ▼▼▼ THIS LINE IS CORRECTED ▼▼▼
    const userPermissions = session?.user?.role?.permissions || [];

    const canManageReport = useMemo(() =>
        hasPermission(userPermissions, PERMISSIONS.REPORT_TASK_COMPLIANCE_MANAGE),
        [userPermissions]
    );

    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'review' | 'all'>('review');
    const [reviewModalData, setReviewModalData] = useState<ReviewModalData | null>(null);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    const fetchReport = useCallback(async () => {
        if (sessionStatus !== 'authenticated' || !startDate || !endDate) return;
        setIsLoading(true); setError(null);
        try {
            const apiUrl = `/api/tasks?view=reportGrid&startDate=${startDate}&endDate=${endDate}`;
            const result = await fetcher(apiUrl, session!.user.tenantId!);
            if (result.success) { setReportData(result.data); }
            else { throw new Error(result.error); }
        } catch (err: any) { setError(err.message); toast.error(err.message);
        } finally { setIsLoading(false); }
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
        if (submissionsForDay.length === 0) return;

        let dayStatus: 'Awaiting Review' | 'Approved' | 'Rejected' = 'Approved';
        if (submissionsForDay.some(s => s.status === 'Awaiting Review')) {
            dayStatus = 'Awaiting Review';
        } else if (submissionsForDay.some(s => s.status === 'Rejected')) {
            dayStatus = 'Rejected';
        }

        setReviewModalData({
            staffName: staff.name, date, submissions: submissionsForDay,
            staffId: staff._id, status: dayStatus
        });
    };

    const getStatusForCell = (staffId: string, date: Date) => {
        if (!reportData) return 'N/A';
        const dateString = format(date, 'yyyy-MM-dd');
        const submissions = reportData.submissions.filter(s => s.assignedTo === staffId && format(new Date(s.dueDate), 'yyyy-MM-dd') === dateString);
        const wasTaskAssigned = reportData.assignedTasks.some(t => t.assignedTo === staffId && format(new Date(t.dueDate), 'yyyy-MM-dd') === dateString);

        if (submissions.length > 0) {
            if (submissions.some(s => s.status === 'Awaiting Review')) return 'Pending';
            if (submissions.some(s => s.status === 'Rejected')) return 'Rejected';
            return 'Approved';
        }
        if (wasTaskAssigned) return 'Missed';
        return 'N/A';
    };

    const handleExportPDF = () => {
        setIsExportMenuOpen(false);
        if (!reportData) return toast.error("No data available to export.");

        const doc = new jsPDF({ orientation: 'landscape' });
        
        doc.text('Task Compliance Report', 14, 16);
        doc.text(`Period: ${format(new Date(startDate), 'PP')} to ${format(new Date(endDate), 'PP')}`, 14, 22);

        const tableColumn = ["Staff Member", ...datesInRange.map(date => format(date, 'MMM\nd'))];
        const tableRows: (string[])[] = [];

        filteredStaff.forEach(staff => {
            const rowData = [staff.name, ...datesInRange.map(date => getStatusForCell(staff._id, date))];
            tableRows.push(rowData);
        });
        
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: [22, 160, 133], halign: 'center' },
            styles: { halign: 'center' },
        });

        doc.save(`Task_Compliance_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const handleExportExcel = () => {
        setIsExportMenuOpen(false);
        if (!reportData) return toast.error("No data available to export.");
        
        const headers = ["Staff Member", ...datesInRange.map(date => format(date, 'MMM d'))];
        const data = filteredStaff.map(staff => [
            staff.name,
            ...datesInRange.map(date => getStatusForCell(staff._id, date))
        ]);

        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Compliance Report");
        XLSX.writeFile(wb, `Task_Compliance_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    return (
        <div className="p-6 sm:p-8 bg-gray-50 min-h-screen">
            <ToastContainer position="top-right" autoClose={3000} />

            {reviewModalData && <ReviewModal data={reviewModalData} onClose={() => setReviewModalData(null)} />}
            
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Task Compliance Report</h1>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-4">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input text-sm"/>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input text-sm"/>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setFilter('review')} className={`px-4 py-2 text-sm font-semibold rounded-md ${filter === 'review' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>Awaiting Review</button>
                    <button onClick={() => setFilter('all')} className={`px-4 py-2 text-sm font-semibold rounded-md ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>Show All</button>
                    {canManageReport && (
                        <div className="relative">
                            <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border rounded-md hover:bg-gray-50">
                                <FileDown size={16} />
                                <span>Export Report</span>
                                <ChevronDownIcon className={`h-5 w-5 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isExportMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border">
                                    <ul className="py-1">
                                        <li><a href="#" onClick={(e) => { e.preventDefault(); handleExportPDF(); }} className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><FileText size={16} className="text-red-500" /><span>Export as PDF</span></a></li>
                                        <li><a href="#" onClick={(e) => { e.preventDefault(); handleExportExcel(); }} className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><FileSpreadsheet size={16} className="text-green-600" /><span>Export as Excel</span></a></li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
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
                                    const wasTaskAssigned = reportData!.assignedTasks.some(t => t.assignedTo === staff._id && format(new Date(t.dueDate), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
                                    const submissions = reportData!.submissions.filter(s => s.assignedTo === staff._id && format(new Date(s.dueDate), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
                                    
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