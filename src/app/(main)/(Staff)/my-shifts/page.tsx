'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { format, startOfWeek, addDays, subDays, isToday } from 'date-fns';
import { Loader2, AlertCircle, ArrowLeft, ArrowRight, Clock, Coffee, CalendarX2 } from 'lucide-react';

// --- Helper Functions ---
const getWeekDays = (start: Date) => Array.from({ length: 7 }).map((_, i) => addDays(start, i));

// --- Style configuration for each day of the week ---
const dayCardStyles = [
    { from: 'from-sky-500', to: 'to-indigo-500' },      // Monday
    { from: 'from-emerald-500', to: 'to-green-600' },   // Tuesday
    { from: 'from-amber-500', to: 'to-orange-600' },    // Wednesday
    { from: 'from-rose-500', to: 'to-red-600' },        // Thursday
    { from: 'from-fuchsia-500', to: 'to-purple-600' },  // Friday
    { from: 'from-slate-600', to: 'to-gray-800' },      // Saturday
    { from: 'from-blue-600', to: 'to-violet-700' },     // Sunday
];

// --- Main Page Component ---
export default function MyShiftsPage() {
    // Destructure data as session to access user details
    const { data: session, status } = useSession(); 
    const [shifts, setShifts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());

    const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
    const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

    useEffect(() => {
        const fetchShifts = async () => {
            if (status !== 'authenticated' || !session?.user?.tenantId) {
                if (status === 'loading') setIsLoading(true);
                else setIsLoading(false); 
                return;
            }
            
            setIsLoading(true);
            setError(null);

            const startDate = format(weekStart, 'yyyy-MM-dd');
            const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');

            try {
                const res = await fetch(`/api/staff/my-shifts?startDate=${startDate}&endDate=${endDate}`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-tenant-id': session.user.tenantId
                    }
                });

                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load shifts.');
                setShifts(data.data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchShifts();
    }, [status, weekStart, session]);
    
    const shiftsByDate = useMemo(() => {
        const map = new Map();
        shifts.forEach(shift => {
            map.set(format(new Date(shift.date), 'yyyy-MM-dd'), shift);
        });
        return map;
    }, [shifts]);

    // Helper component to render the shift status text
    const ShiftStatusText = ({ shift }: { shift: any }) => {
        if (!shift) {
            return <p className="font-semibold text-xl opacity-80">Not Assigned</p>;
        }
        if (shift.isWeekOff) {
            return <p className="font-bold text-2xl">Week Off</p>;
        }
        return <p className="font-bold text-3xl tracking-wide">{shift.shiftTiming || 'Not Set'}</p>;
    };

    return (
        <div className="bg-gray-100 min-h-screen p-4 sm:p-6 md:p-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">My Weekly Shifts</h1>
                    <p className="mt-1 text-md text-gray-500">Your assigned schedule for the week.</p>
                </div>
                <div className="flex items-center gap-2 mt-4 md:mt-0 bg-white p-1.5 rounded-xl border shadow-sm">
                    <button onClick={() => setCurrentDate(subDays(currentDate, 7))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><ArrowLeft size={16}/></button>
                    <span className="font-semibold text-gray-700 w-48 text-center">{format(weekStart, 'MMM dd')} - {format(addDays(weekStart, 6), 'MMM dd, yyyy')}</span>
                    <button onClick={() => setCurrentDate(addDays(currentDate, 7))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><ArrowRight size={16}/></button>
                </div>
            </header>

            {isLoading ? (
                <div className="flex justify-center items-center py-20"><Loader2 className="h-10 w-10 animate-spin text-blue-600" /></div>
            ) : error ? (
                <div className="flex items-center justify-center gap-3 bg-red-100 text-red-700 p-4 rounded-lg"><AlertCircle size={20}/> <span className="font-medium">{error}</span></div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-6">
                    {weekDays.map((day, index) => {
                        const dayStr = format(day, 'yyyy-MM-dd');
                        const shift = shiftsByDate.get(dayStr);
                        const { from, to } = dayCardStyles[index];
                        const today = isToday(day);

                        return (
                             <div key={dayStr} 
                                  className={`
                                    relative rounded-2xl text-white overflow-hidden shadow-lg 
                                    bg-gradient-to-br ${from} ${to}
                                    transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-xl
                                    ${today ? 'ring-4 ring-offset-2 ring-blue-500' : ''}
                                  `}>
                                
                                <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10"></div>
                                
                                <div className="relative z-10 p-5 flex flex-col h-48 text-shadow">
                                    <div className='flex-shrink-0'>
                                        <div className="flex justify-between items-start">
                                            <p className="font-bold text-lg">{format(day, 'EEEE')}</p>
                                            {shift ? (shift.isWeekOff ? <Coffee size={20} className="opacity-80" /> : <Clock size={20} className="opacity-80" />) : <CalendarX2 size={20} className="opacity-80" />}
                                        </div>
                                        <p className="text-sm opacity-80">{format(day, 'dd MMM, yyyy')}</p>
                                    </div>
                                    <div className="flex-grow flex items-center justify-center">
                                        <ShiftStatusText shift={shift} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}