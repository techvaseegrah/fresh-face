// src/app/(main)/staffmanagement/attendance/page.tsx
// This is the final, fully corrected code for your page component.
// The Monthly Summary modal has been updated to show the staff's position under their name, as requested.

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Calendar, Clock, Search, CheckCircle, XCircle, AlertTriangle, LogOut, LogIn, PlayCircle, PauseCircle, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStaff } from '../../../../context/StaffContext';
import { AttendanceRecordTypeFE, StaffMember, TemporaryExitTypeFE } from '../../../../context/StaffContext';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isWeekend, differenceInMinutes, addMonths, subMonths, isEqual, startOfDay } from 'date-fns';

// Helper function to get initials from a name (Original Function)
const getInitials = (name: string = ''): string => {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length > 1) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0].length > 1) {
    return `${parts[0][0]}${parts[0][1]}`.toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }
  return 'S';
};

// Centralized helper function to format duration (Original Function)
const formatDuration = (minutes: number | null): string => {
    if (minutes === null || isNaN(minutes) || minutes < 0) return "0h 0m";
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours}h ${mins}m`;
};

// Avatar component with a vibrant, modern color palette and ring effect.
const Avatar: React.FC<{
  src?: string | null;
  name: string;
  className?: string;
}> = ({ src, name, className = "h-10 w-10" }) => {
  const [imageError, setImageError] = useState(false);
  useEffect(() => { setImageError(false); }, [src]);
  const initials = getInitials(name);
  const colorClasses = [
    'bg-violet-200 text-violet-800', 'bg-emerald-200 text-emerald-800', 'bg-sky-200 text-sky-800',
    'bg-rose-200 text-rose-800', 'bg-amber-200 text-amber-800', 'bg-indigo-200 text-indigo-800',
    'bg-pink-200 text-pink-800'
  ];
  const colorIndex = (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % colorClasses.length;
  const handleImageError = () => setImageError(true);
  if (src && !imageError) {
    return <img src={src} alt={name} className={`${className} rounded-full object-cover ring-2 ring-white`} onError={handleImageError} />;
  }
  return (
    <div className={`${className} rounded-full flex items-center justify-center font-bold text-sm ${colorClasses[colorIndex]} ring-2 ring-white`} title={name}>
      {initials}
    </div>
  );
};


// Attendance Detail Modal with a premium, attractive look.
const AttendanceDetailModal: React.FC<{ record: AttendanceRecordTypeFE; onClose: () => void }> = ({ record, onClose }) => {
  const requiredMinutesForRecord = record.requiredMinutes || (9 * 60);
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden transform transition-all">
        <div className="p-6 bg-gradient-to-br from-purple-600 to-indigo-600 text-white relative">
          <h3 className="text-xl font-bold text-white mb-2">Attendance Details</h3>
          <p className="text-sm opacity-80">{format(record.date, 'eeee, MMMM d, yyyy')}</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center pb-4 border-b border-gray-200">
            <Avatar src={record.staff.image} name={record.staff.name} className="h-14 w-14" />
            <div className="ml-4">
              <div className="text-lg font-bold text-gray-900">{record.staff.name}</div>
              <div className="text-sm text-gray-500">{record.staff.position}</div>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center"><span className="font-medium text-gray-600">Status:</span><span className={`px-2 py-1 inline-flex leading-5 font-semibold rounded-full ${record.isWorkComplete ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{record.status.charAt(0).toUpperCase() + record.status.slice(1).replace('_', ' ')}</span></div>
            <div className="flex justify-between items-center"><span className="font-medium text-gray-600">Check In:</span><span className="font-mono text-gray-800">{record.checkIn ? format(record.checkIn, 'HH:mm:ss') : 'N/A'}</span></div>
            <div className="flex justify-between items-center"><span className="font-medium text-gray-600">Check Out:</span><span className="font-mono text-gray-800">{record.checkOut ? format(record.checkOut, 'HH:mm:ss') : 'N/A'}</span></div>
            <div className="flex justify-between items-center"><span className="font-medium text-gray-600">Total Working Time:</span><span className="font-semibold text-gray-800">{formatDuration(record.totalWorkingMinutes)}</span></div>
            <div className="flex justify-between items-center"><span className="font-medium text-gray-600">Required Time:</span><span className={`font-semibold ${record.isWorkComplete ? 'text-green-600' : 'text-red-600'}`}>{formatDuration(requiredMinutesForRecord)} {record.isWorkComplete ? '' : '(Incomplete)'}</span></div>
          </div>
          {record.temporaryExits && record.temporaryExits.length > 0 && (
            <div className="pt-3 border-t">
              <h4 className="font-medium text-gray-600 mb-2">Temporary Exits:</h4>
              <ul className="space-y-2 max-h-32 overflow-y-auto pr-2">
                {record.temporaryExits.map((exit: TemporaryExitTypeFE) => (
                  <li key={exit.id} className="p-2.5 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center font-mono text-xs text-gray-800"><span>{format(exit.startTime, 'HH:mm')} - {exit.endTime ? format(exit.endTime, 'HH:mm') : 'Ongoing'}</span><span className="font-sans font-semibold text-purple-600">({formatDuration(exit.durationMinutes)})</span></div>
                    {exit.reason && <p className="text-xs text-gray-500 mt-1 italic">Reason: {exit.reason}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
          <Button variant="danger" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};


// UI CHANGE: Monthly Summary Modal updated to show the staff position.
const StaffMonthlySummaryModal: React.FC<{ staff: StaffMember; records: AttendanceRecordTypeFE[]; monthDate: Date; onClose: () => void; }> = ({ staff, records, monthDate, onClose }) => {
    // Original logic is preserved
    const staffMonthlyRecords = records.filter(r => r.staff.id === staff.id && r.date.getMonth() === monthDate.getMonth() && r.date.getFullYear() === monthDate.getFullYear());
    const presentDays = staffMonthlyRecords.filter(r => ['present', 'late'].includes(r.status) && r.isWorkComplete).length;
    const absentDays = staffMonthlyRecords.filter(r => r.status === 'absent').length;
    const leaveDays = staffMonthlyRecords.filter(r => r.status === 'on_leave' || (['present', 'late', 'incomplete'].includes(r.status) && !r.isWorkComplete)).length;
    const totalOvertimeMinutes = staffMonthlyRecords.reduce((total, record) => { const requiredMinutes = record.requiredMinutes || (9 * 60); if (record.totalWorkingMinutes && record.totalWorkingMinutes > requiredMinutes) { return total + (record.totalWorkingMinutes - requiredMinutes); } return total; }, 0);
    const totalOvertimeHours = Math.floor(totalOvertimeMinutes / 60);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden transform transition-all">
                <div className="p-6 bg-gradient-to-br from-purple-600 to-indigo-600 text-white">
                     <h3 className="text-xl font-bold text-white mb-2">Monthly Summary - {format(monthDate, 'MMMM yyyy')}</h3>
                     <div className="flex items-center">
                        <Avatar src={staff.image} name={staff.name} className="h-14 w-14" />
                        <div className="ml-4">
                            <div className="text-lg font-bold">{staff.name}</div>
                            {/* THIS IS THE CHANGED LINE: Displays the staff position now. */}
                            <div className="text-sm opacity-80">{staff.position}</div>
                        </div>
                    </div>
                </div>
                {/* Preserving original information layout */}
                <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-green-100 p-4 rounded-lg text-center border border-green-200"><p className="text-sm text-green-700 font-medium">Present Days</p><p className="text-3xl font-bold text-green-800">{presentDays}</p></div>
                    <div className="bg-red-100 p-4 rounded-lg text-center border border-red-200"><p className="text-sm text-red-700 font-medium">Absent Days</p><p className="text-3xl font-bold text-red-800">{absentDays}</p></div>
                    <div className="bg-blue-100 p-4 rounded-lg text-center border border-blue-200"><p className="text-sm text-blue-700 font-medium">On Leave</p><p className="text-3xl font-bold text-blue-800">{leaveDays}</p></div>
                    <div className="bg-purple-100 p-4 rounded-lg text-center border border-purple-200"><p className="text-sm text-purple-700 font-medium">Total OT Hours</p><p className="text-3xl font-bold text-purple-800">{totalOvertimeHours}</p></div>
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
                    <Button variant="danger" onClick={onClose}>Close</Button>
                </div>
            </div>
        </div>
    );
};

const Attendance: React.FC = () => {
  // All original state and hooks are preserved
  const { staffMembers, attendanceRecordsFE, loadingAttendance, errorAttendance, fetchAttendanceRecords, checkInStaff, checkOutStaff, startTemporaryExit, endTemporaryExit } = useStaff();
  const [searchTerm, setSearchTerm] = useState('');
  const [dailyRequiredHours, setDailyRequiredHours] = useState(9); 
  const [settingsLoading, setSettingsLoading] = useState(true); 
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<AttendanceRecordTypeFE | null>(null);
  const [selectedStaffForSummary, setSelectedStaffForSummary] = useState<StaffMember | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingCheckOutData, setPendingCheckOutData] = useState<{ attendanceId: string; staffName: string; requiredHours: number } | null>(null);
  const [showTempExitModal, setShowTempExitModal] = useState(false);
  const [selectedAttendanceIdForTempExit, setSelectedAttendanceIdForTempExit] = useState<string | null>(null);
  const [tempExitReason, setTempExitReason] = useState('');

  // All original effects and callbacks are preserved
  useEffect(() => { fetchAttendanceRecords({ year: currentMonthDate.getFullYear(), month: currentMonthDate.getMonth() + 1, }); }, [currentMonthDate, fetchAttendanceRecords]);
  useEffect(() => { const fetchShopSettings = async () => { setSettingsLoading(true); try { const response = await fetch('/api/settings'); const result = await response.json(); if (result.success && result.data) { setDailyRequiredHours(result.data.defaultDailyHours); } else { console.error("Could not fetch shop settings, using default.", result.error); } } catch (error) { console.error("Error fetching shop settings:", error); } finally { setSettingsLoading(false); } }; fetchShopSettings(); }, []);
  const activeStaffMembers = staffMembers.filter((staff: StaffMember) => staff.status === 'active');
  const filteredStaff = activeStaffMembers.filter((staff: StaffMember) => staff.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentMonthDate), end: endOfMonth(currentMonthDate) });
  const goToPreviousMonth = () => setCurrentMonthDate(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonthDate(prev => addMonths(prev, 1));
  const handleCalendarCellClick = (staffId: string, day: Date) => { if (day.getTime() > new Date().getTime()) return; const dayStart = startOfDay(day); const record = attendanceRecordsFE.find((r: AttendanceRecordTypeFE) => r.staff.id === staffId && isEqual(startOfDay(r.date), dayStart)); if (record) { setSelectedRecordForDetail(record); } };
  const getMonthlyAttendanceIcon = (staffId: string, day: Date): React.ReactNode => { const dayStart = startOfDay(day); const record = attendanceRecordsFE.find((r: AttendanceRecordTypeFE) => r.staff.id === staffId && isEqual(startOfDay(r.date), dayStart)); let icon: React.ReactNode = null; let title = ""; if (!record) { if (isWeekend(day)) { title = "Weekend"; icon = <span className="block h-2 w-2 rounded-sm bg-gray-200" />; } else if (day.getTime() > new Date().setHours(23,59,59,999)) { title = "Future"; icon = <span className="block h-5 w-5" />; } else { title = "Not Recorded"; icon = <Info className="h-4 w-4 text-gray-400" />; } return <div className="flex justify-center items-center h-full" title={title}>{icon}</div>; } title = `View details for ${record.staff.name} on ${format(day, 'MMM d')}`; switch (record.status) { case 'present': case 'incomplete': icon = <CheckCircle className={`h-5 w-5 ${record.isWorkComplete ? 'text-green-500' : 'text-orange-400'}`} />; break; case 'absent': icon = <XCircle className="h-5 w-5 text-red-500" />; break; case 'late': icon = <AlertTriangle className="h-5 w-5 text-yellow-500" />; break; case 'on_leave': icon = <Calendar className="h-5 w-5 text-blue-500" />; break; default: icon = <span className="block h-2 w-2 rounded-full bg-gray-300" />; } return <div className="flex justify-center items-center h-full w-full cursor-pointer rounded-lg hover:bg-purple-100 transition-colors" title={title} onClick={() => handleCalendarCellClick(staffId, day)}>{icon}</div>; };
  const calculateFrontendWorkingMinutes = useCallback((attendance: AttendanceRecordTypeFE): number => { let totalMinutes = 0; if (attendance.checkIn && attendance.checkOut) { return attendance.totalWorkingMinutes; } else if (attendance.checkIn && !attendance.checkOut) { totalMinutes = differenceInMinutes(new Date(), attendance.checkIn); } let tempExitDeduction = 0; (attendance.temporaryExits || []).forEach((exit: TemporaryExitTypeFE) => { if (!exit.isOngoing && exit.endTime) { tempExitDeduction += exit.durationMinutes; } else if (exit.isOngoing) { tempExitDeduction += differenceInMinutes(new Date(), exit.startTime); } }); return Math.max(0, totalMinutes - tempExitDeduction); }, []);
  const handleCheckIn = async (staffId: string) => { try { await checkInStaff(staffId, dailyRequiredHours); toast.success('Successfully checked in!'); } catch (err) { toast.error(err instanceof Error ? err.message : 'Check-in failed'); } };
  const handleCheckOutAttempt = async (attendanceId: string, staffName: string) => { const attendance = attendanceRecordsFE.find((a: AttendanceRecordTypeFE) => a.id === attendanceId); if (!attendance || attendance.checkOut) return; if (attendance.temporaryExits?.some((exit: TemporaryExitTypeFE) => exit.isOngoing)) { toast.error("Please end the ongoing temporary exit before checking out."); return; } const estimatedMinutes = attendance.checkOut ? attendance.totalWorkingMinutes : calculateFrontendWorkingMinutes(attendance); const requiredMinutes = attendance.requiredMinutes || (dailyRequiredHours * 60); if (estimatedMinutes < requiredMinutes) { setPendingCheckOutData({ attendanceId, staffName, requiredHours: requiredMinutes / 60 }); setShowConfirmModal(true); } else { await confirmCheckOut(attendanceId, requiredMinutes / 60); } };
  const confirmCheckOut = async (attendanceId: string, requiredHours: number) => { try { await checkOutStaff(attendanceId, requiredHours); toast.success('Successfully checked out!'); } catch (err) { toast.error(err instanceof Error ? err.message : 'Check-out failed'); } finally { setPendingCheckOutData(null); setShowConfirmModal(false); } };
  const handleOpenTempExitModal = (attendanceId: string) => { const att = attendanceRecordsFE.find((a: AttendanceRecordTypeFE) => a.id === attendanceId); if (!att || att.checkOut || (att.temporaryExits || []).some((e: TemporaryExitTypeFE) => e.isOngoing)) { toast.error("Cannot start temp exit: Staff already checked out or an exit is ongoing."); return; } setSelectedAttendanceIdForTempExit(attendanceId); setShowTempExitModal(true); setTempExitReason(''); };
  const handleSubmitTempExit = async () => { if (!selectedAttendanceIdForTempExit || !tempExitReason.trim()) { toast.error("A reason is required to start a temporary exit."); return; } try { await startTemporaryExit(selectedAttendanceIdForTempExit, tempExitReason.trim()); toast.success('Temporary exit started.'); } catch (err) { toast.error(err instanceof Error ? err.message : 'Starting temp exit failed'); } finally { setShowTempExitModal(false); setTempExitReason(''); setSelectedAttendanceIdForTempExit(null); } };
  const handleEndTempExit = async (attendanceId: string, tempExitId: string) => { try { await endTemporaryExit(attendanceId, tempExitId); toast.success('Temporary exit ended.'); } catch (err) { toast.error(err instanceof Error ? err.message : 'Ending temp exit failed'); } };
  const getTodayAttendance = (staffIdToFind: string): AttendanceRecordTypeFE | undefined => { const todayStart = startOfDay(new Date()); return attendanceRecordsFE.find((record: AttendanceRecordTypeFE) => record.staff.id === staffIdToFind && isEqual(startOfDay(record.date), todayStart) ); };
  const handleStaffSummaryClick = (staff: StaffMember) => { setSelectedStaffForSummary(staff); };

  return (
    <div className="space-y-8 p-4 md:p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Attendance Management</h1>
      {errorAttendance && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-r-lg" role="alert"><p>{errorAttendance}</p></div>}
      
      <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Search staff name..." className="pl-12 pr-4 py-2.5 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="dailyHours" className="text-sm font-medium text-gray-700 whitespace-nowrap">Required Hours:</label>
          <input type="number" id="dailyHours" value={settingsLoading ? '...' : dailyRequiredHours} readOnly className="w-20 border-gray-300 rounded-lg shadow-sm bg-gray-100 sm:text-sm px-3 py-2 text-gray-900 font-semibold" />
        </div>
      </div>

      {(loadingAttendance || settingsLoading) && <div className="text-center py-20 text-gray-500 flex items-center justify-center gap-3"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div><p>Loading Data...</p></div>}
      
      {!(loadingAttendance || settingsLoading) && (
        <>
        <Card title={`Today's Attendance (${format(new Date(), 'eeee, MMMM d')})`} className="!p-0 overflow-hidden shadow-lg rounded-xl border">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Staff</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Check In/Out</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Working Time</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Required</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Temp Exits</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStaff.map((staff: StaffMember) => { const todayAttendance = getTodayAttendance(staff.id); const workingMinutes = todayAttendance ? (todayAttendance.checkOut ? todayAttendance.totalWorkingMinutes : calculateFrontendWorkingMinutes(todayAttendance)) : 0; const actualRequiredMinutes = todayAttendance?.requiredMinutes || (dailyRequiredHours * 60); const remainingMinutes = Math.max(0, actualRequiredMinutes - workingMinutes); const ongoingTempExit = todayAttendance?.temporaryExits?.find((exit: TemporaryExitTypeFE) => exit.isOngoing);
                  return (
                    <tr key={staff.id} className="hover:bg-violet-50/70 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><Avatar src={staff.image} name={staff.name} className="h-11 w-11" /><div className="ml-4"><div className="text-sm font-medium text-gray-900">{staff.name}</div><div className="text-xs text-gray-500">{staff.position}</div></div></div></td>
                      <td className="px-6 py-4 whitespace-nowrap">{todayAttendance ? <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md ${todayAttendance.isWorkComplete ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{todayAttendance.status.charAt(0).toUpperCase() + todayAttendance.status.slice(1).replace('_', ' ')}{!todayAttendance.isWorkComplete && ' (Inc.)'}</span> : <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md bg-gray-100 text-gray-800">Not Recorded</span>}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"><div><Clock className="h-4 w-4 text-gray-400 mr-1.5 inline-block" /> In: {todayAttendance?.checkIn ? format(todayAttendance.checkIn, 'HH:mm') : '—'}</div><div><Clock className="h-4 w-4 text-gray-400 mr-1.5 inline-block" /> Out: {todayAttendance?.checkOut ? format(todayAttendance.checkOut, 'HH:mm') : '—'}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm font-semibold text-gray-900">{formatDuration(workingMinutes)}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className={`text-sm font-medium ${remainingMinutes > 0 && workingMinutes > 0 && !todayAttendance?.isWorkComplete ? 'text-red-600' : (todayAttendance?.isWorkComplete ? 'text-green-600' : 'text-gray-700')}`}>{todayAttendance?.isWorkComplete ? 'Completed' : (remainingMinutes > 0 && workingMinutes > 0 ? `${formatDuration(remainingMinutes)} rem.` : formatDuration(actualRequiredMinutes))}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap max-w-xs">{todayAttendance?.temporaryExits && todayAttendance.temporaryExits.length > 0 && (<div className="space-y-1.5">{todayAttendance.temporaryExits.map((exit: TemporaryExitTypeFE) => (<div key={exit.id} className="text-xs" title={exit.reason ?? undefined}><div className={`flex items-center space-x-1.5 ${exit.isOngoing ? 'text-blue-600 font-semibold animate-pulse' : 'text-gray-500'}`}><span>{format(exit.startTime, 'HH:mm')} - {exit.endTime ? format(exit.endTime, 'HH:mm') : 'Ongoing'}</span>{!exit.isOngoing && exit.endTime && (<span className="text-purple-600">({formatDuration(exit.durationMinutes)})</span>)}</div>{exit.reason && <p className="text-gray-600 truncate">{exit.reason}</p>}</div>))}</div>)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">{!todayAttendance ? <Button size="sm" icon={<LogIn size={14} />} onClick={() => handleCheckIn(staff.id)}>Check In</Button> : <div className="flex justify-end items-center space-x-2">{!todayAttendance.checkOut && (<>{ongoingTempExit ? <Button size="xs" variant="success" icon={<PauseCircle size={12} />} onClick={() => handleEndTempExit(todayAttendance.id, ongoingTempExit.id)}>End Exit</Button> : <Button size="xs" variant="outline" icon={<PlayCircle size={12} />} onClick={() => handleOpenTempExitModal(todayAttendance.id)} disabled={!!todayAttendance.checkOut}>Temp Exit</Button>}<Button size="xs" variant="secondary" icon={<LogOut size={12} />} onClick={() => handleCheckOutAttempt(todayAttendance.id, staff.name)} disabled={!!todayAttendance.checkOut || !!ongoingTempExit}>Check Out</Button></>)}{todayAttendance.checkOut && (<span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded-md font-semibold">Checked Out</span>)}</div>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        
        <div className="flex items-center justify-between mt-8 mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Monthly Attendance Overview</h2>
            <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={goToPreviousMonth} className="!p-2"><ChevronLeft size={16}/></Button>
                <span className="font-semibold text-gray-700 w-36 text-center">{format(currentMonthDate, 'MMMM yyyy')}</span>
                <Button variant="outline" size="sm" onClick={goToNextMonth} className="!p-2"><ChevronRight size={16}/></Button>
            </div>
        </div>
        <Card className="!p-0 overflow-hidden shadow-lg rounded-xl border">
          <div className="overflow-x-auto pb-2">
            <table className="min-w-full border-collapse">
              <thead className="bg-gray-50"><tr><th className="w-52 py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase sticky left-0 bg-gray-50/80 backdrop-blur-sm z-10 border-b border-r">Staff</th>{daysInMonth.map((day) => (<th key={format(day, 'd')} className={`w-14 h-14 text-center py-2 text-xs font-semibold uppercase border-b border-l ${isWeekend(day) ? 'text-gray-400 bg-gray-100/50' : isToday(day) ? 'text-purple-700 font-bold bg-purple-50' : 'text-gray-500'}`}><div>{format(day, 'd')}</div><div className="text-[10px] font-normal">{format(day, 'EEE').charAt(0)}</div></th>))}</tr></thead>
              <tbody>
                {filteredStaff.map((staff: StaffMember) => (
                  <tr key={staff.id} className="border-b border-gray-200 last:border-b-0 group">
                    <td className="py-2 px-3 sticky left-0 bg-white group-hover:bg-violet-50 z-10 border-r cursor-pointer transition-colors" onClick={() => handleStaffSummaryClick(staff)} title={`View monthly summary for ${staff.name}`}>
                      <div className="flex items-center"><Avatar src={staff.image} name={staff.name} className="h-9 w-9 mr-3" /><p className="text-sm font-medium text-gray-800 whitespace-nowrap">{staff.name}</p></div>
                    </td>
                    {daysInMonth.map((day) => (<td key={format(day, 'd')} className="text-center py-2 border-l">{getMonthlyAttendanceIcon(staff.id, day)}</td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        </>
      )}

      {selectedRecordForDetail && (<AttendanceDetailModal record={selectedRecordForDetail} onClose={() => setSelectedRecordForDetail(null)} />)}
      {selectedStaffForSummary && (<StaffMonthlySummaryModal staff={selectedStaffForSummary} records={attendanceRecordsFE} monthDate={currentMonthDate} onClose={() => setSelectedStaffForSummary(null)} />)}
      {showConfirmModal && pendingCheckOutData && ( <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"><div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl text-center"><div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100"><AlertTriangle className="h-8 w-8 text-red-600" aria-hidden="true" /></div><h3 className="text-xl font-bold text-gray-900 mt-5">Incomplete Hours</h3><p className="text-sm text-gray-500 mt-2">Staff <span className="font-semibold">{pendingCheckOutData.staffName}</span> hasn't completed required hours ({formatDuration(pendingCheckOutData.requiredHours * 60)}). Checkout anyway?</p><div className="flex justify-center space-x-4 mt-8"><Button variant="secondary" onClick={() => { setShowConfirmModal(false); setPendingCheckOutData(null); }}>Go Back</Button><Button variant="danger" onClick={() => {if (pendingCheckOutData) confirmCheckOut(pendingCheckOutData.attendanceId, pendingCheckOutData.requiredHours);}}>Check Out</Button></div></div></div>)}
      {showTempExitModal && selectedAttendanceIdForTempExit && ( <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"><div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"><h3 className="text-xl font-bold text-gray-800 mb-4">Record Temporary Exit</h3><div className="space-y-4"><div><label htmlFor="tempExitReason" className="block text-sm font-medium text-gray-700 mb-1">Reason*</label><textarea id="tempExitReason" rows={3} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm p-3 text-gray-900" value={tempExitReason} onChange={(e) => setTempExitReason(e.target.value)} placeholder="e.g., Lunch break, client meeting..." required /></div><div className="flex justify-end space-x-3 pt-4"><Button variant="outline-danger" onClick={() => { setShowTempExitModal(false); setTempExitReason(''); setSelectedAttendanceIdForTempExit(null); }}>Cancel</Button><Button onClick={handleSubmitTempExit} disabled={!tempExitReason.trim()}>Start Exit</Button></div></div></div></div>)}
    </div>
  );
};
export default Attendance;