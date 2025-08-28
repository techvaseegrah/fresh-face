'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isWeekend, addMonths, subMonths, startOfDay } from 'date-fns';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, Calendar, Bed, CheckCircle, XCircle, Target, Clock, PlusCircle, ArrowRight } from 'lucide-react';
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

// --- StatCard Component ---
const StatCard: React.FC<{ icon: React.ReactNode; title: string; value: string; gradient: string; }> = ({ icon, title, value, gradient }) => (
    <div 
        className={`relative p-3 sm:p-4 rounded-xl text-white overflow-hidden
                    transition-all duration-300 ease-in-out transform 
                    hover:-translate-y-1 hover:scale-[1.03] hover:shadow-lg
                    bg-gradient-to-br ${gradient}`}
    >
        <div className="absolute top-0 right-0 h-16 w-16 sm:h-20 sm:w-20 -m-3 sm:-m-4 bg-white/20 rounded-full flex items-center justify-center">
           <div className="h-10 w-10 sm:h-14 sm:w-14 bg-white/20 rounded-full flex items-center justify-center opacity-75">
             <div className="text-lg sm:text-xl">{icon}</div>
           </div>
        </div>
        <p className="text-xs sm:text-sm font-light">{title}</p>
        <p className="text-xl sm:text-2xl md:text-3xl font-bold mt-1">{value}</p>
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
    const { status, data: session } = useSession();
    const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [monthlySummary, setMonthlySummary] = useState({ requiredMonthlyMinutes: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAttendanceData = useCallback(async () => {
        if (status !== 'authenticated' || !session?.user?.tenantId) return;
        setIsLoading(true);
        setError(null);
        try {
            const year = currentMonthDate.getFullYear();
            const month = currentMonthDate.getMonth() + 1;
            
            const res = await fetch(`/api/staff/attendance?year=${year}&month=${month}`, {
                headers: { 'Content-Type': 'application/json', 'x-tenant-id': session.user.tenantId },
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
    
    // --- Data for the StatCards ---
    const statCardData = [
        { title: "Target Hours", value: formatDuration(monthlySummary.requiredMonthlyMinutes), icon: <Target size={20}/>, gradient: "from-blue-500 to-indigo-600" },
        { title: "Achieved", value: formatDuration(monthlyStats.achievedMinutes), icon: <Clock size={20}/>, gradient: "from-green-400 to-teal-500" },
        { title: "OT Hours", value: formatDuration(monthlyStats.totalOvertimeHours * 60), icon: <PlusCircle size={20}/>, gradient: "from-purple-500 to-fuchsia-500" },
        { title: "Present", value: `${monthlyStats.presentDays}`, icon: <CheckCircle size={20}/>, gradient: "from-emerald-500 to-lime-600" },
        { title: "Absent", value: `${monthlyStats.absentDays}`, icon: <XCircle size={20}/>, gradient: "from-pink-500 to-rose-500" },
        { title: "On Leave", value: `${monthlyStats.leaveDays}`, icon: <Calendar size={20}/>, gradient: "from-amber-500 to-orange-500" },
        { title: "Week Offs", value: `${monthlyStats.weekOffs}`, icon: <Bed size={20}/>, gradient: "from-cyan-400 to-sky-500" },
    ];

    const attendanceMap = useMemo(() => new Map(records.map(r => [format(new Date(r.date), 'yyyy-MM-dd'), r])), [records]);
    const daysInMonth = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentMonthDate), end: endOfMonth(currentMonthDate) }), [currentMonthDate]);

    // --- Style function to apply gradients to calendar cells ---
    const getDayStyle = (day: Date): string => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const record = attendanceMap.get(dayStr);
        const today = startOfDay(new Date());
        
        const baseGradientStyle = 'text-white shadow-lg';

        if (isToday(day)) {
            return `${baseGradientStyle} bg-gradient-to-br from-blue-500 to-indigo-600`;
        }

        if (record) {
            switch (record.status) {
                case 'present':
                case 'late':
                case 'incomplete':
                    return record.isWorkComplete 
                        ? `${baseGradientStyle} bg-gradient-to-br from-emerald-500 to-lime-600` // Present
                        : `${baseGradientStyle} bg-gradient-to-br from-amber-500 to-orange-500`; // Incomplete
                case 'on_leave':
                    return `${baseGradientStyle} bg-gradient-to-br from-amber-500 to-orange-500`;
                case 'week_off':
                    return `${baseGradientStyle} bg-gradient-to-br from-cyan-400 to-sky-500`;
                case 'absent':
                    return `${baseGradientStyle} bg-gradient-to-br from-pink-500 to-rose-500`;
            }
        }
        
        if (day < today && !isWeekend(day)) {
            return `${baseGradientStyle} bg-gradient-to-br from-pink-500 to-rose-500`;
        }
        
        return 'bg-gray-100 text-gray-800';
    };

    // --- Improved mobile content function ---
    const getDayContent = (day: Date, parentClasses: string) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const record = attendanceMap.get(dayStr);
        const hasGradient = parentClasses.includes('bg-gradient-to-br');

        if (!record) {
            if (day > new Date()) return <div className="text-gray-400 text-xs sm:text-sm">--</div>;
            if (isWeekend(day)) return <div className="text-gray-500 text-xs sm:text-sm leading-tight">Wknd</div>;
            return (
                <div className="font-semibold flex flex-col items-center justify-center leading-tight h-full">
                    <XCircle size={14} className="sm:hidden mb-0.5" />
                    <XCircle size={16} className="hidden sm:block mb-1" /> 
                    <span className="text-[10px] sm:text-sm text-center">Absent</span>
                </div>
            );
        }

        switch (record.status) {
            case 'present':
            case 'late':
            case 'incomplete':
                return (
                    <div className="text-center w-full h-full">
                        {/* Mobile layout - compact but complete */}
                        <div className="sm:hidden flex flex-col justify-center h-full px-0.5 py-1">
                            <div className="font-bold text-[11px] leading-none mb-0.5">
                                {formatDuration(record.totalWorkingMinutes)}
                            </div>
                            <div className="text-[9px] leading-none mb-0.5 opacity-90">
                                {record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : '--'} - {record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : 'Now'}
                            </div>
                            <div className="text-[8px] leading-none opacity-75">
                                Req: {formatDuration(record.requiredMinutes)}
                            </div>
                            {record.temporaryExits && record.temporaryExits.length > 0 && (
                                <div className="text-[7px] leading-none opacity-70 mt-0.5">
                                    Exit: {record.temporaryExits.reduce((sum, exit) => sum + exit.durationMinutes, 0)}m
                                </div>
                            )}
                        </div>
                        
                        {/* Desktop layout - detailed */}
                        <div className="hidden sm:block text-xs h-full flex flex-col justify-center">
                            <div className="font-bold text-base mb-1">{formatDuration(record.totalWorkingMinutes)}</div>
                            <div className={`flex items-center justify-center gap-1 text-xs mb-1 ${hasGradient ? 'text-white/80' : 'text-gray-500'}`}>
                                <span className="truncate">{record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : '--'}</span>
                                <ArrowRight size={10} className="flex-shrink-0" />
                                <span className="truncate">{record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : 'Now'}</span>
                            </div>
                            <div className={`font-semibold border-t pt-1 text-[11px] leading-none ${hasGradient ? 'border-white/20 text-white/90' : 'border-gray-200 text-gray-600'}`}>
                                Req: {formatDuration(record.requiredMinutes)}
                            </div>
                            {record.temporaryExits && record.temporaryExits.length > 0 && (
                                <div className={`text-[10px] leading-none mt-1 ${hasGradient ? 'text-white/70' : 'text-gray-500'}`}>
                                    Temp Exit: {record.temporaryExits.reduce((sum, exit) => sum + exit.durationMinutes, 0)}m
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'on_leave':
                return (
                    <div className="font-semibold flex flex-col items-center justify-center leading-tight h-full">
                        <Calendar size={14} className="sm:hidden mb-0.5" />
                        <Calendar size={16} className="hidden sm:block mb-1" /> 
                        <span className="text-[10px] sm:text-sm text-center">On Leave</span>
                    </div>
                );
            case 'week_off':
                return (
                    <div className="font-semibold flex flex-col items-center justify-center leading-tight h-full">
                        <Bed size={14} className="sm:hidden mb-0.5" />
                        <Bed size={16} className="hidden sm:block mb-1" /> 
                        <span className="text-[10px] sm:text-sm text-center">Week Off</span>
                    </div>
                );
            case 'absent':
                return (
                    <div className="font-semibold flex flex-col items-center justify-center leading-tight h-full">
                        <XCircle size={14} className="sm:hidden mb-0.5" />
                        <XCircle size={16} className="hidden sm:block mb-1" /> 
                        <span className="text-[10px] sm:text-sm text-center">Absent</span>
                    </div>
                );
            default:
                return <div className="text-gray-400 text-xs sm:text-sm">--</div>;
        }
    };
    
    return (
        <div className="space-y-4 sm:space-y-6 p-2 sm:p-4">
            <header className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">My Attendance</h1>
                    <p className="mt-1 text-sm sm:text-md text-gray-500">Your monthly attendance and work hour summary.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentMonthDate(subMonths(currentMonthDate, 1))}>
                        <ChevronLeft size={14} className="sm:hidden" />
                        <ChevronLeft size={16} className="hidden sm:block" />
                    </Button>
                    <span className="font-semibold text-gray-700 w-28 sm:w-36 text-center text-base sm:text-lg">
                        <span className="sm:hidden">{format(currentMonthDate, 'MMM yyyy')}</span>
                        <span className="hidden sm:inline">{format(currentMonthDate, 'MMMM yyyy')}</span>
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentMonthDate(addMonths(currentMonthDate, 1))}>
                        <ChevronRight size={14} className="sm:hidden" />
                        <ChevronRight size={16} className="hidden sm:block" />
                    </Button>
                </div>
            </header>

            {isLoading ? (
                <div className="text-center py-20">
                    <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin mx-auto text-gray-500" />
                </div>
            ) : error ? (
                <div className="text-red-600 bg-red-50 p-3 sm:p-4 rounded-md flex items-center gap-2 text-sm sm:text-base">
                    <AlertCircle size={16} className="sm:hidden" />
                    <AlertCircle size={20} className="hidden sm:block" /> 
                    {error}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
                        {statCardData.map(card => <StatCard key={card.title} {...card} />)}
                    </div>

                    <div className="bg-white p-2 sm:p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
                        {/* Calendar header */}
                        <div className="grid grid-cols-7 gap-1 text-center font-bold text-gray-400 text-xs sm:text-sm mb-2">
                            <div className="sm:hidden">S</div>
                            <div className="sm:hidden">M</div>
                            <div className="sm:hidden">T</div>
                            <div className="sm:hidden">W</div>
                            <div className="sm:hidden">T</div>
                            <div className="sm:hidden">F</div>
                            <div className="sm:hidden">S</div>
                            <div className="hidden sm:block">Sun</div>
                            <div className="hidden sm:block">Mon</div>
                            <div className="hidden sm:block">Tue</div>
                            <div className="hidden sm:block">Wed</div>
                            <div className="hidden sm:block">Thu</div>
                            <div className="hidden sm:block">Fri</div>
                            <div className="hidden sm:block">Sat</div>
                        </div>
                        
                        {/* Calendar grid - optimized for mobile */}
                        <div className="grid grid-cols-7 gap-1 sm:gap-2">
                            {/* Empty cells for days before month starts */}
                            {Array.from({ length: startOfMonth(currentMonthDate).getDay() }).map((_, i) => (
                                <div key={`empty-${i}`} className="h-28 sm:h-32"></div>
                            ))}
                            
                            {/* Calendar days */}
                            {daysInMonth.map(day => {
                                const dayClasses = getDayStyle(day);
                                return (
                                    <div 
                                        key={day.toString()} 
                                        className={`p-1 sm:p-2 rounded text-center h-28 sm:h-32 flex flex-col transition-all duration-300 ease-in-out hover:-translate-y-1 ${dayClasses}`}
                                    >
                                        {/* Day number */}
                                        <div className="font-bold text-sm sm:text-base mb-1 flex-shrink-0">{format(day, 'd')}</div>
                                        
                                        {/* Day content - takes remaining space */}
                                        <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
                                            {getDayContent(day, dayClasses)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}