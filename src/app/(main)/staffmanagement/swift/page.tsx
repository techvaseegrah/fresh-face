'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Save, Loader2, Calendar, Edit, Check, X } from 'lucide-react';
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import Button from '@/components/ui/Button';

// --- Type Definitions ---
interface ScheduleEntry {
  [date: string]: string;
}

interface StaffSchedule {
  staffId: string;
  staffName: string;
  schedule: ScheduleEntry;
}

interface WeeklyData {
  weekStart: string;
  weekEnd: string;
  schedule: StaffSchedule[];
}

const ShiftSchedulePage: React.FC = () => {
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [weeklyData, setWeeklyData] = useState<StaffSchedule[]>([]);
  const [originalData, setOriginalData] = useState<StaffSchedule[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quickSetIndex, setQuickSetIndex] = useState<number | null>(null);
  const [quickSetValue, setQuickSetValue] = useState('');

  const weekDays = useMemo(() => {
    const start = startOfWeek(referenceDate, { weekStartsOn: 1 }); // Monday
    const end = endOfWeek(referenceDate, { weekStartsOn: 1 });   // Sunday
    return eachDayOfInterval({ start, end });
  }, [referenceDate]);

  useEffect(() => {
    const fetchSchedule = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const dateParam = format(referenceDate, 'yyyy-MM-dd');
        const response = await fetch(`/api/staffmanagement/swift?date=${dateParam}`);
        
        if (response.ok) {
          const data: WeeklyData = await response.json();
          setWeeklyData(data.schedule);
          setOriginalData(JSON.parse(JSON.stringify(data.schedule))); // Deep copy
          return; // Success
        }

        const errorText = await response.text();
        let errorMessage = `Failed to fetch schedule. Status: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch (e) {
          if (/<(!DOCTYPE|html)/i.test(errorText)) {
            errorMessage = "Server error. An HTML page was returned instead of data. Please check the server logs.";
          } else {
            errorMessage = errorText.substring(0, 200);
          }
        }
        throw new Error(errorMessage);

      } catch (err: any) {
        setError(err.message);
        setWeeklyData([]);
        setOriginalData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchedule();
  }, [referenceDate]);

  const handleShiftChange = (staffIndex: number, dateKey: string, value: string) => {
    const updatedSchedule = [...weeklyData];
    updatedSchedule[staffIndex].schedule[dateKey] = value;
    setWeeklyData(updatedSchedule);
  };
  
  const handleApplyWeek = (staffIndex: number) => {
    if (!quickSetValue.trim()) return;

    const updatedSchedule = [...weeklyData];
    weekDays.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      updatedSchedule[staffIndex].schedule[dateKey] = quickSetValue.toUpperCase();
    });
    setWeeklyData(updatedSchedule);
    
    setQuickSetIndex(null);
    setQuickSetValue('');
  };

  const hasChanges = useMemo(() => {
    return JSON.stringify(weeklyData) !== JSON.stringify(originalData);
  }, [weeklyData, originalData]);

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setError(null);
    const changes: { staffId: string; date: string; shiftTime: string }[] = [];

    weeklyData.forEach((staff, staffIndex) => {
        Object.keys(staff.schedule).forEach(dateKey => {
            const newShift = staff.schedule[dateKey];
            const originalShift = originalData[staffIndex]?.schedule[dateKey] || '';
            if (newShift !== originalShift) {
                changes.push({ staffId: staff.staffId, date: dateKey, shiftTime: newShift });
            }
        });
    });

    if (changes.length === 0) {
        setIsSaving(false);
        return;
    }

    try {
        const response = await fetch('/api/staffmanagement/swift', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(changes),
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || "Failed to save changes.");
        }
        setOriginalData(JSON.parse(JSON.stringify(weeklyData)));
    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsSaving(false);
    }
  };

  const getCellClass = (shift: string) => {
    if (shift.toUpperCase().includes('WEEK OFF')) {
      return 'bg-green-100 text-green-800';
    }
    return 'bg-white';
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">Weekly Shift Roster</h1>
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border">
          <Button variant="ghost" size="sm" icon={<ChevronLeft size={16}/>} onClick={() => setReferenceDate(subDays(referenceDate, 7))} disabled={isLoading}>
            Prev
          </Button>
          <div className="text-center font-semibold text-gray-700 min-w-[200px] flex items-center justify-center gap-2">
            <Calendar size={16} />
            <span>{format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d, yyyy')}</span>
          </div>
          <Button variant="ghost" size="sm" icon={<ChevronRight size={16}/>} onClick={() => setReferenceDate(addDays(referenceDate, 7))} disabled={isLoading}>
            Next
          </Button>
        </div>
        <Button 
          variant="black" 
          icon={isSaving ? <Loader2 className="animate-spin" /> : <Save size={16} />} 
          onClick={handleSaveChanges} 
          disabled={!hasChanges || isSaving || isLoading}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {error && <div className="bg-red-100 border border-red-300 text-red-700 p-3 rounded-md mb-4 text-sm">{error}</div>}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-10 text-center text-gray-500 flex items-center justify-center gap-3">
                <Loader2 className="animate-spin"/> Loading Schedule...
            </div>
          ) : (
            <table className="w-full text-sm text-center border-collapse">
              <thead className="bg-yellow-400">
                 <tr>
                  <th scope="col" className="px-3 py-3 font-semibold text-gray-800 text-left border-r w-64">NAME</th>
                  {weekDays.map(day => (
                    <th key={day.toISOString()} scope="col" className="px-2 py-2 font-semibold text-gray-800 border-r">
                        <div className="text-xs">{format(day, 'MMM-d')}</div>
                        <div className="uppercase">{format(day, 'EEEE')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {weeklyData.length > 0 ? weeklyData.map((staff, staffIndex) => (
                  <tr key={staff.staffId} className="border-b">
                    <td className="px-3 py-2 font-bold text-gray-900 bg-gray-100 text-left border-r whitespace-nowrap">
                      {quickSetIndex === staffIndex ? (
                        <div className="flex items-center gap-2">
                           <input
                              type="text"
                              value={quickSetValue}
                              onChange={(e) => setQuickSetValue(e.target.value)}
                              placeholder="e.g. 9-6 or WEEK OFF"
                              className="w-full p-1 text-sm rounded-md border-gray-300 focus:ring-black focus:border-black"
                              autoFocus
                           />
                           <Button variant="ghost" size="sm" className="p-1.5 text-green-600" onClick={() => handleApplyWeek(staffIndex)}><Check size={18}/></Button>
                           <Button variant="ghost" size="sm" className="p-1.5 text-red-600" onClick={() => setQuickSetIndex(null)}><X size={18}/></Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                            <span>{staff.staffName}</span>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-1.5 text-gray-500 hover:text-black" 
                                onClick={() => { setQuickSetIndex(staffIndex); setQuickSetValue(''); }}>
                                <Edit size={14} />
                                <span className="sr-only">Set Week</span>
                            </Button>
                        </div>
                      )}
                    </td>
                    {weekDays.map(day => {
                      const dateKey = format(day, 'yyyy-MM-dd');
                      const shiftValue = staff.schedule[dateKey] || '';
                      return (
                        <td key={dateKey} className={`p-0 border-r ${getCellClass(shiftValue)}`}>
                            <input
                                type="text"
                                value={shiftValue}
                                onChange={(e) => handleShiftChange(staffIndex, dateKey, e.target.value)}
                                className="w-full h-full p-2 text-center bg-transparent focus:outline-none focus:bg-blue-100 uppercase"
                                placeholder="-"
                                disabled={isLoading || isSaving}
                            />
                        </td>
                      );
                    })}
                  </tr>
                )) : (
                    <tr>
                        <td colSpan={8} className="text-center p-10 text-gray-500">
                            No active staff found. Add staff members to create a schedule.
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShiftSchedulePage;