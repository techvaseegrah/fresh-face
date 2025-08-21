'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { format, eachDayOfInterval, startOfDay } from 'date-fns';
import { CheckCircleIcon, XCircleIcon, MinusCircleIcon, ClockIcon } from '@heroicons/react/24/solid';
import SubmissionDetailsModal from '../components/SubmissionDetailsModal';

// A fetcher function that uses the manual header injection pattern
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
    
    const [viewingDetails, setViewingDetails] = useState<any | null>(null);
    const [filter, setFilter] = useState<'unreviewed' | 'all'>('unreviewed');

    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    const apiUrl = session ? `/api/sop/reports/submissions?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}` : null;
    const { data, error, mutate } = useSWR(apiUrl, (url) => fetcherWithAuth(url, session!.user.tenantId));

    const canViewReport = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.SOP_REPORTS_READ);

    // This function is passed to the modal and is called with the ID of the acknowledged submission.
    const handleAcknowledged = (acknowledgedSubmissionId: string) => {
        // We will manually update the local SWR cache for an instant UI change.
        mutate((currentData: any) => {
            if (!currentData) return currentData; // If there's no data yet, do nothing.

            // Create a new version of the submissions array
            const newSubmissions = currentData.submissions.map((sub: any) => {
                // If this is the submission we just updated, change its isReviewed status
                if (sub._id === acknowledgedSubmissionId) {
                    return { ...sub, isReviewed: true };
                }
                // Otherwise, leave it as is
                return sub;
            });
            
            // Return the full data object with the modified submissions array
            return { ...currentData, submissions: newSubmissions };
        }, false); // The 'false' tells SWR not to re-fetch from the API, since we've already updated the data locally.

        setViewingDetails(null); // Close the modal
    };
    
    // Opens the modal with the correct data for the clicked cell
    const handleViewDetails = (staff: any, date: Date) => {
        if (!data?.submissions) return;
        const dateToCheck = startOfDay(date);
        const submissionsForDay = data.submissions
            .filter((s: any) => s.staff.toString() === staff._id.toString() && startOfDay(new Date(s.submissionDate)).getTime() === dateToCheck.getTime())
            .map((sub: any) => {
                const checklist = data.checklists.find((c: any) => c._id.toString() === sub.sop.toString());
                return { ...sub, checklistTitle: checklist?.title || 'Unknown Checklist' };
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
                            <input id="startDate" type="date" value={format(startDate, 'yyyy-MM-dd')} onChange={e => setStartDate(new Date(e.target.value))} className="border-gray-300 rounded-md shadow-sm ml-2" />
                        </div>
                        <div>
                            <label htmlFor="endDate" className="text-sm font-medium text-gray-700">End Date</label>
                            <input id="endDate" type="date" value={format(endDate, 'yyyy-MM-dd')} onChange={e => setEndDate(new Date(e.target.value))} className="border-gray-300 rounded-md shadow-sm ml-2" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setFilter('unreviewed')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${filter === 'unreviewed' ? 'bg-blue-600 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Awaiting Review</button>
                        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${filter === 'all' ? 'bg-blue-600 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Show All</button>
                    </div>
                </div>

                <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
                    {error && <div className="p-4 text-red-500 font-medium">{error.message}</div>}
                    {(!data && !error) && <div className="p-4 text-gray-500">Loading report...</div>}
                    {data && Array.isArray(data.staff) && (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">Staff Member</th>
                                    {dateRange.map(date => (
                                        <th key={date.toISOString()} scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            {format(date, 'MMM d')}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {data.staff.map((staff: any) => (
                                    <tr key={staff._id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white hover:bg-gray-50 z-10 shadow-sm">
                                            <div className="font-medium text-gray-900">{staff.name}</div>
                                            <div className="text-sm text-gray-500">{staff.roleId.displayName}</div>
                                        </td>
                                        {dateRange.map(date => {
                                            const assignedChecklists = data.checklists.filter((c: any) => c.roles.some((roleId: string) => roleId.toString() === staff.roleId._id.toString()));
                                            const dateToCheck = startOfDay(date);
                                            const submissionsForDay = data.submissions.filter((s: any) => s.staff.toString() === staff._id.toString() && startOfDay(new Date(s.submissionDate)).getTime() === dateToCheck.getTime());

                                            let status: 'MISSED' | 'PARTIAL' | 'AWAITING_REVIEW' | 'REVIEWED' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE';
                                            if (assignedChecklists.length > 0) {
                                                if (submissionsForDay.length === 0) {
                                                    status = 'MISSED';
                                                } else {
                                                    const isReviewed = submissionsForDay.every((s: any) => s.isReviewed);
                                                    status = isReviewed ? 'REVIEWED' : 'AWAITING_REVIEW';
                                                    if (submissionsForDay.length < assignedChecklists.length) {
                                                        status = 'PARTIAL';
                                                    }
                                                }
                                            }

                                            let cellContent = null;
                                            const isClickable = status !== 'MISSED' && status !== 'NOT_APPLICABLE';

                                            if (status === 'NOT_APPLICABLE') {
                                                cellContent = <MinusCircleIcon className="h-6 w-6 text-gray-400" title="No checklists assigned" />;
                                            } else if (status === 'MISSED') {
                                                cellContent = <XCircleIcon className="h-6 w-6 text-red-500" title="Missed" />;
                                            } else if (status === 'PARTIAL') {
                                                cellContent = <ClockIcon className="h-6 w-6 text-yellow-500" title="Partial completion - Click to view" />;
                                            } else if (status === 'AWAITING_REVIEW') {
                                                cellContent = <CheckCircleIcon className="h-6 w-6 text-blue-500" title="Awaiting Review - Click to view" />;
                                            } else if (status === 'REVIEWED' && filter === 'all') {
                                                cellContent = <CheckCircleIcon className="h-6 w-6 text-green-500" title="Reviewed & Approved - Click to view" />;
                                            }

                                            return (
                                                <td key={date.toISOString()} className="px-6 py-4 whitespace-nowrap text-center">
                                                    {cellContent && (
                                                        <div 
                                                            className={`flex justify-center items-center ${isClickable ? 'cursor-pointer' : ''}`}
                                                            onClick={isClickable ? () => handleViewDetails(staff, date) : undefined}
                                                        >
                                                            {cellContent}
                                                        </div>
                                                    )}
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
                    onClose={() => setViewingDetails(null)} 
                    onAcknowledged={handleAcknowledged}
                />
            )}
        </>
    );
}