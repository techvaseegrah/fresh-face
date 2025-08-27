'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'react-toastify';
import {
    Plus,
    X,
    Calendar,
    Users,
    Hourglass,
    Trash2,
    CheckCircle2,
    XCircle,
    FileText,
    CalendarOff
} from 'lucide-react';

// --- Interfaces ---
interface StaffMember {
    _id: string;
    name: string;
    staffIdNumber?: string;
    position?: string;
    image?: string;
}

interface LeaveRequest {
    _id: string;
    staff: StaffMember;
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
    status: 'Pending' | 'Approved' | 'Rejected';
    createdAt: string;
}

interface LeaveType {
    _id: string;
    name: string;
}

// --- Reusable UI Components ---

const StatCard = ({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) => (
  <div className="bg-white p-5 rounded-xl shadow-md border border-gray-200/80 transition-all hover:shadow-lg hover:-translate-y-1">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <div className="text-gray-400">{icon}</div>
    </div>
    <p className="mt-2 text-3xl font-bold text-gray-800">{value}</p>
  </div>
);

const getStatusChip = (status: LeaveRequest['status']) => {
    const baseClasses = "px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize";
    if (status === 'Approved') {
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>{status}</span>;
    }
    if (status === 'Rejected') {
        return <span className={`${baseClasses} bg-red-100 text-red-800`}>{status}</span>;
    }
    return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>{status}</span>;
};


// --- Main Component ---
const LeaveManagementPage = () => {
    const { data: session, status: sessionStatus } = useSession();

    // State management
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // UI State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
    const [isLeaveTypeFormOpen, setIsLeaveTypeFormOpen] = useState(false);
    const [selectedStaffHistory, setSelectedStaffHistory] = useState<LeaveRequest[]>([]);
    const [selectedStaffDetails, setSelectedStaffDetails] = useState<StaffMember | null>(null);

    // --- Data Fetching ---
    const fetchData = async (tenantId: string) => {
        setLoading(true);
        setError(null);
        const headers = { 'x-tenant-id': tenantId };
        try {
            const [leaveRes, staffRes, leaveTypeRes] = await Promise.all([
                fetch('/api/leave', { headers }),
                fetch('/api/staff?action=listForBilling', { headers }),
                fetch('/api/leavetypes', { headers })
            ]);

            if (!leaveRes.ok) throw new Error(`Failed to fetch leave requests`);
            if (!staffRes.ok) throw new Error(`Failed to fetch staff list`);
            if (!leaveTypeRes.ok) throw new Error(`Failed to fetch leave types`);
            
            const leaveData = await leaveRes.json();
            const staffData = await staffRes.json();
            const leaveTypeData = await leaveTypeRes.json();

            setLeaveRequests(leaveData.data || []);
            setStaffList(staffData.staff || []);
            setLeaveTypes(leaveTypeData.data || []);

        } catch (err: any) {
            setError(err.message);
            toast.error(`Error fetching data: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (sessionStatus === 'authenticated' && session?.user?.tenantId) {
            fetchData(session.user.tenantId);
        } else if (sessionStatus === 'unauthenticated') {
            setError("You are not authenticated.");
            setLoading(false);
        }
    }, [sessionStatus, session]);

    // --- Action Handlers ---
    const handleUpdateRequestStatus = async (id: string, status: 'Approved' | 'Rejected') => {
        if (!session?.user?.tenantId) return toast.error("Session invalid.");

        const originalRequests = [...leaveRequests];
        setLeaveRequests(prev => prev.map(req => req._id === id ? { ...req, status } : req));

        const actionPromise = fetch(`/api/leave?id=${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': session.user.tenantId },
            body: JSON.stringify({ status }),
        });

        toast.promise(actionPromise, {
            pending: `Updating request to ${status}...`,
            success: `Request has been ${status.toLowerCase()}.`,
            error: `Failed to update request.`
        });
        
        try {
            const response = await actionPromise;
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            // Re-fetch data for consistency
             if (session?.user?.tenantId) fetchData(session.user.tenantId);
        } catch (err) {
            // Revert on error
            setLeaveRequests(originalRequests);
        }
    };

    const handleCreateRequest = async (formData: Omit<LeaveRequest, '_id' | 'status' | 'createdAt' | 'staff'> & { staff: string }) => {
        if (!session?.user?.tenantId) return toast.error("Session invalid.");

        const createPromise = fetch('/api/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': session.user.tenantId },
            body: JSON.stringify(formData),
        });
        
        toast.promise(createPromise, {
            pending: 'Submitting new leave request...',
            success: 'Leave request submitted successfully!',
            error: 'Failed to create request.'
        });

        try {
            const response = await createPromise;
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            setLeaveRequests(prev => [result.data, ...prev]);
            setIsFormOpen(false);
        } catch (err) {
           // Error toast is already shown by toast.promise
        }
    };
    
    const handleOpenHistory = (staffId: string) => {
        const staffMember = staffList.find(s => s._id === staffId);
        if (staffMember) {
            setSelectedStaffDetails(staffMember);
            const history = leaveRequests.filter(req => req.staff._id === staffId);
            setSelectedStaffHistory(history);
            setIsHistoryDrawerOpen(true);
        }
    };

    const handleAddLeaveType = async (name: string) => {
        if (!session?.user?.tenantId) return toast.error("Session invalid.");
        
        const addPromise = fetch('/api/leavetypes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': session.user.tenantId },
            body: JSON.stringify({ name }),
        });

        toast.promise(addPromise, {
            pending: 'Adding new leave type...',
            success: `Leave type "${name}" added.`,
            error: 'Failed to add leave type.'
        });

        try {
            const response = await addPromise;
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            setLeaveTypes(prev => [...prev, result.data]);
            setIsLeaveTypeFormOpen(false);
        } catch (err) {
            // Error handled by toast
        }
    };

    const handleDeleteLeaveType = async (id: string) => {
        if (!session?.user?.tenantId) return toast.error("Session invalid.");
        
        if (!confirm('Are you sure you want to delete this leave type?')) return;

        const deletePromise = fetch(`/api/leavetypes?id=${id}`, {
            method: 'DELETE',
            headers: { 'x-tenant-id': session.user.tenantId },
        });

        toast.promise(deletePromise, {
            pending: 'Deleting leave type...',
            success: 'Leave type deleted.',
            error: 'Failed to delete leave type.'
        });
        
        try {
             const response = await deletePromise;
             const result = await response.json();
             if (!result.success) throw new Error(result.error);
             setLeaveTypes(prev => prev.filter(lt => lt._id !== id));
        } catch (err) {
             // Error handled by toast
        }
    };

    // --- Memos ---
    const pendingRequests = useMemo(() => leaveRequests.filter(req => req.status === 'Pending'), [leaveRequests]);
    const historyRequests = useMemo(() => leaveRequests.filter(req => req.status !== 'Pending').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [leaveRequests]);
    const onLeaveToday = useMemo(() => {
        const today = new Date();
        return leaveRequests.filter(req =>
            req.status === 'Approved' &&
            isWithinInterval(today, { start: startOfDay(new Date(req.startDate)), end: endOfDay(new Date(req.endDate)) })
        ).length;
    }, [leaveRequests]);

    if (loading || sessionStatus === 'loading') {
        return <div className="flex items-center justify-center h-screen bg-slate-50 text-xl text-gray-600">Loading Leave Data...</div>;
    }

    if (error) {
        return <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg">{error}</div>;
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 min-h-screen font-sans">
            {/* --- Header --- */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 flex items-center gap-3">
                        <Calendar className="text-indigo-500" /> Leave Management
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm sm:text-base">Track and manage all employee leave requests.</p>
                </div>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:px-5 bg-black text-white font-semibold rounded-xl shadow-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75 transition-all duration-300 transform hover:scale-105"
                >
                    <Plus size={20} />
                    New Leave Request
                </button>
            </div>
            
            {/* --- New Request Form --- */}
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isFormOpen ? 'max-h-[600px] opacity-100 mb-8' : 'max-h-0 opacity-0'}`}>
                <NewLeaveRequestForm
                    onClose={() => setIsFormOpen(false)}
                    onSubmit={handleCreateRequest}
                    staffList={staffList}
                    leaveTypes={leaveTypes}
                />
            </div>

            {/* --- Stat Cards --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard icon={<Hourglass size={24} />} title="Pending Requests" value={pendingRequests.length} />
                <StatCard icon={<CalendarOff size={24} className="text-green-500"/>} title="Staff on Leave Today" value={onLeaveToday} />
                <StatCard icon={<Users size={24} />} title="Total Staff Members" value={staffList.length} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* --- Main Content (Pending & History) --- */}
                <div className="lg:col-span-2 space-y-10">
                    {/* --- Pending Requests Section --- */}
                    <div>
                        <h3 className="text-2xl font-bold text-gray-700 mb-5">Pending Requests</h3>
                        {pendingRequests.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {pendingRequests.map(req => (
                                    <PendingLeaveCard key={req._id} request={req} onUpdate={handleUpdateRequestStatus} />
                                ))}
                            </div>
                        ) : (
                             <div className="text-center py-16 bg-white rounded-xl shadow-md border border-gray-200/80 text-gray-500">
                                <CheckCircle2 size={48} className="mx-auto text-green-400 mb-4" />
                                <p className="font-semibold text-lg">All caught up!</p>
                                <p>There are no pending leave requests.</p>
                            </div>
                        )}
                    </div>
                    
                    {/* --- History Section --- */}
                     <div>
                        <h3 className="text-2xl font-bold text-gray-700 mb-5">Request History</h3>
                        <LeaveHistoryTable requests={historyRequests} onRowClick={handleOpenHistory} />
                    </div>
                </div>

                {/* --- Sidebar (Leave Type Manager) --- */}
                <div className="lg:col-span-1">
                     <LeaveTypeManager
                        leaveTypes={leaveTypes}
                        onAdd={() => setIsLeaveTypeFormOpen(true)}
                        onDelete={handleDeleteLeaveType}
                    />
                </div>
            </div>

            {/* --- Modals / Drawers --- */}
            <AddLeaveTypeForm
                open={isLeaveTypeFormOpen}
                onClose={() => setIsLeaveTypeFormOpen(false)}
                onSubmit={handleAddLeaveType}
            />
            
            <EmployeeHistoryDrawer
                open={isHistoryDrawerOpen}
                onClose={() => setIsHistoryDrawerOpen(false)}
                requests={selectedStaffHistory}
                staffDetails={selectedStaffDetails}
            />
        </div>
    );
};

// --- Sub Components ---

const PendingLeaveCard = ({ request, onUpdate }: { request: LeaveRequest; onUpdate: (id: string, status: 'Approved' | 'Rejected') => void; }) => (
    <div className="bg-white rounded-xl shadow-md border border-gray-200/80 flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <div className="p-5 flex items-center gap-4 border-b border-gray-200">
        <img className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-200" src={request.staff.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(request.staff.name)}&background=random&color=fff`} alt={request.staff.name} />
        <div>
          <p className="font-bold text-gray-800">{request.staff.name}</p>
          <p className="text-sm text-gray-500">{request.staff.position || 'Staff'}</p>
          <p className="text-xs text-gray-400">ID: {request.staff.staffIdNumber || 'N/A'}</p>
        </div>
      </div>
      <div className="p-5 flex-grow space-y-3">
         <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">{request.leaveType}</span>
         <div className="text-sm font-medium text-gray-700">
            {format(new Date(request.startDate), 'dd MMM, yyyy')} - {format(new Date(request.endDate), 'dd MMM, yyyy')}
         </div>
         <div>
            <p className="text-sm text-gray-500 mb-1">Reason</p>
            <p className="text-sm text-gray-700 bg-gray-100 p-2 rounded-md h-16 overflow-y-auto">{request.reason}</p>
         </div>
      </div>
      <div className="p-4 bg-gray-50/50 flex gap-3 rounded-b-xl">
        {/* --- FIX START --- */}
        <button onClick={() => onUpdate(request._id, 'Approved')} className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all">
          <CheckCircle2 size={16} /> Approve
        </button>
        <button onClick={() => onUpdate(request._id, 'Rejected')} className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-all">
          <XCircle size={16} /> Reject
        </button>
        {/* --- FIX END --- */}
      </div>
    </div>
);

const LeaveHistoryTable = ({ requests, onRowClick }: { requests: LeaveRequest[]; onRowClick: (staffId: string) => void; }) => {
    if (requests.length === 0) {
        return (
            <div className="text-center py-16 bg-white rounded-xl shadow-md border border-gray-200/80 text-gray-500">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <p>No leave history found.</p>
            </div>
        );
    }
    return (
        <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200/80">
            {/* Desktop Table */}
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
                            <tr key={req._id} onClick={() => onRowClick(req.staff._id)} className="hover:bg-slate-50 transition-colors duration-200 cursor-pointer">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <img className="h-11 w-11 rounded-full object-cover" src={req.staff.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.staff.name)}&background=random&color=fff`} alt={req.staff.name} />
                                        <div className="ml-4">
                                            <div className="text-sm font-semibold text-gray-900">{req.staff.name}</div>
                                            <div className="text-sm text-gray-500">{req.staff.position || 'Staff'}</div>
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

            {/* Mobile List */}
            <div className="block md:hidden divide-y divide-gray-200">
                 {requests.map((req) => (
                    <div key={req._id} className="p-4" onClick={() => onRowClick(req.staff._id)}>
                        <div className='flex justify-between items-start gap-3'>
                            <div className="flex items-center gap-3 flex-1">
                                <img className="h-11 w-11 rounded-full object-cover" src={req.staff.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.staff.name)}`} alt={req.staff.name} />
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{req.staff.name}</p>
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

