'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Calendar, Clock, User, Scissors, Filter, AlertCircle, Loader2, SearchX } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

// Helper to get status colors
const getStatusColor = (status: string) => {
    switch (status) {
        case 'Appointment': return 'border-blue-500 bg-blue-50 text-blue-700';
        case 'Checked-In': return 'border-yellow-500 bg-yellow-50 text-yellow-700';
        case 'Checked-Out': return 'border-purple-500 bg-purple-50 text-purple-700';
        case 'Paid': return 'border-green-500 bg-green-50 text-green-700';
        case 'Cancelled': return 'border-red-500 bg-red-50 text-red-700';
        case 'No-Show': return 'border-gray-500 bg-gray-50 text-gray-700';
        default: return 'border-gray-300 bg-gray-50 text-gray-600';
    }
};

interface Appointment {
    _id: string;
    status: string;
    customerName: string;
    services: string;
    totalDuration: number;
    date: string;
    time: string;
}

export default function MyAppointmentsPage() {
    const { data: session, status: sessionStatus } = useSession();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // State for filters
    const [statusFilter, setStatusFilter] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Debounce date inputs to avoid rapid API calls
    const debouncedStartDate = useDebounce(startDate, 500);
    const debouncedEndDate = useDebounce(endDate, 500);

    const fetchAppointments = useCallback(async () => {
        if (sessionStatus !== 'authenticated' || !session?.user?.tenantId) {
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (debouncedStartDate) params.append('startDate', debouncedStartDate);
            if (debouncedEndDate) params.append('endDate', debouncedEndDate);
            
            const res = await fetch(`/api/staff/my-appointments?${params.toString()}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': session.user.tenantId,
                },
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Failed to load appointments');
            }
            const data = await res.json();
            setAppointments(data.appointments);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [sessionStatus, session?.user?.tenantId, statusFilter, debouncedStartDate, debouncedEndDate]);

    useEffect(() => {
        if (sessionStatus === 'authenticated') {
            fetchAppointments();
        }
    }, [fetchAppointments, sessionStatus]);

    const handleClearFilters = () => {
        setStatusFilter('all');
        setStartDate('');
        setEndDate('');
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">My Appointments</h1>
                <p className="mt-1 text-md text-gray-600">View and manage your scheduled appointments.</p>
            </div>

            {/* Filter Section */}
            <div className="bg-white p-4 rounded-xl shadow-sm border space-y-4 md:space-y-0 md:flex md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-gray-500" />
                    <h3 className="text-lg font-semibold">Filters</h3>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    >
                        <option value="all">All Statuses</option>
                        <option value="Appointment">Upcoming</option>
                        <option value="Checked-In">Checked-In</option>
                        <option value="Checked-Out">Checked-Out</option>
                        <option value="Paid">Completed (Paid)</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="No-Show">No-Show</option>
                    </select>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                    <button onClick={handleClearFilters} className="text-sm text-gray-600 hover:text-indigo-600 font-medium">Clear</button>
                </div>
            </div>

            {/* Content Section */}
            <div>
                {isLoading ? (
                    <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
                ) : error ? (
                    <div className="text-red-600 bg-red-50 p-4 rounded-md flex items-center justify-center gap-2"><AlertCircle/> {error}</div>
                ) : appointments.length === 0 ? (
                    <div className="text-center text-gray-500 py-20 bg-white rounded-xl border">
                        <SearchX className="mx-auto h-16 w-16 text-gray-300" />
                        <p className="mt-4 text-xl font-medium">No Appointments Found</p>
                        <p className="text-sm">Try adjusting your filters or clearing them.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
                        {appointments.map((apt) => (
                            <div 
                                key={apt._id} 
                                className={`p-5 bg-white rounded-xl shadow-sm border-l-4 ${getStatusColor(apt.status)} transition-all duration-300 ease-in-out hover:shadow-lg hover:-translate-y-1 hover:scale-105`}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-lg text-gray-800 flex items-center gap-2"><User size={16} /> {apt.customerName}</p>
                                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full mt-1 inline-block ${getStatusColor(apt.status)}`}>{apt.status}</span>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-2">
                                        <p className="font-semibold text-gray-800 flex items-center gap-2 justify-end"><Calendar size={14} /> {apt.date}</p>
                                        <p className="text-sm text-gray-500 flex items-center gap-2 justify-end"><Clock size={14} /> {apt.time}</p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <p className="text-sm font-medium text-gray-700 flex items-center gap-2"><Scissors size={14}/> Services</p>
                                    <p className="text-sm text-gray-600 mt-1 pl-6 line-clamp-2">{apt.services}</p>
                                    <p className="text-xs text-gray-400 mt-2 pl-6">Est. Duration: {apt.totalDuration} mins</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}