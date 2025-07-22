// /src/app/(main)/staffmanagement/swift/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Save, Loader2, AlertCircle, Edit, XCircle } from 'lucide-react';
import Button from '@/components/ui/Button';

// --- TYPE DEFINITIONS (Unchanged) ---
interface StaffMember {
  _id: string;
  staffIdNumber: string;
  name: string;
  status: 'active' | 'inactive';
}

interface Shift {
  _id?: string;
  employeeId: string;
  date: string;
  isWeekOff: boolean;
  shiftTiming: string;
}

type ShiftScheduleState = Record<string, Record<string, Shift>>;

// --- HELPER FUNCTIONS (Unchanged) ---
const getWeekDateRange = (date: Date) => {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay() + (start.getDay() === 0 ? -6 : 1));
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { startDate: start, endDate: end };
};

const getDaysOfWeek = (startDate: Date) => {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    days.push(day);
  }
  return days;
};

// --- MAIN COMPONENT ---
export default function ShiftManagementPage() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [shifts, setShifts] = useState<ShiftScheduleState>({});
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- NEW STATE: To manage which row is being edited ---
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  // --- NEW STATE: To hold temporary changes for the row being edited ---
  const [tempRowData, setTempRowData] = useState<Record<string, Shift> | null>(null);


  const { startDate, endDate } = useMemo(() => getWeekDateRange(currentDate), [currentDate]);
  const weekDays = useMemo(() => getDaysOfWeek(startDate), [startDate]);

  const fetchData = useCallback(async () => {
    // ... (fetchData logic is unchanged)
    setIsLoading(true);
    setError(null);
    try {
      const staffResponse = await fetch('/api/staff?action=list');
      if (!staffResponse.ok) throw new Error('Failed to fetch staff list');
      const staffData = await staffResponse.json();
      const activeStaff: StaffMember[] = staffData.data.filter((s: StaffMember) => s.status === 'active');
      setStaffList(activeStaff);

      const { startDate: weekStart, endDate: weekEnd } = getWeekDateRange(currentDate);
      const shiftResponse = await fetch(`/api/shifts?startDate=${weekStart.toISOString()}&endDate=${weekEnd.toISOString()}`);
      if (!shiftResponse.ok) throw new Error('Failed to fetch shift data');
      const shiftData = await shiftResponse.json();
      
      const currentWeekDays = getDaysOfWeek(weekStart);
      const schedule: ShiftScheduleState = {};
      activeStaff.forEach(staff => {
        schedule[staff._id] = {};
        currentWeekDays.forEach(day => {
          const dateStr = day.toISOString().split('T')[0];
          const existingShift = shiftData.data?.find(
            (s: any) => s.employeeId === staff._id && s.date.startsWith(dateStr)
          );
          schedule[staff._id][dateStr] = existingShift || {
            employeeId: staff._id,
            date: day.toISOString(),
            isWeekOff: false,
            shiftTiming: '',
          };
        });
      });
      setShifts(schedule);
    } catch (err: any) {
      setError(err.message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- NEW HANDLER: Starts the editing process for a row ---
  const handleEditClick = (employeeId: string) => {
    setEditingRowId(employeeId);
    // Create a deep copy of the row's data to edit temporarily
    setTempRowData(JSON.parse(JSON.stringify(shifts[employeeId])));
  };

  // --- NEW HANDLER: Cancels editing for a row ---
  const handleCancelClick = () => {
    setEditingRowId(null);
    setTempRowData(null);
  };
  
  // --- NEW HANDLER: Updates the temporary state as the user types ---
  const handleTempRowChange = (date: string, field: 'shiftTiming' | 'isWeekOff', value: string | boolean) => {
    if (!tempRowData) return;
    const newRowData = { ...tempRowData };
    newRowData[date] = { ...newRowData[date], [field]: value };
    if (field === 'isWeekOff' && value === true) {
      newRowData[date].shiftTiming = '';
    }
    setTempRowData(newRowData);
  };

  // --- MODIFIED HANDLER: Saves only the currently edited row ---
  const handleSaveRow = async () => {
    if (!editingRowId || !tempRowData) return;

    setIsSaving(true);
    setError(null);
    
    // Create payload only from the temporary row data
    const payload: Shift[] = Object.values(tempRowData);

    try {
        const response = await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to save changes.');
        }

        // On success, update the main state and exit editing mode
        setShifts(prev => ({
          ...prev,
          [editingRowId]: tempRowData
        }));
        setEditingRowId(null);
        setTempRowData(null);
        alert('Schedule updated successfully!');

    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsSaving(false);
    }
  };

  const changeWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'prev' ? -7 : 7));
    setCurrentDate(newDate);
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
          <h1 className="text-2xl font-bold text-gray-800">Shift Management</h1>
          <div className="flex items-center gap-2">
            {/* Week navigation is unchanged */}
            <Button variant="outline" size="sm" icon={<ArrowLeft size={16} />} onClick={() => changeWeek('prev')} disabled={isLoading || isSaving}>
              Prev Week
            </Button>
            <span className="font-semibold text-gray-700 w-48 text-center">
              {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
            </span>
            <Button variant="outline" size="sm" icon={<ArrowRight size={16} />} onClick={() => changeWeek('next')} disabled={isLoading || isSaving}>
              Next Week
            </Button>
          </div>
          {/* Main Save button is removed */}
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative mb-4 flex items-center gap-2">
            <AlertCircle size={18} /> <span><strong>Error:</strong> {error}</span>
          </div>
        )}

        <div className="overflow-x-auto shadow-lg rounded-lg bg-white">
          <table className="min-w-full text-center text-sm border-collapse">
            <thead className="bg-yellow-400 font-bold">
              <tr>
                <th className="p-3 border-r sticky left-0 bg-purple-700 text-white z-10 w-48">Staff Name</th>
                {weekDays.map(day => (
                  <th key={day.toISOString()} className="p-2 border-r">
                    <div>{day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    <div className="font-normal">{day.toLocaleDateString('en-US', { weekday: 'long' })}</div>
                  </th>
                ))}
                {/* --- NEW: Header for the Actions column --- */}
                <th className="p-3 border-r w-40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? ( /* ... unchanged loading/empty state ... */
                <tr>
                  <td colSpan={9} className="text-center p-10">
                    <div className="flex justify-center items-center gap-2 text-gray-500">
                      <Loader2 className="animate-spin" /> Loading Schedule...
                    </div>
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                   <td colSpan={9} className="text-center p-10 text-gray-500">No active staff found. Please add staff first.</td>
                </tr>
              ) : (
                staffList.map((staff, staffIndex) => {
                  const isCurrentRowEditing = editingRowId === staff._id;
                  const rowData = isCurrentRowEditing ? tempRowData : shifts[staff._id];

                  return (
                    <tr key={staff._id} className={staffIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 border-r font-semibold sticky left-0 z-10 w-48" style={{ backgroundColor: staffIndex % 2 === 0 ? 'white' : '#F9FAFB' }}>
                        <div>{staff.name}</div>
                        <div className="text-xs text-gray-500 font-normal">ID: {staff.staffIdNumber}</div>
                      </td>
                      
                      {weekDays.map(day => {
                        const dateStr = day.toISOString().split('T')[0];
                        const shift = rowData?.[dateStr];
                        if (!shift) return <td key={dateStr} className="border-r"></td>;

                        // --- MODIFIED: Conditionally render inputs or plain text ---
                        return (
                          <td key={dateStr} className={`p-2 border-r ${shift.isWeekOff ? 'bg-green-100' : ''}`}>
                            {isCurrentRowEditing ? (
                              <div className="flex items-center justify-center gap-2">
                                <label className="flex items-center gap-1 cursor-pointer text-xs">
                                  <input type="checkbox" checked={shift.isWeekOff} onChange={(e) => handleTempRowChange(dateStr, 'isWeekOff', e.target.checked)} className="form-checkbox h-4 w-4"/>
                                  Off
                                </label>
                                <input type="text" placeholder="e.g., 9-6" value={shift.shiftTiming} onChange={(e) => handleTempRowChange(dateStr, 'shiftTiming', e.target.value)} disabled={shift.isWeekOff} className={`w-20 p-1 text-center border rounded-md ${shift.isWeekOff ? 'bg-gray-200' : 'border-gray-300'}`}/>
                              </div>
                            ) : (
                              <div className="h-8 flex items-center justify-center">
                                {shift.isWeekOff ? (<span className="font-bold text-green-700">WEEK OFF</span>) : (<span>{shift.shiftTiming || '--'}</span>)}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      
                      {/* --- NEW: Actions Column for Edit/Save/Cancel --- */}
                      <td className="p-2 border-r">
                        <div className="flex items-center justify-center gap-2">
                          {isCurrentRowEditing ? (
                            <>
                              <Button variant="primary" size="sm" icon={<Save size={14} />} onClick={handleSaveRow} isLoading={isSaving}>Save</Button>
                              <Button variant="ghost" size="sm" icon={<XCircle size={14} />} onClick={handleCancelClick} disabled={isSaving}>Cancel</Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm" icon={<Edit size={14} />} onClick={() => handleEditClick(staff._id)} disabled={editingRowId !== null}>
                              Assign Shift
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
