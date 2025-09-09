'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Loader2, AlertCircle, User, CalendarDays, Search, Moon } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useSession } from 'next-auth/react';
import Card from '../../../../components/ui/Card';

// --- TYPE DEFINITIONS ---
interface StaffMember { _id: string; staffIdNumber: string; name: string; status: 'active' | 'inactive'; }
interface Shift { _id?: string; employeeId: string; date: string; isWeekOff: boolean; shiftTiming: string; }
type ShiftScheduleState = Record<string, Record<string, Shift>>;

// --- HELPER FUNCTIONS ---
const getWeekDateRange = (date: Date) => {
  const start = new Date(date);
  start.setDate(start.getDate() - (start.getDay() === 0 ? 6 : start.getDay() - 1));
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { startDate: start, endDate: end };
};
const getDaysOfWeek = (startDate: Date) => {
  const days = [];
  for (let i = 0; i < 7; i++) { const day = new Date(startDate); day.setDate(startDate.getDate() + i); days.push(day); }
  return days;
};
const formatDateToISOString = (date: Date) => date.toISOString().split('T')[0];
const nameToColor = (name: string) => {
  const colors = [ 'bg-orange-200 text-orange-800', 'bg-green-200 text-green-800', 'bg-purple-200 text-purple-800', 'bg-blue-200 text-blue-800', 'bg-red-200 text-red-800', 'bg-teal-200 text-teal-800', 'bg-yellow-200 text-yellow-800', 'bg-pink-200 text-pink-800', 'bg-cyan-200 text-cyan-800', 'bg-indigo-200 text-indigo-800', ];
  if (!name) return colors[0]; let hash = 0; for (let i = 0; i < name.length; i++) { hash = name.charCodeAt(i) + ((hash << 5) - hash); hash = hash & hash; }
  return colors[Math.abs(hash % colors.length)];
};
const Avatar = ({ name }: { name: string }) => {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${nameToColor(name)}`}>{initials || <User size={20}/>}</div>;
};

// --- READ-ONLY SUB-COMPONENTS ---
const ShiftDayCellReport: React.FC<{ day: Date; shift: Shift | undefined; }> = ({ day, shift }) => {
  if (!shift) return <div className="flex items-center justify-center p-3 rounded-lg border bg-gray-50 min-h-[100px]"><Loader2 className="animate-spin text-gray-400" size={20} /></div>;
  const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
  const dayOfMonth = day.getDate();
  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border bg-white min-h-[100px]">
      <div className="flex justify-between items-center">
        <span className="font-bold text-black">{dayName}</span>
        <span className="text-sm font-semibold text-gray-500 bg-gray-200 rounded-full w-6 h-6 flex items-center justify-center">{dayOfMonth}</span>
      </div>
      <div className="flex-grow flex items-center justify-center text-center font-semibold">
        {shift.isWeekOff ? (<span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full text-sm"><Moon size={14} /> OFF</span>) 
        : shift.shiftTiming ? (<span className="text-black text-lg">{shift.shiftTiming}</span>) 
        : (<span className="text-gray-400 text-lg">--</span>)}
      </div>
    </div>
  );
};

const StaffShiftCardReport: React.FC<{ staff: StaffMember; weekDays: Date[]; shifts: Record<string, Shift>; }> = ({ staff, weekDays, shifts }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden border border-gray-200/80">
      <div className="p-4 flex items-center gap-4 border-b border-gray-200/80">
        <Avatar name={staff.name} />
        <div>
          <h3 className="font-bold text-lg text-black">{staff.name}</h3>
          <p className="text-sm text-gray-500">ID: {staff.staffIdNumber}</p>
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 bg-gray-50">
        {weekDays.map((day: Date) => (
          <ShiftDayCellReport
            key={formatDateToISOString(day)}
            day={day}
            shift={shifts[formatDateToISOString(day)]}
          />
        ))}
      </div>
    </div>
  );
};

// --- MAIN REPORT COMPONENT ---
export default function ShiftReportPage() {
  const { data: session } = useSession();
  const tenantId = useMemo(() => session?.user?.tenantId, [session]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [shifts, setShifts] = useState<ShiftScheduleState>({});
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { startDate, endDate } = useMemo(() => getWeekDateRange(currentDate), [currentDate]);
  const weekDays = useMemo(() => getDaysOfWeek(startDate), [startDate]);

  const tenantAwareFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    if (!tenantId) throw new Error("Missing tenant information.");
    const headers = new Headers(options.headers || {});
    headers.set('x-tenant-id', tenantId);
    return fetch(url, { ...options, headers });
  }, [tenantId]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { startDate: weekStart, endDate: weekEnd } = getWeekDateRange(currentDate);
      
      // --- THIS IS THE FIX: Fetch staff list first and handle specific permission errors ---
      const staffResponse = await tenantAwareFetch('/api/staff?action=list');
      if (!staffResponse.ok) {
          if (staffResponse.status === 403 || staffResponse.status === 401) {
              throw new Error("Could not load schedule. You may be missing the 'STAFF_LIST_READ' permission to view the staff list.");
          }
          throw new Error('Failed to fetch staff list. The report cannot be displayed.');
      }
      const staffData = await staffResponse.json();
      const activeStaff: StaffMember[] = staffData.data.filter((s: StaffMember) => s.status === 'active');
      setStaffList(activeStaff);
      
      // Proceed to fetch shifts only if staff list was successful
      const shiftApiUrl = `/api/shifts?startDate=${weekStart.toISOString()}&endDate=${weekEnd.toISOString()}`;
      const shiftResponse = await tenantAwareFetch(shiftApiUrl);
      if (!shiftResponse.ok) throw new Error('Failed to fetch shift data.');
      
      const shiftData = await shiftResponse.json();
      const schedule: ShiftScheduleState = {};
      const shiftsByEmployeeAndDate = new Map<string, Map<string, Shift>>();
      if (shiftData.data) {
        shiftData.data.forEach((s: Shift) => {
          const dateKey = formatDateToISOString(new Date(s.date));
          if (!shiftsByEmployeeAndDate.has(s.employeeId)) shiftsByEmployeeAndDate.set(s.employeeId, new Map());
          shiftsByEmployeeAndDate.get(s.employeeId)?.set(dateKey, { ...s, date: dateKey });
        });
      }
      activeStaff.forEach(staff => {
        schedule[staff._id] = {};
        getDaysOfWeek(weekStart).forEach(day => {
          const dateStr = formatDateToISOString(day);
          schedule[staff._id][dateStr] = shiftsByEmployeeAndDate.get(staff._id)?.get(dateStr) || { employeeId: staff._id, date: dateStr, isWeekOff: false, shiftTiming: '' };
        });
      });
      setShifts(schedule);
    } catch (err: any) { 
        setError(err.message); 
    } 
    finally { setIsLoading(false); }
  }, [currentDate, tenantAwareFetch]);

  useEffect(() => { if (tenantId) fetchData(); }, [fetchData, tenantId]);
  
  const filteredStaffList = useMemo(() => {
    if (!searchQuery) return staffList;
    const lowercasedQuery = searchQuery.toLowerCase().trim();
    return staffList.filter(staff => staff.name?.toLowerCase().includes(lowercasedQuery) || staff.staffIdNumber?.toLowerCase().includes(lowercasedQuery));
  }, [staffList, searchQuery]);

  const goToPreviousWeek = useCallback(() => setCurrentDate(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; }), []);
  const goToNextWeek = useCallback(() => setCurrentDate(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; }), []);

  const dateRangeDisplay = useMemo(() => {
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const startDay = startDate.getDate();
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    const endDay = endDate.getDate();
    const year = startDate.getFullYear();
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  }, [startDate, endDate]);

  return (
    <div className="font-sans">
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Weekly Shift Report</h1>
          <p className="text-gray-500 mt-1">View weekly shift schedules for all active staff.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white border p-2 rounded-lg text-sm font-medium text-gray-700">
            <CalendarDays size={16} className="text-gray-500" />
            <span>{dateRangeDisplay}</span>
          </div>
          <Button onClick={goToPreviousWeek} variant="outline" size="sm" icon={<ArrowLeft size={16} />}>Previous</Button>
          <Button onClick={goToNextWeek} variant="outline" size="sm" icon={<ArrowRight size={16} />}>Next</Button>
        </div>
      </header>
      
      <Card>
        <div className="p-4 border-b">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input type="text" placeholder="Search staff..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"/>
          </div>
        </div>

        <div className="p-4">
          {error && (
            <div className="p-6 bg-red-50 text-red-800 rounded-md mb-6 border border-red-200">
                <div className="flex items-center gap-3">
                    <AlertCircle size={24}/>
                    <div>
                        <h3 className="font-bold">Error Loading Report</h3>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            </div>
          )}
          {isLoading ? (
            <div className="text-center p-16"><div className="flex justify-center items-center gap-3 text-gray-500 text-lg"><Loader2 className="animate-spin" size={24} /> Loading Schedule...</div></div>
          ) : !error && filteredStaffList.length === 0 ? (
            <div className="text-center p-16"><h3 className="text-xl font-semibold">No Staff Found</h3><p className="text-gray-500 mt-2">{searchQuery ? `No staff member matches "${searchQuery}".` : 'There are no active staff to display.'}</p></div>
          ) : (
            !error && <div className="space-y-6">
              {filteredStaffList.map(staff => (
                <StaffShiftCardReport
                  key={staff._id}
                  staff={staff}
                  weekDays={weekDays}
                  shifts={shifts[staff._id] || {}}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}