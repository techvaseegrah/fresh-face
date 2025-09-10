'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { format, isWithinInterval, startOfDay, endOfDay, startOfMonth, parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import {
    Calendar,
    Users,
    Hourglass,
    FileText,
    CalendarOff,
    FileSpreadsheet,
    FileDown,
    AlertCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
// --- ADDED: Import permission helpers ---
import { hasPermission, PERMISSIONS } from '../../../../lib/permissions';

// --- Interfaces ---
interface StaffMember {
    _id: string; name: string; staffIdNumber?: string; position?: string; image?: string;
}
interface LeaveRequest {
    _id: string; staff: StaffMember; leaveType: string; startDate: string; endDate: string; reason: string; status: 'Pending' | 'Approved' | 'Rejected'; createdAt: string;
}

// --- Reusable UI Components ---
const StatCard = ({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) => (
  <div className="bg-white p-5 rounded-xl shadow-md border border-gray-200/80 transition-all hover:shadow-lg hover:-translate-y-1">
    <div className="flex items-center justify-between"><p className="text-sm font-medium text-gray-500">{title}</p><div className="text-gray-400">{icon}</div></div>
    <p className="mt-2 text-3xl font-bold text-gray-800">{value}</p>
  </div>
);

const getStatusChip = (status: LeaveRequest['status']) => {
    const baseClasses = "px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize";
    if (status === 'Approved') return <span className={`${baseClasses} bg-green-100 text-green-800`}>{status}</span>;
    if (status === 'Rejected') return <span className={`${baseClasses} bg-red-100 text-red-800`}>{status}</span>;
    return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>{status}</span>;
};


// --- Main Report Component ---
const LeaveReport = () => {
    // --- ADDED: Get user permissions from session ---
    const { data: session, status: sessionStatus } = useSession();
    const userPermissions = useMemo(() => session?.user?.role?.permissions || [], [session]);

    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [startDate, setStartDate] = useState<Date | null>(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState<Date | null>(new Date());
    const [appliedDateRange, setAppliedDateRange] = useState({
        start: startOfMonth(new Date()),
        end: endOfDay(new Date()),
    });

    useEffect(() => {
        if (sessionStatus === 'authenticated' && session?.user?.tenantId) {
            const tenantId = session.user.tenantId;
            const headers = { 'x-tenant-id': tenantId };

            const fetchData = async () => {
                setLoading(true);
                setError(null);
                try {
                    const leaveRes = await fetch('/api/leave', { headers });
                    if (!leaveRes.ok) {
                        throw new Error(`Failed to fetch leave requests. The report cannot be displayed.`);
                    }
                    const leaveData = await leaveRes.json();
                    setLeaveRequests(leaveData.data || []);

                    const staffRes = await fetch('/api/staff?action=list', { headers });
                    if (staffRes.ok) {
                        const staffData = await staffRes.json();
                        setStaffList(staffData.data || []);
                    } else {
                        console.warn("Could not fetch the staff list, possibly due to missing 'STAFF_LIST_READ' permission. 'Total Staff' card may be inaccurate.");
                        setStaffList([]);
                    }
                } catch (err: any) {
                    setError(err.message);
                    toast.error(`Error: ${err.message}`);
                } finally {
                    setLoading(false);
                }
            };
            fetchData();
        }
    }, [sessionStatus, session]);

    const handleFetchReport = () => {
        if (!startDate || !endDate) return toast.error("Please select both a start and end date.");
        setAppliedDateRange({ start: startOfDay(startDate), end: endOfDay(endDate) });
        toast.success("History filtered for the selected date range.");
    };

    const { pendingRequests, onLeaveToday, filteredHistoryRequests } = useMemo(() => {
        const pending = leaveRequests.filter(req => req.status === 'Pending');
        const today = new Date();
        const onLeave = leaveRequests.filter(req =>
            req.status === 'Approved' && isWithinInterval(today, { start: startOfDay(new Date(req.startDate)), end: endOfDay(new Date(req.endDate)) })
        ).length;
        const history = leaveRequests
            .filter(req => req.status !== 'Pending' && isWithinInterval(new Date(req.startDate), appliedDateRange))
            .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        return { pendingRequests: pending, onLeaveToday: onLeave, filteredHistoryRequests: history };
    }, [leaveRequests, appliedDateRange]);

    const handleExportExcel = () => {
        const dataToExport = filteredHistoryRequests.map(req => ({
            'Staff ID': req.staff.staffIdNumber || 'N/A',
            'Staff Name': req.staff.name,
            'Leave Type': req.leaveType,
            'Start Date': format(new Date(req.startDate), 'dd MMM, yyyy'),
            'End Date': format(new Date(req.endDate), 'dd MMM, yyyy'),
            'Status': req.status,
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Leave History");
        XLSX.writeFile(workbook, `Leave_History_Report.xlsx`);
        toast.success("Downloaded as Excel.");
    };

    const handleExportPdf = () => {
        const doc = new jsPDF();
        const tableColumn = ["Staff ID", "Staff Name", "Leave Type", "Dates", "Status"];
        const tableRows: any[] = [];
        filteredHistoryRequests.forEach(req => {
            const reqData = [
                req.staff.staffIdNumber || 'N/A', req.staff.name, req.leaveType,
                `${format(new Date(req.startDate), 'dd MMM')} - ${format(new Date(req.endDate), 'dd MMM yyyy')}`,
                req.status
            ];
            tableRows.push(reqData);
        });
        
        autoTable(doc, { head: [tableColumn], body: tableRows, startY: 20 });
        doc.text("Leave Request History", 14, 15);
        doc.save(`Leave_History_Report.pdf`);
        toast.success("Downloaded as PDF.");
    };

    if (loading || sessionStatus === 'loading') return <div className="flex items-center justify-center h-screen bg-slate-50 text-xl text-gray-600">Loading Leave Report...</div>;
    
    // --- ADDED: Handle access denied state ---
    if (sessionStatus === 'unauthenticated' || !hasPermission(userPermissions, PERMISSIONS.REPORT_LEAVE_READ)) {
        return (
            <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
                    <p className="mt-2 text-gray-600">You do not have permission to view this report.</p>
                </div>
            </div>
        );
    }
    
    if (error) return (
        <div className="p-8 text-center text-red-700 bg-red-50 rounded-lg flex items-center justify-center gap-3">
            <AlertCircle size={24} />
            <p className='font-semibold'>{error}</p>
        </div>
    );

    return (
        <div className="font-sans">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Leave Report</h1>
                    <p className="text-gray-500 mt-1 text-sm">View and filter historical leave data.</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span className="text-sm font-medium text-gray-600">From:</span>
                    <input type="date" value={startDate ? format(startDate, 'yyyy-MM-dd') : ''} onChange={(e) => setStartDate(e.target.value ? parseISO(e.target.value) : null)} className="p-2 border border-gray-300 rounded-md shadow-sm text-sm" />
                    <span className="text-sm font-medium text-gray-600">To:</span>
                    <input type="date" value={endDate ? format(endDate, 'yyyy-MM-dd') : ''} onChange={(e) => setEndDate(e.target.value ? parseISO(e.target.value) : null)} min={startDate ? format(startDate, 'yyyy-MM-dd') : undefined} className="p-2 border border-gray-300 rounded-md shadow-sm text-sm" />
                    <Button onClick={handleFetchReport} className="bg-purple-600 hover:bg-purple-700 text-white" disabled={!startDate || !endDate}>Fetch Report</Button>
                </div>
            </div>

            <Card>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <StatCard icon={<Hourglass size={24} />} title="Pending Requests" value={pendingRequests.length} />
                    <StatCard icon={<CalendarOff size={24} />} title="Staff on Leave Today" value={onLeaveToday} />
                    <StatCard icon={<Users size={24} />} title="Total Staff Members" value={staffList.length} />
                </div>

                <div>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-5">
                        <h3 className="text-2xl font-bold text-gray-700">Leave History</h3>
                        {/* --- MODIFIED: Conditionally render export buttons based on permission --- */}
                        {hasPermission(userPermissions, PERMISSIONS.REPORT_LEAVE_MANAGE) && (
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={filteredHistoryRequests.length === 0}><FileSpreadsheet size={16} className="mr-2"/>Excel</Button>
                                <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={filteredHistoryRequests.length === 0}><FileDown size={16} className="mr-2"/>PDF</Button>
                            </div>
                        )}
                    </div>
                    <LeaveHistoryTable requests={filteredHistoryRequests} />
                </div>
            </Card>
        </div>
    );
};


// --- Sub-components (No changes here) ---
const LeaveHistoryTable = ({ requests }: { requests: LeaveRequest[]; }) => {
    if (requests.length === 0) {
        return (
            <div className="text-center py-16 bg-white rounded-xl shadow-md border border-gray-200/80 text-gray-500">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <p>No leave history found for this period.</p>
            </div>
        );
    }
    return (
        <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200/80">
            <div className="overflow-x-auto hidden md:block">
                <table className="min-w-full">
                    <thead className="bg-slate-100">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Staff Member</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Leave Type</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Dates</th>
                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {requests.map((req) => (
                            <tr key={req._id} className="hover:bg-slate-50 transition-colors duration-200">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <img className="h-11 w-11 rounded-full object-cover" src={req.staff.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.staff.name)}&background=random&color=fff`} alt={req.staff.name} />
                                        <div className="ml-4">
                                            <div className="text-sm font-semibold text-gray-900">{req.staff.name}</div>
                                            <div className="text-sm text-gray-500">{req.staff.position || 'Staff'}</div>
                                            <div className="text-xs text-gray-400">ID: {req.staff.staffIdNumber || 'N/A'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{req.leaveType}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{format(new Date(req.startDate), 'dd MMM')} - {format(new Date(req.endDate), 'dd MMM yyyy')}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">{getStatusChip(req.status)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="block md:hidden divide-y divide-gray-200">
                 {requests.map((req) => (
                    <div key={req._id} className="p-4">
                        <div className='flex justify-between items-start gap-3'>
                            <div className="flex items-center gap-3 flex-1">
                                <img className="h-11 w-11 rounded-full object-cover" src={req.staff.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.staff.name)}`} alt={req.staff.name} />
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{req.staff.name}</p>
                                    <p className="text-xs text-gray-500">ID: {req.staff.staffIdNumber || 'N/A'}</p>
                                    <p className="text-xs text-gray-500">{req.leaveType}</p>
                                </div>
                            </div>
                            {getStatusChip(req.status)}
                        </div>
                        <div className='mt-3 pl-1 text-sm text-gray-600'>
                            {format(new Date(req.startDate), 'dd MMM')} - {format(new Date(req.endDate), 'dd MMM yyyy')}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Page Wrapper ---
export default function LeaveReportPage() {
    return <LeaveReport />;
}