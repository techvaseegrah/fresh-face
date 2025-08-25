'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isWeekend, addMonths, subMonths, startOfDay } from 'date-fns';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, Calendar, Bed, CheckCircle, XCircle, AlertTriangle, Target, Clock, Coffee, PlusCircle, ArrowRight } from 'lucide-react';
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
    overtimeHours?: number;
    temporaryExits?: { startTime: string; endTime?: string; durationMinutes: number }[];
}

// ... (StatCard and formatDuration helpers remain the same) ...
const StatCard: React.FC<{ icon: React.ReactNode; title: string; value: string; }> = ({ icon, title, value }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-col justify-center items-center text-center gap-2">
        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center text-gray-600">{icon}</div>
        <div>
            <p className="text-sm text-gray-500 font-medium">{title}</p>
            <p className="text-xl font-bold text-gray-800">{value}</p>
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
    // ✅ MODIFICATION: Destructure 'data: session' to access tenantId
    const { status, data: session } = useSession();
    const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [monthlySummary, setMonthlySummary] = useState({ requiredMonthlyMinutes: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAttendanceData = useCallback(async () => {
        // ✅ MODIFICATION: Check for session and tenantId before fetching
        if (status !== 'authenticated' || !session?.user?.tenantId) return;
        setIsLoading(true);
        setError(null);
        try {
            const year = currentMonthDate.getFullYear();
            const month = currentMonthDate.getMonth() + 1;
            
            // ✅ MODIFICATION: Add the 'x-tenant-id' header to the fetch request
            const res = await fetch(`/api/staff/attendance?year=${year}&month=${month}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': session.user.tenantId,
                },
            });

            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to fetch data.");
            
            setRecords(data.data.records);
            setMonthlySummary(data.data.summary);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    // ✅ MODIFICATION: Add 'session' to the dependency array
    }, [currentMonthDate, status, session]);

    useEffect(() => {
        fetchAttendanceData();
    }, [fetchAttendanceData]);

    const monthlyStats = useMemo(() => {
        const achievedMinutes = records.reduce((sum, r) => sum + (r.totalWorkingMinutes || 0), 0);
        const totalOvertimeHours = records.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);
        
        const presentDays = records.filter(r => (r.status === 'present' || r.status === 'late') && r.isWorkComplete).length;
        const leaveDays = records.filter(r => r.status === 'on_leave' || (['present', 'late', 'incomplete'].includes(r.status) && !r.isWorkComplete)).length;
        const weekOffs = records.filter(r => r.status === 'week_off').length;
        
        const attendanceMap = new Map(records.map(r => [format(new Date(r.date), 'yyyy-MM-dd'), r]));
        let absentDays = 0;
        const today = startOfDay(new Date());

        eachDayOfInterval({ start: startOfMonth(currentMonthDate), end: endOfMonth(currentMonthDate) }).forEach(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const record = attendanceMap.get(dayStr);
            if (record?.status === 'absent') {
                absentDays++;
            } else if (!record && day < today && !isWeekend(day)) {
                absentDays++;
            }
        });

        return { presentDays, absentDays, leaveDays, weekOffs, achievedMinutes, totalOvertimeHours };
    }, [records, currentMonthDate]);
    
    const attendanceMap = useMemo(() => new Map(records.map(r => [format(new Date(r.date), 'yyyy-MM-dd'), r])), [records]);
    const daysInMonth = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentMonthDate), end: endOfMonth(currentMonthDate) }), [currentMonthDate]);

    const getDayContent = (day: Date) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const record = attendanceMap.get(dayStr);
        
        if (!record) {
            if (day > new Date()) return <div className="text-gray-300">--</div>;
            if (isWeekend(day)) return <div className="text-gray-400">Weekend</div>;
            return <div className="text-red-500 font-semibold flex items-center justify-center gap-1 text-xs"><XCircle size={14} /> Absent</div>;
        }

        const totalExitMinutes = (record.temporaryExits || []).reduce((sum, exit) => sum + exit.durationMinutes, 0);

        switch (record.status) {
            case 'present':
            case 'late':
            case 'incomplete':
                return (
                    <div className="text-center text-xs space-y-1 w-full">
                        <div className={`font-bold text-sm ${record.isWorkComplete ? 'text-green-600' : 'text-orange-500'}`}>{formatDuration(record.totalWorkingMinutes)}</div>
                        <div className="text-gray-500 flex items-center justify-center gap-1">
                            {record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : '--'}
                            <ArrowRight size={10} />
                            {record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : 'Now'}
                        </div>
                        {totalExitMinutes > 0 && (
                            <div className="text-purple-600 font-medium" title="Temporary Exits">
                                Exits: {formatDuration(totalExitMinutes)}
                            </div>
                        )}
                        <div className="text-gray-600 font-semibold border-t border-gray-100 pt-1 mt-1">
                            Req: {formatDuration(record.requiredMinutes)}
                        </div>
                    </div>
                );
            case 'on_leave':
                return <div className="text-blue-500 font-semibold flex items-center justify-center gap-1 text-sm"><Calendar size={14} /> On Leave</div>;
            case 'week_off':
                return <div className="text-cyan-500 font-semibold flex items-center justify-center gap-1 text-sm"><Bed size={14} /> Week Off</div>;
            case 'absent':
                return <div className="text-red-500 font-semibold flex items-center justify-center gap-1 text-xs"><XCircle size={14} /> Absent</div>;
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        <StatCard icon={<Target size={24}/>} title="Target Hours" value={formatDuration(monthlySummary.requiredMonthlyMinutes)} />
                        <StatCard icon={<Clock size={24}/>} title="Achieved" value={formatDuration(monthlyStats.achievedMinutes)} />
                        <StatCard icon={<PlusCircle size={24}/>} title="OT Hours" value={formatDuration(monthlyStats.totalOvertimeHours * 60)} />
                        <StatCard icon={<CheckCircle size={24}/>} title="Present" value={`${monthlyStats.presentDays}`} />
                        <StatCard icon={<XCircle size={24}/>} title="Absent" value={`${monthlyStats.absentDays}`} />
                        <StatCard icon={<Calendar size={24}/>} title="On Leave" value={`${monthlyStats.leaveDays}`} />
                        <StatCard icon={<Bed size={24}/>} title="Week Offs" value={`${monthlyStats.weekOffs}`} />
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <h2 className="text-xl font-semibold mb-4">Monthly Calendar View</h2>
                        <div className="grid grid-cols-7 gap-1 text-center font-bold text-gray-500 text-sm mb-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day}>{day}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: startOfMonth(currentMonthDate).getDay() }).map((_, i) => <div key={`empty-${i}`} className="border rounded-lg bg-gray-50"></div>)}
                            
                            {daysInMonth.map(day => (
                                <div key={day.toString()} className={`p-2 border rounded-lg h-32 flex flex-col items-center justify-between text-sm ${isToday(day) ? 'bg-indigo-50 border-indigo-300' : 'bg-white'}`}>
                                    <div className="font-semibold self-start">{format(day, 'd')}</div>
                                    <div className="flex-grow flex items-center justify-center w-full">{getDayContent(day)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}