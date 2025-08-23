'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isWeekend, addMonths, subMonths } from 'date-fns';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, Calendar, Bed, CheckCircle, XCircle, AlertTriangle, Info, Target, Clock, Coffee } from 'lucide-react';
import Button from '@/components/ui/Button';

// --- Type Definitions ---
interface AttendanceRecord {
    _id: string;
    date: string;
    status: 'present' | 'late' | 'absent' | 'on_leave' | 'week_off' | 'incomplete';
    checkIn?: string;
    checkOut?: string;
    totalWorkingMinutes: number;
    isWorkComplete: boolean;
    requiredMinutes: number;
}

// --- Helper Components ---
const StatCard: React.FC<{ icon: React.ReactNode; title: string; value: string; }> = ({ icon, title, value }) => (
    <div className="bg-white p-5 rounded-xl shadow-sm border flex items-center gap-4">
        <div className="flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600">{icon}</div>
        <div>
            <p className="text-sm text-gray-500 font-medium">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

const formatDuration = (minutes: number): string => {
    if (isNaN(minutes) || minutes < 0) return "0h 0m";
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
};

// --- Main Attendance Page Component ---
export default function StaffAttendancePage() {
    const { status } = useSession();
    const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [requiredMonthlyMinutes, setRequiredMonthlyMinutes] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAttendanceData = useCallback(async () => {
        if (status !== 'authenticated') {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const year = currentMonthDate.getFullYear();
            const month = currentMonthDate.getMonth() + 1;
            
            // --- ✅ THIS IS THE FIX ---
            // The API path is changed from '/api/attendance' to the new '/api/staff/attendance'
            const res = await fetch(`/api/staff/attendance?year=${year}&month=${month}`);
            
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to fetch data.");
            }
            setRecords(data.data.records);
            setRequiredMonthlyMinutes(data.data.summary.requiredMonthlyMinutes);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [currentMonthDate, status]);

    useEffect(() => {
        fetchAttendanceData();
    }, [fetchAttendanceData]);

    const monthlyStats = useMemo(() => {
        const presentDays = records.filter(r => ['present', 'late', 'incomplete'].includes(r.status)).length;
        const absentDays = records.filter(r => r.status === 'absent').length;
        const leaveDays = records.filter(r => r.status === 'on_leave').length;
        const weekOffs = records.filter(r => r.status === 'week_off').length;
        const achievedMinutes = records.reduce((sum, r) => sum + (r.totalWorkingMinutes || 0), 0);
        return { presentDays, absentDays, leaveDays, weekOffs, achievedMinutes };
    }, [records]);
    
    const attendanceMap = useMemo(() => {
        const map = new Map<string, AttendanceRecord>();
        records.forEach(record => {
            map.set(format(new Date(record.date), 'yyyy-MM-dd'), record);
        });
        return map;
    }, [records]);

    const daysInMonth = useMemo(() => {
        return eachDayOfInterval({
            start: startOfMonth(currentMonthDate),
            end: endOfMonth(currentMonthDate)
        });
    }, [currentMonthDate]);

    const getDayContent = (day: Date) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const record = attendanceMap.get(dayStr);
        
        if (!record) {
            if (day > new Date()) return <div className="text-gray-300">--</div>;
            if (isWeekend(day)) return <div className="text-gray-400">Weekend</div>;
            return <div className="text-red-500 font-semibold flex items-center justify-center gap-1 text-xs"><XCircle size={14} /> Absent</div>;
        }
        switch (record.status) {
            case 'present':
            case 'late':
            case 'incomplete':
                return (
                    <div className="text-center">
                        <span className={`font-bold text-lg ${record.isWorkComplete ? 'text-green-600' : 'text-orange-500'}`}>{formatDuration(record.totalWorkingMinutes)}</span>
                        <div className="text-xs text-gray-500 mt-1">{record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : ''} - {record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : ''}</div>
                    </div>
                );
            case 'on_leave':
                return <div className="text-blue-500 font-semibold flex items-center justify-center gap-1 text-sm"><Calendar size={14} /> On Leave</div>;
            case 'week_off':
                return <div className="text-cyan-500 font-semibold flex items-center justify-center gap-1 text-sm"><Bed size={14} /> Week Off</div>;
            default:
                return <div className="text-gray-400">--</div>;
        }
    };
    
    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">My Attendance</h1>
                    <p className="mt-1 text-md text-gray-600">Your monthly attendance and work hour summary.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentMonthDate(subMonths(currentMonthDate, 1))}><ChevronLeft size={16}/></Button>
                    <span className="font-semibold text-gray-700 w-36 text-center">{format(currentMonthDate, 'MMMM yyyy')}</span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentMonthDate(addMonths(currentMonthDate, 1))}><ChevronRight size={16}/></Button>
                </div>
            </header>

            {isLoading ? (
                <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-500" /></div>
            ) : error ? (
                <div className="text-red-600 bg-red-50 p-4 rounded-md flex items-center gap-2"><AlertCircle/> {error}</div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                        <StatCard icon={<Target size={24}/>} title="Target Hours" value={formatDuration(requiredMonthlyMinutes)} />
                        <StatCard icon={<Clock size={24}/>} title="Achieved Hours" value={formatDuration(monthlyStats.achievedMinutes)} />
                        <StatCard icon={<CheckCircle size={24}/>} title="Present Days" value={`${monthlyStats.presentDays}`} />
                        <StatCard icon={<XCircle size={24}/>} title="Absent Days" value={`${monthlyStats.absentDays}`} />
                        <StatCard icon={<Coffee size={24}/>} title="Leaves / Offs" value={`${monthlyStats.leaveDays + monthlyStats.weekOffs}`} />
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <h2 className="text-xl font-semibold mb-4">Monthly Calendar View</h2>
                        <div className="grid grid-cols-7 gap-1 text-center font-bold text-gray-500 text-sm mb-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day}>{day}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: startOfMonth(currentMonthDate).getDay() }).map((_, i) => <div key={`empty-${i}`} className="border rounded-lg bg-gray-50"></div>)}
                            
                            {daysInMonth.map(day => (
                                <div key={day.toString()} className={`p-2 border rounded-lg h-28 flex flex-col items-center justify-between text-sm ${isToday(day) ? 'bg-indigo-50 border-indigo-300' : 'bg-white'}`}>
                                    <div className="font-semibold self-start">{format(day, 'd')}</div>
                                    <div className="flex-grow flex items-center justify-center">{getDayContent(day)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}