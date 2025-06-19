// src/app/staffmanagement/attendance/page.tsx

'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Search, CheckCircle, XCircle, AlertTriangle, LogOut, LogIn, PlayCircle, PauseCircle, Info } from 'lucide-react';
import { useStaff } from '../../../../context/StaffContext';
import { AttendanceRecordTypeFE } from '../../../../context/StaffContext';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isWeekend, differenceInMinutes, addMonths, subMonths, isEqual, startOfDay } from 'date-fns';

const AttendanceDetailModal: React.FC<{ record: AttendanceRecordTypeFE; onClose: () => void }> = ({ record, onClose }) => {
  const formatDuration = (minutes: number | null): string => {
    if (minutes === null || isNaN(minutes) || minutes < 0) return "0h 0m";
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours}h ${mins}m`;
  };
  const requiredMinutesForRecord = record.requiredMinutes || (9 * 60);
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Attendance Details - {format(record.date, 'eeee, MMMM d, yyyy')}</h3>
        <div className="flex items-center mb-4 pb-4 border-b">
          <img src={record.staff.image || '/placeholder-avatar.png'} alt={record.staff.name} className="h-14 w-14 rounded-full object-cover" />
          <div className="ml-4">
            <div className="text-lg font-medium text-gray-900">{record.staff.name}</div>
            <div className="text-sm text-gray-500">{record.staff.position}</div>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center"><span className="font-medium text-gray-600">Status:</span><span className={`px-2 py-1 inline-flex leading-5 font-semibold rounded-full ${record.isWorkComplete ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{record.status.charAt(0).toUpperCase() + record.status.slice(1).replace('_', ' ')}</span></div>
          <div className="flex justify-between items-center"><span className="font-medium text-gray-600">Check In:</span><span className="text-gray-800">{record.checkIn ? format(record.checkIn, 'HH:mm:ss') : 'N/A'}</span></div>
          <div className="flex justify-between items-center"><span className="font-medium text-gray-600">Check Out:</span><span className="text-gray-800">{record.checkOut ? format(record.checkOut, 'HH:mm:ss') : 'N/A'}</span></div>
          <div className="flex justify-between items-center"><span className="font-medium text-gray-600">Total Working Time:</span><span className="font-semibold text-gray-800">{formatDuration(record.totalWorkingMinutes)}</span></div>
          <div className="flex justify-between items-center"><span className="font-medium text-gray-600">Required Time:</span><span className={`font-semibold ${record.isWorkComplete ? 'text-green-600' : 'text-red-600'}`}>{formatDuration(requiredMinutesForRecord)} {record.isWorkComplete ? '' : '(Incomplete)'}</span></div>
          {record.temporaryExits && record.temporaryExits.length > 0 && (
            <div className="pt-3 border-t">
              <h4 className="font-medium text-gray-600 mb-2">Temporary Exits:</h4>
              <ul className="space-y-2">
                {record.temporaryExits.map(exit => (
                  <li key={exit.id} className="p-2 bg-gray-50 rounded-md">
                    <div className="flex justify-between items-center font-mono text-xs text-gray-800"><span>{format(exit.startTime, 'HH:mm')} - {exit.endTime ? format(exit.endTime, 'HH:mm') : 'Ongoing'}</span><span className="font-sans font-semibold text-purple-600">({formatDuration(exit.durationMinutes)})</span></div>
                    {exit.reason && <p className="text-xs text-gray-500 mt-1 italic">Reason: {exit.reason}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div>
      </div>
    </div>
  );
};

const Attendance: React.FC = () => {
  const { staffMembers, attendanceRecordsFE, loadingAttendance, errorAttendance, fetchAttendanceRecords, checkInStaff, checkOutStaff, startTemporaryExit, endTemporaryExit } = useStaff();
  const [searchTerm, setSearchTerm] = useState('');
  
  // *** MODIFICATION 1: Initialize state, but it will be updated by the fetch call.
  const [dailyRequiredHours, setDailyRequiredHours] = useState(9); // Default fallback
  const [settingsLoading, setSettingsLoading] = useState(true); // Loading state for settings

  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<AttendanceRecordTypeFE | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingCheckOutData, setPendingCheckOutData] = useState<{ attendanceId: string; staffName: string; requiredHours: number } | null>(null);
  const [showTempExitModal, setShowTempExitModal] = useState(false);
  const [selectedAttendanceIdForTempExit, setSelectedAttendanceIdForTempExit] = useState<string | null>(null);
  const [tempExitReason, setTempExitReason] = useState('');

  // Fetch monthly attendance records
  useEffect(() => {
    fetchAttendanceRecords({
        year: currentMonthDate.getFullYear(),
        month: currentMonthDate.getMonth() + 1,
    });
  }, [currentMonthDate, fetchAttendanceRecords]);
  
  // *** MODIFICATION 2: Add a new useEffect to fetch settings on component mount.
  useEffect(() => {
    const fetchShopSettings = async () => {
        setSettingsLoading(true);
        try {
            const response = await fetch('/api/settings'); // Fetch from the new API route
            const result = await response.json();
            if (result.success && result.data) {
                // Update the state with the value from the database
                setDailyRequiredHours(result.data.defaultDailyHours);
            } else {
                console.error("Could not fetch shop settings, using default.", result.error);
            }
        } catch (error) {
            console.error("Error fetching shop settings:", error);
        } finally {
            setSettingsLoading(false);
        }
    };

    fetchShopSettings();
  }, []); // Empty dependency array means it runs only once on mount

  const activeStaffMembers = staffMembers.filter(staff => staff.status === 'active');
  const filteredStaff = activeStaffMembers.filter(staff => staff.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentMonthDate), end: endOfMonth(currentMonthDate) });
  const goToPreviousMonth = () => setCurrentMonthDate(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonthDate(prev => addMonths(prev, 1));
  const handleCalendarCellClick = (staffId: string, day: Date) => { if (day.getTime() > new Date().getTime()) return; 
  const dayStart = startOfDay(day); 
  const record = attendanceRecordsFE.find(r => r.staff.id === staffId && isEqual(startOfDay(r.date), dayStart)); if (record) { setSelectedRecordForDetail(record); } };
  const getMonthlyAttendanceIcon = (staffId: string, day: Date): React.ReactNode => { const dayStart = startOfDay(day);
  const record = attendanceRecordsFE.find(r => r.staff.id === staffId && isEqual(startOfDay(r.date), dayStart));
  let icon: React.ReactNode = null;
  let title = ""; if (!record) { if (isWeekend(day)) { title = "Weekend"; icon = <span className="block h-2 w-5 rounded-sm bg-gray-200" />; } else if (day.getTime() > new Date().setHours(23,59,59,999)) { title = "Future"; icon = <span className="block h-5 w-5" />; } else { title = "Not Recorded"; icon = <Info className="h-4 w-4 text-gray-400" />; } return <div className="flex justify-center items-center h-full" title={title}>{icon}</div>; } title = `View details for ${record.staff.name} on ${format(day, 'MMM d')}`; switch (record.status) { case 'present': icon = <CheckCircle className={`h-5 w-5 ${record.isWorkComplete ? 'text-green-500' : 'text-orange-400'}`} />; break; case 'incomplete': icon = <CheckCircle className="h-5 w-5 text-orange-400" />; break; case 'absent': icon = <XCircle className="h-5 w-5 text-red-500" />; break; case 'late': icon = <AlertTriangle className="h-5 w-5 text-yellow-500" />; break; case 'on_leave': icon = <Calendar className="h-5 w-5 text-blue-500" />; break; default: icon = <span className="block h-2 w-2 rounded-full bg-gray-300" />; } return <div className="flex justify-center items-center h-full cursor-pointer hover:bg-purple-100" title={title} onClick={() => handleCalendarCellClick(staffId, day)}>{icon}</div>; };
  const calculateFrontendWorkingMinutes = useCallback((attendance: AttendanceRecordTypeFE): number => { let totalMinutes = 0; if (attendance.checkIn && attendance.checkOut) { return attendance.totalWorkingMinutes; } else if (attendance.checkIn && !attendance.checkOut) { totalMinutes = differenceInMinutes(new Date(), attendance.checkIn); }
  let tempExitDeduction = 0; (attendance.temporaryExits || []).forEach(exit => { if (!exit.isOngoing && exit.endTime) { tempExitDeduction += exit.durationMinutes; } else if (exit.isOngoing) { tempExitDeduction += differenceInMinutes(new Date(), exit.startTime); } }); return Math.max(0, totalMinutes - tempExitDeduction); }, []);
  const handleCheckIn = async (staffId: string) => { try { await checkInStaff(staffId); } catch (err) { alert(`Check-in failed: ${err instanceof Error ? err.message : 'Unknown error'}`); } };
  const handleCheckOutAttempt = async (attendanceId: string, staffName: string) => { const attendance = attendanceRecordsFE.find(a => a.id === attendanceId); if (!attendance || attendance.checkOut) return; if (attendance.temporaryExits?.some(exit => exit.isOngoing)) { alert("Please end the ongoing temporary exit before checking out."); return; } 
  const estimatedMinutes = attendance.checkOut ? attendance.totalWorkingMinutes : calculateFrontendWorkingMinutes(attendance);
  const requiredMinutes = dailyRequiredHours * 60; if (estimatedMinutes < requiredMinutes) { setPendingCheckOutData({ attendanceId, staffName, requiredHours: dailyRequiredHours }); setShowConfirmModal(true); } else { await confirmCheckOut(attendanceId, dailyRequiredHours); } };
  const confirmCheckOut = async (attendanceId: string, requiredHours: number) => { try { await checkOutStaff(attendanceId, requiredHours); } catch (err) { alert(`Check-out failed: ${err instanceof Error ? err.message : 'Unknown error'}`); } finally { setPendingCheckOutData(null); setShowConfirmModal(false); } };
  const handleOpenTempExitModal = (attendanceId: string) => { const att = attendanceRecordsFE.find(a => a.id === attendanceId); if (!att || att.checkOut || (att.temporaryExits || []).some(e => e.isOngoing)) { alert("Cannot start temporary exit: Staff already checked out or an exit is ongoing."); return; } setSelectedAttendanceIdForTempExit(attendanceId); setShowTempExitModal(true); setTempExitReason(''); };
  const handleSubmitTempExit = async () => { if (!selectedAttendanceIdForTempExit || !tempExitReason.trim()) { alert("A reason is required to start a temporary exit."); return; } try { await startTemporaryExit(selectedAttendanceIdForTempExit, tempExitReason.trim()); } catch (err) { alert(`Starting temp exit failed: ${err instanceof Error ? err.message : 'Unknown error'}`); } finally { setShowTempExitModal(false); setTempExitReason(''); setSelectedAttendanceIdForTempExit(null); } };
  const handleEndTempExit = async (attendanceId: string, tempExitId: string) => { try { await endTemporaryExit(attendanceId, tempExitId); } catch (err) { alert(`Ending temp exit failed: ${err instanceof Error ? err.message : 'Unknown error'}`); } };
  const formatDuration = (minutes: number | null): string => { if (minutes === null || isNaN(minutes) || minutes < 0) return "0h 0m";
  const hours = Math.floor(minutes / 60); 
  const mins = Math.floor(minutes % 60); return `${hours}h ${mins}m`; };
  const getTodayAttendance = (staffIdToFind: string): AttendanceRecordTypeFE | undefined => { const todayStart = startOfDay(new Date()); return attendanceRecordsFE.find(record => record.staff.id === staffIdToFind && isEqual(startOfDay(record.date), todayStart) ); };
  
  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
      {errorAttendance && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert"><p>{errorAttendance}</p></div>}
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
        <div className="relative flex-1"><Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" /><input type="text" placeholder="Search staff name..." className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <div className="flex items-center gap-2">
            <label htmlFor="dailyHours" className="text-sm font-medium text-gray-700 whitespace-nowrap">Required Hours Today:</label>
            {/* *** MODIFICATION 3: Changed the input to be read-only and show a loading state. It now reflects the saved setting. */}
            <input 
                type="number" 
                id="dailyHours" 
                value={settingsLoading ? '...' : dailyRequiredHours} 
                readOnly 
                className="w-20 border-gray-300 rounded-md shadow-sm bg-gray-100 sm:text-sm px-3 py-2 text-gray-900" 
            />
        </div>
      </div>
      {(loadingAttendance || settingsLoading) && <div className="text-center py-10 text-gray-500"><p>Loading data...</p></div>}
      {!(loadingAttendance || settingsLoading) && (
        <>
        <Card title={`Today's Attendance (${format(new Date(), 'eeee, MMMM d')})`} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In/Out</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Working Time</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Required</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Temp Exits</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th></tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStaff.map((staff) => {
                  const todayAttendance = getTodayAttendance(staff.id); const workingMinutes = todayAttendance ? (todayAttendance.checkOut ? todayAttendance.totalWorkingMinutes : calculateFrontendWorkingMinutes(todayAttendance)) : 0; const actualRequiredMinutes = todayAttendance?.requiredMinutes || (dailyRequiredHours * 60); const remainingMinutes = Math.max(0, actualRequiredMinutes - workingMinutes); const ongoingTempExit = todayAttendance?.temporaryExits?.find(exit => exit.isOngoing);
                  return (
                    <tr key={staff.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap"><div className="flex items-center"><img src={staff.image || '/placeholder-avatar.png'} alt={staff.name} className="h-10 w-10 rounded-full object-cover" /><div className="ml-3"><div className="text-sm font-medium text-gray-900">{staff.name}</div><div className="text-sm text-gray-500">{staff.position}</div></div></div></td>
                      <td className="px-4 py-4 whitespace-nowrap">{todayAttendance ? <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${todayAttendance.isWorkComplete ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{todayAttendance.status.charAt(0).toUpperCase() + todayAttendance.status.slice(1).replace('_', ' ')}{!todayAttendance.isWorkComplete && ' (Inc.)'}</span> : <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Not Recorded</span>}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700"><div><Clock className="h-4 w-4 text-gray-400 mr-1 inline-block" /> In: {todayAttendance?.checkIn ? format(todayAttendance.checkIn, 'HH:mm') : '—'}</div><div><Clock className="h-4 w-4 text-gray-400 mr-1 inline-block" /> Out: {todayAttendance?.checkOut ? format(todayAttendance.checkOut, 'HH:mm') : '—'}</div></td>
                      <td className="px-4 py-4 whitespace-nowrap"><span className="text-sm text-gray-900">{formatDuration(workingMinutes)}</span></td>
                      <td className="px-4 py-4 whitespace-nowrap"><span className={`text-sm ${remainingMinutes > 0 && workingMinutes > 0 && !todayAttendance?.isWorkComplete ? 'text-red-600' : (todayAttendance?.isWorkComplete ? 'text-green-600' : 'text-gray-700')}`}>{todayAttendance?.isWorkComplete ? 'Completed' : (remainingMinutes > 0 && workingMinutes > 0 ? `${formatDuration(remainingMinutes)} rem.` : formatDuration(actualRequiredMinutes))}</span></td>
                      <td className="px-4 py-4 whitespace-nowrap">{todayAttendance?.temporaryExits && todayAttendance.temporaryExits.length > 0 && (<div className="space-y-1">{todayAttendance.temporaryExits.map((exit) => (<div key={exit.id} className="text-sm"><div className={`flex items-center space-x-1 ${exit.isOngoing ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}><span>{format(exit.startTime, 'HH:mm')} - {exit.endTime ? format(exit.endTime, 'HH:mm') : (exit.isOngoing ? 'Ongoing' : 'N/A')}</span>{!exit.isOngoing && exit.endTime && (<span className="text-purple-600">({formatDuration(exit.durationMinutes)})</span>)}</div>{exit.reason && <p className="text-xs text-gray-600 truncate max-w-[100px]" title={exit.reason}>{exit.reason}</p>}</div>))}</div>)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm">{!todayAttendance ? <Button size="sm" icon={<LogIn size={14} />} onClick={() => handleCheckIn(staff.id)}>Check In</Button> : <div className="flex flex-col sm:flex-row justify-end items-center space-y-1 sm:space-y-0 sm:space-x-1">{!todayAttendance.checkOut && (<>{ongoingTempExit ? <Button size="xs" variant="success" icon={<PauseCircle size={12} />} onClick={() => handleEndTempExit(todayAttendance.id, ongoingTempExit.id)}>End Exit</Button> : <Button size="xs" variant="outline" icon={<PlayCircle size={12} />} onClick={() => handleOpenTempExitModal(todayAttendance.id)} disabled={!!todayAttendance.checkOut}>Temp Exit</Button>}<Button size="xs" variant="secondary" icon={<LogOut size={12} />} onClick={() => handleCheckOutAttempt(todayAttendance.id, staff.name)} disabled={!!todayAttendance.checkOut || !!ongoingTempExit}>Check Out</Button></>)}{todayAttendance.checkOut && (<span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-semibold">Checked Out</span>)}</div>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="flex items-center justify-between mt-6 mb-2">
            <h2 className="text-xl font-semibold text-gray-800">Monthly Attendance Overview</h2>
            <div className="flex items-center space-x-2"><Button variant="outline" onClick={goToPreviousMonth}>{'< Prev'}</Button><span className="font-medium text-gray-700">{format(currentMonthDate, 'MMMM yyyy')}</span><Button variant="outline" onClick={goToNextMonth}>{'Next >'}</Button></div>
        </div>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto pb-2">
            <table className="min-w-full border-collapse">
              <thead className="bg-gray-100"><tr><th className="w-48 py-2 px-3 text-left text-xs font-medium text-gray-600 uppercase sticky left-0 bg-gray-100 z-10 border-r">Staff</th>{daysInMonth.map((day) => (<th key={format(day, 'd')} className={`w-10 text-center py-2 text-xs font-medium uppercase border-b ${isWeekend(day) ? 'text-gray-500 bg-gray-50' : isToday(day) ? 'text-purple-700 font-bold bg-purple-50' : 'text-gray-500'}`}><div>{format(day, 'd')}</div><div className="text-[10px] font-normal">{format(day, 'EEE').charAt(0)}</div></th>))}</tr></thead>
              <tbody className="bg-white">
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} className="border-b border-gray-200 last:border-b-0 group">
                    <td className="py-2 px-3 sticky left-0 bg-white group-hover:bg-gray-50 z-10 border-r"><div className="flex items-center"><img src={staff.image || '/placeholder-avatar.png'} alt={staff.name} className="h-8 w-8 rounded-full object-cover mr-2"/><div><p className="text-sm font-medium text-gray-800 whitespace-nowrap">{staff.name}</p></div></div></td>
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
      {showConfirmModal && pendingCheckOutData && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl"><div className="flex items-start"><div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10"><AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" /></div><div className="ml-3 text-left"><h3 className="text-lg font-semibold text-gray-900 mb-1">Incomplete Hours</h3><p className="text-sm text-gray-600 mb-4">Staff <span className="font-semibold">{pendingCheckOutData.staffName}</span> hasn't completed required hours ({formatDuration(pendingCheckOutData.requiredHours * 60)}). Checkout anyway?</p></div></div><div className="flex justify-end space-x-3 mt-4"><Button variant="outline" onClick={() => { setShowConfirmModal(false); setPendingCheckOutData(null); }}>Cancel</Button><Button variant="danger" onClick={() => {if (pendingCheckOutData) confirmCheckOut(pendingCheckOutData.attendanceId, pendingCheckOutData.requiredHours);}}>Check Out</Button></div></div></div>)}
      {showTempExitModal && selectedAttendanceIdForTempExit && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl"><h3 className="text-lg font-semibold text-gray-800 mb-4">Record Temporary Exit</h3><div className="space-y-4"><div><label htmlFor="tempExitReason" className="block text-sm font-medium text-gray-700 mb-1">Reason*</label><textarea id="tempExitReason" rows={3} className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm px-3 py-2 text-gray-900" value={tempExitReason} onChange={(e) => setTempExitReason(e.target.value)} placeholder="e.g., Lunch break, client meeting..." required /></div><div className="flex justify-end space-x-3 pt-2"><Button variant="outline" onClick={() => { setShowTempExitModal(false); setTempExitReason(''); setSelectedAttendanceIdForTempExit(null); }}>Cancel</Button><Button onClick={handleSubmitTempExit} disabled={!tempExitReason.trim()}>Start Exit</Button></div></div></div></div>)}
    </div>
  );
};
export default Attendance;