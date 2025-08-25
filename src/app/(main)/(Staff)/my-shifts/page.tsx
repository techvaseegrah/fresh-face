'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { format, startOfWeek, addDays, subDays } from 'date-fns';
import { Loader2, AlertCircle, ArrowLeft, ArrowRight, Clock, Moon } from 'lucide-react';

// --- Helper Functions ---
const getWeekDays = (start: Date) => Array.from({ length: 7 }).map((_, i) => addDays(start, i));

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
            // Wait for authentication and for the session object to be available
            if (status !== 'authenticated' || !session?.user?.tenantId) return;
            
            setIsLoading(true);
            setError(null);

            const startDate = format(weekStart, 'yyyy-MM-dd');
            const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');

            try {
                // Add the x-tenant-id header to the fetch request
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
    }, [status, weekStart, session]); // Add session to the dependency array
    
    const shiftsByDate = useMemo(() => {
        const map = new Map();
        shifts.forEach(shift => {
            map.set(format(new Date(shift.date), 'yyyy-MM-dd'), shift);
        });
        return map;
    }, [shifts]);

    return (
        <div className="space-y-8 p-4 md:p-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">My Weekly Shifts</h1>
                    <p className="mt-1 text-md text-gray-600">Your assigned schedule for the week.</p>
                </div>
                <div className="flex items-center gap-2 mt-4 md:mt-0">
                    <button onClick={() => setCurrentDate(subDays(currentDate, 7))} className="p-2 border rounded-md hover:bg-gray-100"><ArrowLeft size={16}/></button>
                    <span className="font-semibold text-gray-700 w-48 text-center">{format(weekStart, 'dd MMM')} - {format(addDays(weekStart, 6), 'dd MMM, yyyy')}</span>
                    <button onClick={() => setCurrentDate(addDays(currentDate, 7))} className="p-2 border rounded-md hover:bg-gray-100"><ArrowRight size={16}/></button>
                </div>
            </header>

            {isLoading ? (
                <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-500" /></div>
            ) : error ? (
                <div className="text-red-600 bg-red-50 p-4 rounded-md flex items-center gap-2"><AlertCircle/> {error}</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6">
                    {weekDays.map(day => {
                        const dayStr = format(day, 'yyyy-MM-dd');
                        const shift = shiftsByDate.get(dayStr);
                        return (
                             <div key={dayStr} className="bg-white p-4 rounded-xl shadow-sm border">
                                <p className="font-bold text-gray-800">{format(day, 'EEEE')}</p>
                                <p className="text-sm text-gray-500 mb-4">{format(day, 'dd MMM')}</p>
                                <div className="text-center py-6">
                                    {shift ? (
                                        shift.isWeekOff ? 
                                        <span className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full text-sm font-semibold"><Moon size={14} /> Week Off</span> :
                                        <span className="flex items-center justify-center gap-2 text-indigo-600 font-semibold text-lg"><Clock size={16}/> {shift.shiftTiming || 'Not Set'}</span>
                                    ) : (
                                        <span className="text-gray-400">Not Assigned</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}