const NewLeaveRequestForm = ({ onClose, onSubmit, staffList, leaveTypes }: { onClose: () => void; onSubmit: (data: any) => void; staffList: StaffMember[], leaveTypes: LeaveType[] }) => {
    const [formData, setFormData] = useState({ staff: '', leaveType: '', startDate: '', endDate: '', reason: '' });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.staff || !formData.leaveType || !formData.startDate || !formData.endDate || !formData.reason) {
            return toast.error("Please fill out all fields.");
        }
        onSubmit(formData);
        setFormData({ staff: '', leaveType: '', startDate: '', endDate: '', reason: '' });
    };

    const commonInputClasses = "w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-gray-900";

    return (
        <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-200/80">
            <h2 className="text-xl font-semibold mb-5 text-gray-800">New Leave Request Form</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="staff" className="block text-sm font-medium text-gray-600 mb-1">Staff Member*</label>
                        <select id="staff" name="staff" required value={formData.staff} onChange={handleChange} className={commonInputClasses}>
                            <option value="">Select Staff</option>
                            {staffList.map(staff => <option key={staff._id} value={staff._id}>{staff.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="leaveType" className="block text-sm font-medium text-gray-600 mb-1">Leave Type*</label>
                        <select id="leaveType" name="leaveType" required value={formData.leaveType} onChange={handleChange} className={commonInputClasses}>
                            <option value="">Select Type</option>
                             {leaveTypes.map(lt => <option key={lt._id} value={lt.name}>{lt.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="startDate" className="block text-sm font-medium text-gray-600 mb-1">Start Date*</label>
                        <input id="startDate" name="startDate" type="date" required value={formData.startDate} onChange={handleChange} className={commonInputClasses}/>
                    </div>
                     <div>
                        <label htmlFor="endDate" className="block text-sm font-medium text-gray-600 mb-1">End Date*</label>
                        <input id="endDate" name="endDate" type="date" required value={formData.endDate} onChange={handleChange} className={commonInputClasses}/>
                    </div>
                    <div className="md:col-span-2">
                         <label htmlFor="reason" className="block text-sm font-medium text-gray-600 mb-1">Reason for Leave*</label>
                         <textarea id="reason" name="reason" rows={3} required value={formData.reason} onChange={handleChange} className={commonInputClasses} placeholder="Please provide a reason..."/>
                    </div>
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="w-full sm:w-auto px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors">Cancel</button>
                    <button type="submit" className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-gray-800 text-white font-semibold rounded-lg hover:bg-black transition-colors">
                        <FileText size={16} /> Submit Request
                    </button>
                </div>
            </form>
        </div>
    );
};

const EmployeeHistoryDrawer = ({ open, onClose, requests, staffDetails }: { open: boolean; onClose: () => void; requests: LeaveRequest[]; staffDetails: StaffMember | null }) => {
    return (
        <>
            <div className={`fixed inset-0 bg-black/60 z-40 transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}></div>
            <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-slate-50 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex flex-col h-full">
                    <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-white">
                        <h2 className="text-xl font-semibold text-gray-800">Employee Leave History</h2>
                        <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"><X size={24} /></button>
                    </div>
                    <div className="flex-grow p-4 sm:p-6 overflow-y-auto">
                        {staffDetails && (
                             <div className="flex items-center mb-6 p-4 bg-white rounded-xl shadow-md border">
                                <img className="h-16 w-16 rounded-full object-cover ring-2 ring-gray-300" src={staffDetails.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(staffDetails.name)}`} alt={staffDetails.name} />
                                <div className="ml-4">
                                    <h3 className="text-lg font-bold text-gray-900">{staffDetails.name}</h3>
                                    <p className="text-sm text-gray-600">{staffDetails.position || 'Staff'}</p>
                                    <p className="text-xs text-gray-500 mt-1">ID: {staffDetails.staffIdNumber || 'N/A'}</p>
                                </div>
                            </div>
                        )}
                        <div className="space-y-3">
                            {requests.length > 0 ? (
                                requests.map(req => (
                                    <div key={req._id} className="bg-white p-4 rounded-lg border shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <p className="font-semibold text-gray-800">{req.leaveType}</p>
                                            {getStatusChip(req.status)}
                                        </div>
                                        <p className="text-sm text-gray-500 my-1">{format(new Date(req.startDate), 'dd MMM')} - {format(new Date(req.endDate), 'dd MMM yyyy')}</p>
                                        <p className="text-xs text-gray-600 italic">"{req.reason}"</p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-gray-500 bg-white rounded-lg border">
                                    <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                                    <p>No leave history for this employee.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

const LeaveTypeManager = ({ leaveTypes, onAdd, onDelete }: { leaveTypes: LeaveType[], onAdd: () => void, onDelete: (id: string) => void }) => {
    return (
        <div className="bg-white p-5 rounded-xl shadow-xl border border-gray-200/80 h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-700">Leave Types</h3>
                <button onClick={onAdd} className="flex items-center gap-1 text-sm font-semibold text-black hover:text-gray-700 transition-colors">
                    <Plus size={16} /> Add New
                </button>
            </div>
            <div className="space-y-2">
                {leaveTypes.map(lt => (
                    <div key={lt._id} className="flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100 rounded-lg">
                        <span className="text-sm font-medium text-gray-800">{lt.name}</span>
                        <button onClick={() => onDelete(lt._id)} className="p-1 text-gray-400 hover:text-red-600 rounded-full transition-colors">
                            <Trash2 size={16}/>
                        </button>
                    </div>
                ))}
                 {leaveTypes.length === 0 && <p className="text-center text-sm text-gray-500 pt-4">No custom leave types added.</p>}
            </div>
        </div>
    );
};

const AddLeaveTypeForm = ({ open, onClose, onSubmit }: { open: boolean, onClose: () => void, onSubmit: (name: string) => void }) => {
    const [name, setName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name.trim());
        setName('');
    };
    
    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                 <div className="p-5 border-b">
                    <h3 className="text-lg font-semibold">Add New Leave Type</h3>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-5">
                        <label htmlFor="leave-type-name" className="text-sm font-medium text-gray-600">Name</label>
                        <input
                            id="leave-type-name"
                            autoFocus
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
                        />
                    </div>
                    <div className="flex justify-end gap-3 p-4 bg-gray-50 rounded-b-xl">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-black text-white font-semibold rounded-lg hover:bg-gray-800">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LeaveManagementPage;