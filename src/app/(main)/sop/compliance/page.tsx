'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { format, eachDayOfInterval } from 'date-fns';
import { CheckCircleIcon, XCircleIcon, MinusCircleIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { Loader2 } from 'lucide-react';
import SubmissionDetailsModal from '../components/SubmissionDetailsModal';

// --- ROBUSTNESS: Strong types for the entire report data structure ---
interface Role { _id: string; displayName: string; }
interface Staff { _id: string; name: string; roleId: Role; }

interface Checklist {
  _id: string;
  title: string;
  roles: string[];
  checklistItems: {
    _id: string;
    questionText: string;
    responseType: 'yes_no' | 'yes_no_remarks';
    mediaUpload: 'none' | 'optional' | 'required';
  }[];
}
interface Submission {
  _id: string;
  sop: string;
  staff: string;
  submissionDate: string;
  status: 'pending_review' | 'approved' | 'rejected';
  responses: {
    _id: string;
    checklistItem: string;
    answer: 'yes' | 'no' | '';
    remarks?: string;
    mediaUrl?: string;
  }[];
}
interface ReportData {
  staff: Staff[];
  checklists: Checklist[];
  submissions: Submission[];
}

// --- FIX #2 (Part 1): Define strong types for the data passed to the modal ---
// This represents a submission that has been enriched with its parent checklist's title and question text
interface EnrichedSubmission extends Submission {
  checklistTitle: string;
  responses: (Submission['responses'][0] & { text: string })[];
}

// This is the complete shape of the data held by the `viewingDetails` state
interface ViewingDetailsData {
  staffName: string;
  date: Date;
  submissions: EnrichedSubmission[];
}


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

export default function SopReportPage() {
    const { data: session } = useSession();
    const [endDate, setEndDate] = useState(new Date());
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 6); // Default to the last 7 days
        return d;
    });
    
    // --- FIX #2 (Part 2): Use the new strong type for the state instead of 'any' ---
    const [viewingDetails, setViewingDetails] = useState<ViewingDetailsData | null>(null);
    const [filter, setFilter] = useState<'unreviewed' | 'all'>('unreviewed');

    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    const apiUrl = session ? `/api/sop/reports/submissions?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}` : null;
    
    // --- FIX #1: Add the 'string' type to the 'url' parameter ---
    const { data, error, mutate } = useSWR<ReportData>(apiUrl, (url: string) => fetcherWithAuth(url, session!.user.tenantId));

    const canViewReport = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.SOP_REPORTS_READ);

    const handleAcknowledged = (submissionId: string, newStatus: 'approved' | 'rejected') => {
        mutate((currentData) => {
            if (!currentData) return currentData;
            const newSubmissions = currentData.submissions.map((sub) => {
                if (sub._id === submissionId) {
                    return { ...sub, status: newStatus };
                }
                return sub;
            });
            return { ...currentData, submissions: newSubmissions };
        }, false);

        // --- FIX #2 (Part 3): The 'prev' parameter is now correctly typed as ViewingDetailsData | null ---
        // This resolves the second TypeScript error automatically.
        setViewingDetails(prev => {
            if (!prev) return null;
            const newSubmissionsInModal = prev.submissions.map((sub) => {
                 if (sub._id === submissionId) {
                    return { ...sub, status: newStatus };
                }
                return sub;
            });
            
            const allResolved = newSubmissionsInModal.every((s) => s.status !== 'pending_review');
            if (allResolved) {
                onClose();
            }
            
            return { ...prev, submissions: newSubmissionsInModal };
        });
    };
    
    const onClose = () => setViewingDetails(null);

    const handleViewDetails = (staff: Staff, date: Date) => {
        if (!data) return;
        const dateStringToCheck = format(date, 'yyyy-MM-dd');
        
        const submissionsForDay: EnrichedSubmission[] = data.submissions
            .filter((s: Submission) => s.staff === staff._id && format(new Date(s.submissionDate), 'yyyy-MM-dd') === dateStringToCheck)
            .map((sub: Submission) => {
                const checklist = data.checklists.find((c: Checklist) => c._id === sub.sop);

                if (!checklist) {
                    console.warn(`Could not find parent SOP for submission ID: ${sub._id}.`);
                    return {
                        ...sub,
                        checklistTitle: 'Archived or Deleted SOP',
                        responses: sub.responses.map(r => ({...r, text: "Question not found"})),
                    };
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
                    <div className="flex items-center gap-2">
                        <button onClick={() => setFilter('unreviewed')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${filter === 'unreviewed' ? 'bg-blue-600 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Awaiting Review</button>
                        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${filter === 'all' ? 'bg-blue-600 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Show All</button>
                    </div>
                </div>

                <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
                    {error && <div className="p-4 text-red-500 font-medium">{error.message}</div>}
                    {(!data && !error) && (
                        <div className="p-10 flex justify-center items-center">
                            <Loader2 className="animate-spin text-gray-400" size={32} />
                        </div>
                    )}
                    {data && Array.isArray(data.staff) && (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 border-r">Staff Member</th>
                                    {dateRange.map(date => (
                                        <th key={date.toISOString()} scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            {format(date, 'MMM d')}
                                        </th>
                                    ))}
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
                                            const dateStringToCheck = format(date, 'yyyy-MM-dd');
                                            const submissionsForDay = data.submissions.filter(s => s.staff === staff._id && format(new Date(s.submissionDate), 'yyyy-MM-dd') === dateStringToCheck);

                                            let tooltipText = "No checklists assigned";
                                            let statusIcon = <MinusCircleIcon className="h-6 w-6 text-gray-400" />;
                                            let isClickable = false;

                                            if (assignedChecklists.length > 0) {
                                                if (submissionsForDay.length === 0) {
                                                    statusIcon = <XCircleIcon className="h-6 w-6 text-red-500" />;
                                                    tooltipText = "Missed";
                                                } else {
                                                    isClickable = true;
                                                    if (submissionsForDay.some(s => s.status === 'rejected')) {
                                                        statusIcon = <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />;
                                                        tooltipText = "Rejected - Click to view";
                                                    } else if (submissionsForDay.length < assignedChecklists.length) {
                                                        statusIcon = <ClockIcon className="h-6 w-6 text-yellow-500" />;
                                                        tooltipText = "Partial Completion - Click to view";
                                                    } else if (submissionsForDay.some(s => s.status === 'pending_review')) {
                                                        statusIcon = <ClockIcon className="h-6 w-6 text-blue-500" />;
                                                        tooltipText = "Pending Review - Click to view";
                                                    } else {
                                                        statusIcon = <CheckCircleIcon className="h-6 w-6 text-green-500" />;
                                                        tooltipText = "Approved - Click to view";
                                                    }
                                                }
                                            }
                                            
                                            const isActionable = submissionsForDay.some(s => s.status === 'pending_review' || s.status === 'rejected');
                                            let shouldRender = true;
                                            if (filter === 'unreviewed' && !isActionable) {
                                               if (submissionsForDay.length > 0 && submissionsForDay.length === assignedChecklists.length) {
                                                   shouldRender = false;
                                               }
                                            }

                                            return (
                                                <td key={date.toISOString()} className="px-6 py-4 whitespace-nowrap text-center">
                                                    {shouldRender ? (
                                                        <div 
                                                            title={tooltipText}
                                                            className={`flex justify-center items-center ${isClickable ? 'cursor-pointer' : ''}`}
                                                            onClick={isClickable ? () => handleViewDetails(staff, date) : undefined}
                                                        >
                                                            {statusIcon}
                                                        </div>
                                                    ) : <div className="h-6 w-6" />}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {viewingDetails && (
                <SubmissionDetailsModal 
                    details={viewingDetails} 
                    onClose={onClose}
                    onAcknowledged={handleAcknowledged}
                />
            )}
        </>
    );
}