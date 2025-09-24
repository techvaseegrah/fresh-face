'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'react-toastify';
import { Plus, Calendar, CheckCircle2, FileText, Hourglass, CalendarOff } from 'lucide-react';

// --- Interfaces ---
interface LeaveRequest {
    _id: string;
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
const StaffLeavePage = () => {
    const { data: session, status: sessionStatus } = useSession();

    // State management
    const [myLeaveRequests, setMyLeaveRequests] = useState<LeaveRequest[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // UI State
    const [isFormOpen, setIsFormOpen] = useState(false);

    // --- Data Fetching ---
    const fetchData = async (tenantId: string) => {
        setLoading(true);
        setError(null);
        const headers = { 'x-tenant-id': tenantId };
        try {
            // NOTE: We now fetch from a staff-specific leave endpoint
            // and the general leave types endpoint.
            const [leaveRes, leaveTypeRes] = await Promise.all([
                fetch('/api/staff/leave', { headers }),
                fetch('/api/leavetypes', { headers })
            ]);

            if (!leaveRes.ok) throw new Error(`Failed to fetch your leave requests`);
            if (!leaveTypeRes.ok) throw new Error(`Failed to fetch leave types`);

            const leaveData = await leaveRes.json();
            const leaveTypeData = await leaveTypeRes.json();

            setMyLeaveRequests(leaveData.data || []);
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
    const handleCreateRequest = async (formData: Omit<LeaveRequest, '_id' | 'status' | 'createdAt'>) => {
        if (!session?.user?.tenantId) return toast.error("Session invalid.");

        const createPromise = fetch('/api/staff/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': session.user.tenantId },
            body: JSON.stringify(formData),
        });

        toast.promise(createPromise, {
            pending: 'Submitting your leave request...',
            success: 'Leave request submitted successfully!',
            error: 'Failed to submit your request.'
        });

        try {
            const response = await createPromise;
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            // Add the new request to the top of the list
            setMyLeaveRequests(prev => [result.data, ...prev]);
            setIsFormOpen(false);
        } catch (err) {
           // Error toast is already shown by toast.promise
        }
    };

    // --- Memos for display ---
    const pendingCount = useMemo(() => myLeaveRequests.filter(req => req.status === 'Pending').length, [myLeaveRequests]);
    const approvedCount = useMemo(() => myLeaveRequests.filter(req => req.status === 'Approved').length, [myLeaveRequests]);
    const onLeaveToday = useMemo(() => {
        const today = new Date();
        return myLeaveRequests.some(req =>
            req.status === 'Approved' &&
            isWithinInterval(today, { start: startOfDay(new Date(req.startDate)), end: endOfDay(new Date(req.endDate)) })
        );
    }, [myLeaveRequests]);


    if (loading || sessionStatus === 'loading') {
        return <div className="flex items-center justify-center h-screen bg-slate-50 text-xl text-gray-600">Loading Your Leave Data...</div>;
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
                        <Calendar className="text-indigo-500" /> My Leave
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm sm:text-base">Request time off and view your leave history.</p>
                </div>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:px-5 bg-black text-white font-semibold rounded-xl shadow-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75 transition-all duration-300 transform hover:scale-105"
                >
                    <Plus size={20} />
                    Request Time Off
                </button>
            </div>

            {/* --- New Request Form --- */}
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isFormOpen ? 'max-h-[600px] opacity-100 mb-8' : 'max-h-0 opacity-0'}`}>
                <NewLeaveRequestForm
                    onClose={() => setIsFormOpen(false)}
                    onSubmit={handleCreateRequest}
                    leaveTypes={leaveTypes}
                />
            </div>

             {/* --- Stat Cards --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard icon={<Hourglass size={24} />} title="Pending Requests" value={pendingCount} />
                <StatCard icon={<CheckCircle2 size={24} className="text-green-500" />} title="Approved Requests" value={approvedCount} />
                <StatCard icon={<CalendarOff size={24} className={onLeaveToday ? "text-blue-500" : ""} />} title="On Leave Today" value={onLeaveToday ? "Yes" : "No"} />
            </div>


            {/* --- History Section --- */}
            <div>
                <h3 className="text-2xl font-bold text-gray-700 mb-5">My Request History</h3>
                <LeaveHistoryList requests={myLeaveRequests} />
            </div>
        </div>
    );
};


// --- Sub Components ---

const LeaveHistoryList = ({ requests }: { requests: LeaveRequest[]; }) => {
    if (requests.length === 0) {
        return (
            <div className="text-center py-16 bg-white rounded-xl shadow-md border border-gray-200/80 text-gray-500">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="font-semibold text-lg">No requests found.</p>
                <p>Click "Request Time Off" to get started.</p>
            </div>
        );
    }
    return (
         <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200/80">
            <div className="divide-y divide-gray-200">
                 {requests.map((req) => (
                    <div key={req._id} className="p-4 sm:p-5">
                        <div className='flex flex-col sm:flex-row justify-between sm:items-center gap-3'>
                            <div className='flex-1'>
                                <p className="text-base font-semibold text-gray-900">{req.leaveType}</p>
                                <p className="text-sm text-gray-600 mt-1">
                                    {format(new Date(req.startDate), 'E, dd MMM yyyy')} to {format(new Date(req.endDate), 'E, dd MMM yyyy')}
                                </p>
                            </div>
                           <div className="self-start sm:self-center">
                                {getStatusChip(req.status)}
                           </div>
                        </div>
                        <div className='mt-3 pl-1 text-sm text-gray-700 bg-gray-50 p-3 rounded-md'>
                           <span className="font-medium text-gray-500">Reason:</span> {req.reason}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const NewLeaveRequestForm = ({ onClose, onSubmit, leaveTypes }: { onClose: () => void; onSubmit: (data: any) => void; leaveTypes: LeaveType[] }) => {
    const [formData, setFormData] = useState({ leaveType: '', startDate: '', endDate: '', reason: '' });

    // UPDATE: Get today's date in YYYY-MM-DD format for the 'min' attribute
    const today = new Date().toISOString().split('T')[0];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.leaveType || !formData.startDate || !formData.endDate || !formData.reason) {
            return toast.error("Please fill out all fields.");
        }
        if (new Date(formData.endDate) < new Date(formData.startDate)) {
            return toast.error("End date cannot be before the start date.");
        }
        onSubmit(formData);
        setFormData({ leaveType: '', startDate: '', endDate: '', reason: '' });
    };

    const commonInputClasses = "w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-gray-900";

    return (
        <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-200/80">
            <h2 className="text-xl font-semibold mb-5 text-gray-800">New Leave Request Form</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="leaveType" className="block text-sm font-medium text-gray-600 mb-1">Leave Type*</label>
                        <select id="leaveType" name="leaveType" required value={formData.leaveType} onChange={handleChange} className={commonInputClasses}>
                            <option value="">Select Type</option>
                             {leaveTypes.map(lt => <option key={lt._id} value={lt.name}>{lt.name}</option>)}
                        </select>
                    </div>
                     <div />
                    <div>
                        <label htmlFor="startDate" className="block text-sm font-medium text-gray-600 mb-1">Start Date*</label>
                        {/* UPDATE: Added the 'min' attribute to prevent past date selection */}
                        <input id="startDate" name="startDate" type="date" required value={formData.startDate} onChange={handleChange} className={commonInputClasses} min={today}/>
                    </div>
                     <div>
                        <label htmlFor="endDate" className="block text-sm font-medium text-gray-600 mb-1">End Date*</label>
                        {/* UPDATE: Dynamically set the 'min' attribute based on the start date */}
                        <input id="endDate" name="endDate" type="date" required value={formData.endDate} onChange={handleChange} className={commonInputClasses} min={formData.startDate || today}/>
                    </div>
                    <div className="md:col-span-2">
                         <label htmlFor="reason" className="block text-sm font-medium text-gray-600 mb-1">Reason for Leave*</label>
                         <textarea id="reason" name="reason" rows={3} required value={formData.reason} onChange={handleChange} className={commonInputClasses} placeholder="Please provide a brief reason..."/>
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


export default StaffLeavePage;