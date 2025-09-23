'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { Calendar, Clock, Search, CheckCircle, XCircle, AlertTriangle, LogOut, LogIn, Info, ChevronLeft, ChevronRight, Bed, X, Trash2, Target, UserCheck, ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useStaff } from '../../../../context/StaffContext';
import { AttendanceRecordTypeFE, StaffMember, TemporaryExitTypeFE } from '../../../../context/StaffContext';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isWeekend, differenceInMinutes, addMonths, subMonths, isEqual, startOfDay, endOfDay, parseISO, subDays, isValid } from 'date-fns';
import { useSession } from 'next-auth/react';
import { PERMISSIONS, hasPermission } from '../../../../lib/permissions';


// Helper function to get initials from a name
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

// Centralized helper function to format duration
const formatDuration = (minutes: number | null): string => {
    if (minutes === null || isNaN(minutes) || minutes < 0) return "0h 0m";
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
};

// Avatar component
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


// MODIFICATION START: ApplyWeekOffModal updated to prevent applying on days with activity.
const ApplyWeekOffModal: React.FC<{ staffMembers: StaffMember[]; attendanceRecords: AttendanceRecordTypeFE[]; onClose: () => void; onApply: (data: { staffIds: string[]; date: Date }) => Promise<void>; }> = ({ staffMembers, attendanceRecords, onClose, onApply }) => {
    const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [isApplying, setIsApplying] = useState(false);
    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true); }, []);

    // This map now tracks any staff member who is ineligible for a week off and why.
    const unavailableStaffMap = useMemo(() => {
        const map = new Map<string, 'week_off' | 'has_activity'>();
        if (!selectedDate || !isValid(parseISO(selectedDate))) return map;

        const selectedDateStart = startOfDay(parseISO(selectedDate));

        for (const record of attendanceRecords) {
            if (isEqual(startOfDay(record.date), selectedDateStart)) {
                // If a record has a check-in, they have activity and are unavailable.
                if (record.checkIn) {
                    map.set(record.staff.id, 'has_activity');
                } 
                // If they don't have activity but are already on a week off.
                else if (record.status === 'week_off' && !map.has(record.staff.id)) {
                    map.set(record.staff.id, 'week_off');
                }
            }
        }
        return map;
    }, [selectedDate, attendanceRecords]);
    
    // Available staff are those not present in the unavailable map.
    const availableStaff = useMemo(() => staffMembers.filter(s => !unavailableStaffMap.has(s.id)), [staffMembers, unavailableStaffMap]);
    
    const handleStaffSelection = (staffId: string) => { setSelectedStaffIds(prev => prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]); };
    const handleSelectAll = () => { if (selectedStaffIds.length === availableStaff.length) { setSelectedStaffIds([]); } else { setSelectedStaffIds(availableStaff.map(s => s.id)); } };

    const handleSubmit = async () => {
        if (selectedStaffIds.length === 0 || !selectedDate) {
            toast.warn("Please select at least one staff member and a date.");
            return;
        }
        setIsApplying(true);
        try {
            const date = parseISO(selectedDate);
            await onApply({ staffIds: selectedStaffIds, date });
            onClose();
        } catch (error) {
            // Error is handled in context
        } finally {
            setIsApplying(false);
        }
    };

    if (!isClient) return null;

    return createPortal(
        <div className="fixed top-0 left-0 w-screen h-screen bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden transform transition-all">
                <div className="p-6 flex justify-between items-center border-b"><h3 className="text-xl font-bold text-gray-800">Apply Week Off</h3><Button variant="ghost" size="sm" className="!p-2" onClick={onClose}><X className="h-5 w-5" /></Button></div>
                <div className="p-6 space-y-6">
                    <div><label htmlFor="weekoff-date" className="block text-sm font-medium text-gray-700 mb-2">Select Date</label><input id="weekoff-date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full form-input" /></div>
                    <div>
                        <div className="flex justify-between items-center mb-2"><label className="text-sm font-medium text-gray-700">Select Staff</label><button onClick={handleSelectAll} className="text-sm font-medium text-purple-600 hover:text-purple-800 disabled:text-gray-400" disabled={availableStaff.length === 0}>{selectedStaffIds.length === availableStaff.length ? 'Deselect All' : 'Select All'}</button></div>
                        <div className="max-h-60 overflow-y-auto border rounded-lg p-2 space-y-1">
                            {staffMembers.map(staff => {
                                const unavailabilityReason = unavailableStaffMap.get(staff.id);
                                const isUnavailable = !!unavailabilityReason;
                                
                                const getBadge = () => {
                                    if (unavailabilityReason === 'week_off') {
                                        return <span className="text-xs font-medium text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded-full">On Week Off</span>;
                                    }
                                    if (unavailabilityReason === 'has_activity') {
                                        return <span className="text-xs font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">Has Activity</span>;
                                    }
                                    return null;
                                };

                                return (
                                <div key={staff.id} className={`flex items-center p-2 rounded-md ${isUnavailable ? 'opacity-60 bg-gray-50' : 'hover:bg-gray-100'}`}>
                                    <input 
                                        type="checkbox" 
                                        id={`staff-${staff.id}`} 
                                        checked={selectedStaffIds.includes(staff.id)} 
                                        onChange={() => handleStaffSelection(staff.id)} 
                                        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:cursor-not-allowed" 
                                        disabled={isUnavailable} 
                                    />
                                    <label htmlFor={`staff-${staff.id}`} className={`ml-3 text-sm flex-1 ${isUnavailable ? 'text-gray-500 cursor-not-allowed' : 'text-gray-800 cursor-pointer'}`}>
                                        {staff.name}
                                    </label>
                                    {getBadge()}
                                </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3"><Button variant="outline-danger" onClick={onClose} disabled={isApplying}>Cancel</Button><Button onClick={handleSubmit} disabled={selectedStaffIds.length === 0 || !selectedDate || isApplying}>{isApplying ? 'Applying...' : 'Apply Week Off'}</Button></div>
            </div>
        </div>,
        document.body
    );
};
// MODIFICATION END

// Staff Attendance Report Component
const StaffAttendanceReport: React.FC<{
  staff: StaffMember;
  allRecords: AttendanceRecordTypeFE[];
  onBack: () => void;
  onSelectWeekOffToRemove: (record: AttendanceRecordTypeFE) => void;
  positionHoursMap: Map<string, number>;
  defaultDailyHours: number;
}> = ({ staff, allRecords, onBack, onSelectWeekOffToRemove, positionHoursMap, defaultDailyHours }) => {
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

    const { enrichedRecords, summaryStats } = useMemo(() => {
        const start = startOfDay(parseISO(startDate));
        const end = endOfDay(parseISO(endDate));
        let totalWorkingMinutes = 0, presentDays = 0, absentDays = 0, onLeaveDays = 0, weekOffDays = 0, totalOvertimeMinutes = 0;
        
        if (!isValid(start) || !isValid(end)) {
            return { enrichedRecords: [], summaryStats: { totalWorkingMinutes, presentDays, absentDays, onLeaveDays, weekOffDays, totalOvertimeMinutes } };
        }

        const recordsMap = new Map(allRecords.filter(record => record.staff.id === staff.id).map(record => [format(record.date, 'yyyy-MM-dd'), record]));
        const today = startOfDay(new Date());
        const allDaysInRange = eachDayOfInterval({ start, end });
        
        const recordsWithAbsences = allDaysInRange.map(day => {
            const dateString = format(day, 'yyyy-MM-dd');
            const record = recordsMap.get(dateString);
            if (record) return record;
            if (day < today && !isWeekend(day)) {
                return { id: `absent-${dateString}-${staff.id}`, date: day, status: 'absent', staff, requiredMinutes: defaultDailyHours * 60, totalWorkingMinutes: 0, checkIn: null, checkOut: null, isWorkComplete: false, temporaryExits: [] } as AttendanceRecordTypeFE;
            }
            return null;
        }).filter((record): record is AttendanceRecordTypeFE => record !== null);

        recordsWithAbsences.forEach(record => {
            totalWorkingMinutes += record.totalWorkingMinutes || 0;
            if (record.totalWorkingMinutes && record.requiredMinutes) { totalOvertimeMinutes += Math.max(0, record.totalWorkingMinutes - record.requiredMinutes); }
            switch (record.status) {
                case 'present': case 'late': case 'incomplete': presentDays++; break;
                case 'on_leave': onLeaveDays++; break;
                case 'absent': absentDays++; break;
                case 'week_off': weekOffDays++; break;
            }
        });

        const sortedRecords = recordsWithAbsences.sort((a, b) => b.date.getTime() - a.date.getTime());
        return { enrichedRecords: sortedRecords, summaryStats: { totalWorkingMinutes, presentDays, absentDays, onLeaveDays, weekOffDays, totalOvertimeMinutes } };
    }, [allRecords, staff, startDate, endDate, defaultDailyHours]);

    const { requiredMinutesForRange, achievementPercentage } = useMemo(() => {
        const monthlyRequiredHours = positionHoursMap.get(staff.position ?? '');
        let totalRequiredMinutes = 0;
        if (monthlyRequiredHours && monthlyRequiredHours > 0) {
            totalRequiredMinutes = monthlyRequiredHours * 60;
        } else {
            const start = parseISO(startDate);
            const end = parseISO(endDate);
            if (isValid(start) && isValid(end) && end >= start) {
                const workingDaysInRangeCount = eachDayOfInterval({ start, end }).filter(day => !isWeekend(day)).length;
                totalRequiredMinutes = workingDaysInRangeCount * defaultDailyHours * 60;
            }
        }
        const totalAchievedMinutes = summaryStats.totalWorkingMinutes;
        const percentage = totalRequiredMinutes > 0 ? Math.min(100, (totalAchievedMinutes / totalRequiredMinutes) * 100) : 0;
        return { requiredMinutesForRange: totalRequiredMinutes, achievementPercentage: percentage };
    }, [startDate, endDate, staff.position, positionHoursMap, defaultDailyHours, summaryStats.totalWorkingMinutes]);
    
    const handleDownloadPdf = () => {
        const doc = new jsPDF();
        const tableData = enrichedRecords.map(record => {
            const tempExitDuration = record.temporaryExits?.reduce((sum, exit) => sum + (exit.durationMinutes || 0), 0) || 0;
            const overtimeMinutes = Math.max(0, (record.totalWorkingMinutes || 0) - (record.requiredMinutes || 0));
            return [
                format(record.date, 'eee, dd MMM yyyy'),
                record.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                `${record.checkIn ? format(record.checkIn, 'HH:mm') : 'N/A'} - ${record.checkOut ? format(record.checkOut, 'HH:mm') : 'N/A'}`,
                formatDuration(record.totalWorkingMinutes),
                formatDuration(record.requiredMinutes),
                formatDuration(tempExitDuration),
                formatDuration(overtimeMinutes)
            ];
        });

        doc.setFontSize(18);
        doc.text('Attendance Report', 14, 22);
        doc.setFontSize(11);
        doc.text(`Staff: ${staff.name} (${staff.position})`, 14, 30);
        doc.text(`Date Range: ${startDate} to ${endDate}`, 14, 36);
        const summaryText = `Present: ${summaryStats.presentDays} | Absent: ${summaryStats.absentDays} | On Leave: ${summaryStats.onLeaveDays} | OT: ${formatDuration(summaryStats.totalOvertimeMinutes)}`;
        doc.setFontSize(10);
        doc.text(summaryText, 14, 44);

        autoTable(doc, {
            startY: 50,
            head: [['Date', 'Status', 'Timings', 'Working Time', 'Required', 'Temp Exits', 'OT']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [63, 63, 70] },
        });

        doc.save(`Attendance_Report_${staff.name.replace(' ', '_')}_${startDate}_to_${endDate}.pdf`);
        toast.success("PDF download started!");
    };

    const handleDownloadExcel = () => {
        // Data for the main attendance log table
        const dataForSheet = enrichedRecords.map(record => {
            const tempExitDuration = record.temporaryExits?.reduce((sum, exit) => sum + (exit.durationMinutes || 0), 0) || 0;
            const overtimeMinutes = Math.max(0, (record.totalWorkingMinutes || 0) - (record.requiredMinutes || 0));
            return {
                'Date': format(record.date, 'yyyy-MM-dd'),
                'Day': format(record.date, 'eeee'),
                'Status': record.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                'Check In': record.checkIn ? format(record.checkIn, 'HH:mm') : 'N/A',
                'Check Out': record.checkOut ? format(record.checkOut, 'HH:mm') : 'N/A',
                'Working Time (h:m)': formatDuration(record.totalWorkingMinutes),
                'Required Time (h:m)': formatDuration(record.requiredMinutes),
                'Temporary Exits (h:m)': formatDuration(tempExitDuration),
                'Overtime (h:m)': formatDuration(overtimeMinutes)
            };
        });

        // Data for the summary section, formatted as an array of arrays
        const summaryRows = [
            ['Attendance Report'],
            ['Staff Name', staff.name],
            ['Position', staff.position],
            ['Date Range', `${startDate} to ${endDate}`],
            [], // Spacer row
            ['Summary'],
            ['Present Days', summaryStats.presentDays],
            ['Absent Days', summaryStats.absentDays],
            ['On Leave', summaryStats.onLeaveDays],
            ['Week Offs', summaryStats.weekOffDays],
            ['Total Working Time', formatDuration(summaryStats.totalWorkingMinutes)],
            ['Total Overtime', formatDuration(summaryStats.totalOvertimeMinutes)],
        ];

        // 1. Create a worksheet from the summary data array first.
        const ws = XLSX.utils.aoa_to_sheet(summaryRows);

        // 2. Add the main data table below the summary.
        XLSX.utils.sheet_add_json(ws, dataForSheet, {
            origin: 'A14', // Start after the summary section + a couple of empty rows
            skipHeader: false
        });

        // Define column widths for better readability
        ws['!cols'] = [ { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 18 } ];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance Log');
        XLSX.writeFile(wb, `Attendance_Report_${staff.name.replace(' ', '_')}_${startDate}_to_${endDate}.xlsx`);
        toast.success("Excel download started!");
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className='flex items-center gap-4'>
                    <Button variant="outline" onClick={onBack} className="!p-2 rounded-full"><ArrowLeft size={18} /></Button>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Attendance Report</h1>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="secondary" icon={<Download size={16}/>} onClick={handleDownloadPdf}>Download PDF</Button>
                    <Button variant="secondary" icon={<FileSpreadsheet size={16}/>} onClick={handleDownloadExcel}>Download Excel</Button>
                </div>
            </div>
            <div className='bg-white p-4 sm:p-6 rounded-xl shadow-sm border'>
                 <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'><div className="flex items-center"><Avatar src={staff.image} name={staff.name} className="h-16 w-16" /><div className="ml-4"><h2 className="text-xl font-bold text-gray-900">{staff.name}</h2><p className="text-sm text-gray-500">{staff.position}</p></div></div><div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full sm:w-auto form-input" /><span className="text-gray-500 hidden sm:block">-</span><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full sm:w-auto form-input"/></div></div>
                <div className="mt-6 border-t pt-4"><h4 className="text-base font-semibold text-gray-800 mb-3 flex items-center"><Target className="h-5 w-5 mr-2 text-purple-600"/>Hours Target for Selected Range</h4><div className="space-y-2"><div className="flex justify-between items-baseline"><span className="text-sm font-medium text-gray-600">Achieved: <span className="text-lg font-bold text-black">{formatDuration(summaryStats.totalWorkingMinutes)}</span></span><span className="text-sm font-medium text-gray-500">Required: <span className="text-lg font-bold text-gray-800">{formatDuration(requiredMinutesForRange)}</span></span></div><div className="w-full bg-gray-200 rounded-full h-3"><div className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full" style={{ width: `${achievementPercentage}%` }} title={`${achievementPercentage.toFixed(1)}% Complete`}></div></div></div></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"><div className="bg-green-100 p-4 rounded-lg text-center border border-green-200"><p className="text-sm text-green-700 font-medium">Present Days</p><p className="text-3xl font-bold text-green-800">{summaryStats.presentDays}</p></div><div className="bg-red-100 p-4 rounded-lg text-center border border-red-200"><p className="text-sm text-red-700 font-medium">Absent</p><p className="text-3xl font-bold text-red-800">{summaryStats.absentDays}</p></div><div className="bg-blue-100 p-4 rounded-lg text-center border border-blue-200"><p className="text-sm text-blue-700 font-medium">On Leave</p><p className="text-3xl font-bold text-blue-800">{summaryStats.onLeaveDays}</p></div><div className="bg-purple-100 p-4 rounded-lg text-center border border-purple-200"><p className="text-sm text-purple-700 font-medium">OT Hours</p><p className="text-3xl font-bold text-purple-800">{Math.floor(summaryStats.totalOvertimeMinutes / 60)}</p></div><div className="bg-cyan-100 p-4 rounded-lg text-center border border-cyan-200"><p className="text-sm text-cyan-700 font-medium">Week Offs</p><p className="text-3xl font-bold text-cyan-800">{summaryStats.weekOffDays}</p></div></div>
            <Card title={`Attendance Log (${enrichedRecords.length} records found)`} className="!p-0 overflow-hidden shadow-lg rounded-xl border"><div className="overflow-x-auto"><table className="min-w-full"><thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Timings</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Working Time</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Required</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Temp Exits</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">OT</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{enrichedRecords.map(record => { const tempExitDuration = record.temporaryExits?.reduce((sum, exit) => sum + (exit.durationMinutes || 0), 0) || 0; const overtimeMinutes = Math.max(0, (record.totalWorkingMinutes || 0) - record.requiredMinutes); const isWeekOff = record.status === 'week_off'; return (<tr key={record.id}><td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{format(record.date, 'eee, dd MMM')}</td><td className="px-4 py-4 whitespace-nowrap text-sm" onClick={() => isWeekOff && onSelectWeekOffToRemove(record)} title={isWeekOff ? 'Click to remove week off' : ''}><span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${isWeekOff ? 'bg-cyan-100 text-cyan-800 cursor-pointer hover:bg-red-100 hover:text-red-800' : record.status === 'absent' ? 'bg-red-100 text-red-800' : record.isWorkComplete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{record.status.replace('_', ' ')}</span></td><td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{record.checkIn ? format(record.checkIn, 'HH:mm') : 'N/A'} - {record.checkOut ? format(record.checkOut, 'HH:mm') : 'N/A'}</td><td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{formatDuration(record.totalWorkingMinutes)}</td><td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{formatDuration(record.requiredMinutes)}</td><td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{formatDuration(tempExitDuration)}</td><td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-purple-700">{formatDuration(overtimeMinutes)}</td></tr>)})} {enrichedRecords.length === 0 && (<tr><td colSpan={7} className="text-center py-10 text-gray-500">No records found for this date range.</td></tr>)}</tbody></table></div></Card>
        </div>
    );
};


// Attendance Action Modal
type StaffMemberWithId = StaffMember & { staffIdNumber?: string };
const AttendanceActionModal: React.FC<{
    isOpen: boolean; onClose: () => void; activeStaffMembers: StaffMember[]; getTodayAttendance: (staffId: string) => AttendanceRecordTypeFE | undefined;
    handleCheckIn: (staff: StaffMember) => Promise<void>; handleCheckOutAttempt: (attendanceId: string, staffId: string, staffName: string) => Promise<void>;
    handleStartTempExit: (attendanceId: string) => Promise<void>; handleEndTempExit: (attendanceId: string, tempExitId: string) => Promise<void>;
}> = ({ isOpen, onClose, activeStaffMembers, getTodayAttendance, handleCheckIn, handleCheckOutAttempt, handleStartTempExit, handleEndTempExit }) => {
    const [staffIdInput, setStaffIdInput] = useState(''); const [scannedStaffInfo, setScannedStaffInfo] = useState<{ staff: StaffMemberWithId; attendance: AttendanceRecordTypeFE | undefined } | null>(null); const [isLoading, setIsLoading] = useState(false);
    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true); }, []);
    useEffect(() => { if (!isOpen) { setTimeout(() => { setStaffIdInput(''); setScannedStaffInfo(null); setIsLoading(false); }, 300); } }, [isOpen]);
    const handleFindStaff = (e?: React.FormEvent) => { e?.preventDefault(); if (!staffIdInput.trim()) { toast.warn('Please enter a Staff ID.'); return; } const foundStaff = activeStaffMembers.find(s => (s as StaffMemberWithId).staffIdNumber?.toLowerCase() === staffIdInput.trim().toLowerCase()) as StaffMemberWithId | undefined; if (foundStaff) { setScannedStaffInfo({ staff: foundStaff, attendance: getTodayAttendance(foundStaff.id) }); } else { toast.error('Staff member with this ID not found.'); setScannedStaffInfo(null); } };
    const executeCheckInOut = async () => { if (!scannedStaffInfo) return; setIsLoading(true); const { staff, attendance } = scannedStaffInfo; try { if (attendance?.checkIn && !attendance.checkOut) { await handleCheckOutAttempt(attendance.id, staff.id, staff.name); } else { await handleCheckIn(staff); } onClose(); } catch (error) { setIsLoading(false); } };
    const handleGoBack = () => { setScannedStaffInfo(null); setStaffIdInput(''); };
    const attendance = scannedStaffInfo?.attendance; const ongoingTempExit = attendance?.temporaryExits?.find(e => e.isOngoing);
    const executeTempAction = async () => { if (!attendance) return; setIsLoading(true); try { if (ongoingTempExit) { await handleEndTempExit(attendance.id, ongoingTempExit.id); } else { await handleStartTempExit(attendance.id); } onClose(); } catch (error) { setIsLoading(false); } };
    const handleNumericInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const numericValue = e.target.value.replace(/[^0-9]/g, ''); setStaffIdInput(numericValue); };
    
    if (!isOpen || !isClient) return null;

    return createPortal(
      <div className="fixed top-0 left-0 w-screen h-screen bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl transform transition-all">
            {!scannedStaffInfo ? (
                <>
                    <div className="p-6 border-b flex justify-between items-center"><h3 className="text-xl font-bold text-gray-800">Mark Attendance</h3><Button variant="ghost" size="sm" className="!p-2" onClick={onClose}><X className="h-5 w-5" /></Button></div>
                    <form onSubmit={handleFindStaff}>
                        <div className="p-6 space-y-4">
                            <label htmlFor="staff-id-input" className="block text-sm font-medium text-gray-700">Enter Staff ID</label>
                            <input id="staff-id-input" type="tel" inputMode="numeric" value={staffIdInput} onChange={handleNumericInputChange} className="w-full form-input" placeholder="e.g., 12345" autoFocus />
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3"><Button type="button" variant="outline-danger" onClick={onClose}>Cancel</Button><Button type="submit">Find Staff</Button></div>
                    </form>
                </>
            ) : (
                <>
                    <div className="p-6 border-b"><h3 className="text-xl font-bold text-gray-800">Confirm Action</h3></div>
                    <div className="p-6 text-center">
                        <Avatar src={scannedStaffInfo.staff.image} name={scannedStaffInfo.staff.name} className="h-20 w-20 mx-auto" />
                        <p className="mt-4 text-lg font-bold text-gray-900">{scannedStaffInfo.staff.name}</p>
                        <p className="text-sm text-gray-500">{scannedStaffInfo.staff.position}</p>
                        {attendance?.status === 'week_off' ? (
                            <div className="mt-4 p-3 bg-cyan-100 text-cyan-800 rounded-lg text-sm font-semibold">Staff is on Week Off today.</div>
                        ) : attendance?.checkOut ? (
                            <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-lg text-sm font-semibold">Checked out at {format(attendance.checkOut, 'HH:mm')}.</div>
                        ) : (
                            <div className="mt-6 grid grid-cols-1 gap-3">
                                <Button onClick={executeCheckInOut} disabled={isLoading || !!ongoingTempExit} variant={attendance?.checkIn ? 'danger' : 'success'} icon={attendance?.checkIn ? <LogOut size={16}/> : <LogIn size={16}/>}>{isLoading ? 'Processing...' : (attendance?.checkIn ? 'Check Out' : 'Check In')}</Button>
                                {attendance?.checkIn && (<Button onClick={executeTempAction} disabled={isLoading} variant={ongoingTempExit ? 'success' : 'outline'} icon={ongoingTempExit ? <LogIn size={16}/> : <LogOut size={16}/>}>{isLoading ? 'Processing...' : (ongoingTempExit ? 'Temp In' : 'Temp Out')}</Button>)}
                            </div>
                        )}
                        {!!ongoingTempExit && <p className="text-xs text-red-600 mt-2">Must "Temp In" before checking out.</p>}
                    </div>
                    <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3"><Button variant="secondary" onClick={handleGoBack}>Back</Button><Button variant="outline-danger" onClick={onClose}>Cancel</Button></div>
                </>
            )}
        </div>
      </div>,
      document.body
    );
};

interface ConfirmationModalProps {
  isOpen: boolean;
  onGoBack: () => void;
  onConfirm: () => void;
  staffName?: string;
  requiredHours?: number;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onGoBack, onConfirm, staffName, requiredHours }) => {
    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true); }, []);
    if (!isOpen || !isClient || !staffName) return null;
    return createPortal(
        <div className="fixed top-0 left-0 w-screen h-screen bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100"><AlertTriangle className="h-8 w-8 text-red-600" aria-hidden="true" /></div>
                <h3 className="text-xl font-bold text-gray-900 mt-5">Incomplete Hours</h3>
                <p className="text-sm text-gray-500 mt-2">Staff <span className="font-semibold">{staffName}</span> hasn't completed required hours ({formatDuration((requiredHours || 0) * 60)}). Checkout anyway?</p>
                <div className="flex justify-center space-x-4 mt-8"><Button variant="secondary" onClick={onGoBack}>Go Back</Button><Button variant="danger" onClick={onConfirm}>Check Out</Button></div>
            </div>
        </div>,
        document.body
    );
};

interface RemoveWeekOffModalProps {
  weekOffRecord: AttendanceRecordTypeFE | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const RemoveWeekOffModal: React.FC<RemoveWeekOffModalProps> = ({ weekOffRecord, onCancel, onConfirm }) => {
    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true); }, []);
    if (!weekOffRecord || !isClient) return null;
    return createPortal(
        <div className="fixed top-0 left-0 w-screen h-screen bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-orange-100"><AlertTriangle className="h-8 w-8 text-orange-600" aria-hidden="true" /></div>
                <h3 className="text-xl font-bold text-gray-900 mt-5">Remove Week Off</h3>
                <p className="text-sm text-gray-500 mt-2">Are you sure you want to remove the week off for <span className="font-semibold">{weekOffRecord.staff.name}</span> on <span className="font-semibold">{format(weekOffRecord.date, 'MMMM d, yyyy')}</span>?</p>
                <div className="flex justify-center space-x-4 mt-8"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button variant="danger" icon={<Trash2 size={16}/>} onClick={onConfirm}>Remove Week Off</Button></div>
            </div>
        </div>,
        document.body
    );
};


// Main Attendance Component
const Attendance: React.FC = () => {
  const { data: session } = useSession();
  const userPermissions = useMemo(() => session?.user?.role?.permissions || [], [session]);
  const canManageAttendance = useMemo(() => hasPermission(userPermissions, PERMISSIONS.STAFF_ATTENDANCE_MANAGE), [userPermissions]);
  const { staffMembers, loadingStaff, attendanceRecordsFE, loadingAttendance, errorAttendance, fetchAttendanceRecords, checkInStaff, checkOutStaff, startTemporaryExit, endTemporaryExit, applyWeekOff, removeWeekOff } = useStaff();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dailyRequiredHours, setDailyRequiredHours] = useState(9); 
  const [positionHoursMap, setPositionHoursMap] = useState<Map<string, number>>(new Map());
  const [settingsLoading, setSettingsLoading] = useState(true); 
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [showWeekOffModal, setShowWeekOffModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingCheckOutData, setPendingCheckOutData] = useState<{ attendanceId: string; staffName: string; requiredHours: number } | null>(null);
  const [weekOffToRemove, setWeekOffToRemove] = useState<AttendanceRecordTypeFE | null>(null);
  const [viewingStaffDetails, setViewingStaffDetails] = useState<StaffMember | null>(null);

  useEffect(() => {
    const fetchInitialRecords = () => {
        const today = new Date();
        const threeMonthsAgo = startOfMonth(subMonths(today, 2));
        let currentMonth = threeMonthsAgo;
        while (currentMonth <= today) {
            fetchAttendanceRecords({ year: currentMonth.getFullYear(), month: currentMonth.getMonth() + 1 });
            currentMonth = addMonths(currentMonth, 1);
        }
    };
    fetchInitialRecords();
  }, [fetchAttendanceRecords]);
  
  useEffect(() => {
      const fetchAllSettings = async () => {
        if (!session?.user?.tenantId) return; 
        setSettingsLoading(true);
        const headers = new Headers({ 'Content-Type': 'application/json', 'x-tenant-id': session.user.tenantId });
        try {
          const [shopSettingsResponse, positionHoursResponse] = await Promise.all([ fetch('/api/settings', { headers }), fetch('/api/settings/position-hours', { headers }) ]);
          const shopSettingsResult = await shopSettingsResponse.json();
          if (shopSettingsResult.success && shopSettingsResult.data?.settings) { setDailyRequiredHours(shopSettingsResult.data.settings.defaultDailyHours); } 
          else { throw new Error(shopSettingsResult.error || "Failed to fetch default settings."); }
          const positionHoursResult = await positionHoursResponse.json();
          if (positionHoursResult.success && Array.isArray(positionHoursResult.data)) {
              const map = new Map<string, number>();
              positionHoursResult.data.forEach((setting: { positionName: string, requiredHours: number }) => { map.set(setting.positionName, setting.requiredHours); });
              setPositionHoursMap(map);
          } else if (!positionHoursResult.success) { console.warn("Could not load position-specific hour settings:", positionHoursResult.error); }
        } catch (error) { console.error("Error fetching settings:", error); toast.error(error instanceof Error ? error.message : "Could not load required hour settings.");
        } finally { setSettingsLoading(false); }
      };
      fetchAllSettings();
  }, [session]);
  
  const todayAttendanceMap = useMemo(() => { const map = new Map<string, AttendanceRecordTypeFE>(); const todayStart = startOfDay(new Date()); for (const record of attendanceRecordsFE) { if (isEqual(startOfDay(record.date), todayStart)) { map.set(record.staff.id, record); } } return map; }, [attendanceRecordsFE]);
  const activeStaffMembers = useMemo(() => staffMembers.filter((staff: StaffMember) => staff.status === 'active'), [staffMembers]);
  const filteredStaff = useMemo(() => { if (!searchTerm) { return activeStaffMembers; } const lowercasedFilter = searchTerm.toLowerCase(); return activeStaffMembers.filter((staff: any) => staff.name.toLowerCase().includes(lowercasedFilter) || (staff.staffIdNumber && staff.staffIdNumber.includes(lowercasedFilter))); }, [activeStaffMembers, searchTerm]);
  const calculateFrontendWorkingMinutes = useCallback((attendance: AttendanceRecordTypeFE): number => { let totalMinutes = 0; if (attendance.checkIn && attendance.checkOut) { return attendance.totalWorkingMinutes; } else if (attendance.checkIn && !attendance.checkOut) { totalMinutes = differenceInMinutes(new Date(), attendance.checkIn); } let tempExitDeduction = 0; (attendance.temporaryExits || []).forEach((exit: TemporaryExitTypeFE) => { if (!exit.isOngoing && exit.endTime) { tempExitDeduction += exit.durationMinutes; } else if (exit.isOngoing) { tempExitDeduction += differenceInMinutes(new Date(), exit.startTime); } }); return Math.max(0, totalMinutes - tempExitDeduction); }, []);
  const getTodayAttendance = (staffIdToFind: string): AttendanceRecordTypeFE | undefined => { return todayAttendanceMap.get(staffIdToFind); };
  const handleCheckIn = async (staff: StaffMember) => { try { await checkInStaff(staff.id, dailyRequiredHours); toast.success('Successfully checked in!'); } catch (err) { toast.error(err instanceof Error ? err.message : 'Check-in failed'); } };
  const handleCheckOutAttempt = async (attendanceId: string, staffId: string, staffName: string) => { const attendance = todayAttendanceMap.get(staffId); if (!attendance || attendance.checkOut) return; if (attendance.temporaryExits?.some(exit => exit.isOngoing)) { toast.error("Please end the ongoing temporary exit before checking out."); return; } const estimatedMinutes = calculateFrontendWorkingMinutes(attendance); const requiredMinutes = attendance.requiredMinutes || (dailyRequiredHours * 60); if (estimatedMinutes < requiredMinutes) { setPendingCheckOutData({ attendanceId, staffName, requiredHours: requiredMinutes / 60 }); setShowConfirmModal(true); } else { await confirmCheckOut(attendanceId, requiredMinutes / 60); } };
  const confirmCheckOut = async (attendanceId: string, requiredHours: number) => { try { await checkOutStaff(attendanceId, requiredHours); toast.success('Successfully checked out!'); } catch (err) { toast.error(err instanceof Error ? err.message : 'Check-out failed'); } finally { setPendingCheckOutData(null); setShowConfirmModal(false); } };
  const handleStartTempExit = async (attendanceId: string) => { try { await startTemporaryExit(attendanceId, ''); toast.success('Temporary exit started.'); } catch (err) { toast.error(err instanceof Error ? err.message : 'Starting temp exit failed'); } };
  const handleEndTempExit = async (attendanceId: string, tempExitId: string) => { try { await endTemporaryExit(attendanceId, tempExitId); toast.success('Temporary exit ended.'); } catch (err) { toast.error(err instanceof Error ? err.message : 'Ending temp exit failed'); } };
  const handleConfirmRemoveWeekOff = async () => { if (!weekOffToRemove) return; try { await removeWeekOff(weekOffToRemove.id); toast.success(`Week off for ${weekOffToRemove.staff.name} has been removed.`); } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to remove week off."); } finally { setWeekOffToRemove(null); } };

  // Main screen renderer
  if (viewingStaffDetails) {
    return (
      <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
          <StaffAttendanceReport staff={viewingStaffDetails} allRecords={attendanceRecordsFE} onBack={() => setViewingStaffDetails(null)} onSelectWeekOffToRemove={setWeekOffToRemove} positionHoursMap={positionHoursMap} defaultDailyHours={dailyRequiredHours}/>
           <RemoveWeekOffModal
              weekOffRecord={weekOffToRemove}
              onCancel={() => setWeekOffToRemove(null)}
              onConfirm={handleConfirmRemoveWeekOff}
           />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Attendance Management</h1>
          <p className="text-slate-500 mt-1">Track and manage staff attendance, leaves, and work hours.</p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-3">
          {canManageAttendance && (<Button onClick={() => setIsAttendanceModalOpen(true)} icon={<UserCheck size={16}/>}>Mark Attendance</Button>)}
          {canManageAttendance && (<Button variant="outline" onClick={() => setShowWeekOffModal(true)}>Apply Week Off</Button>)}
        </div>
      </div>

      {errorAttendance && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-r-lg" role="alert"><p>{errorAttendance}</p></div>}
      
      <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Search by staff name or ID..." className="pl-12 pr-4 py-2.5 w-full form-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
            <label htmlFor="dailyHours" className="text-sm font-medium text-gray-700 whitespace-nowrap">Default Daily Hours:</label>
            <input 
                type="number" 
                id="dailyHours" 
                value={settingsLoading ? '...' : dailyRequiredHours} 
                readOnly 
                className="w-20 border-gray-300 rounded-lg shadow-sm bg-gray-100 text-sm px-3 py-2 text-gray-900 font-semibold" 
            />
        </div>
      </div>

      {(loadingAttendance || settingsLoading || loadingStaff) && (
        <div className="text-center py-20 text-gray-500 flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <p>Loading Attendance Data...</p>
        </div>
      )}
      
      {!(loadingAttendance || settingsLoading || loadingStaff) && (
        <Card title={`Today's Attendance (${format(new Date(), 'eeee, MMMM d')})`} className="!p-0 overflow-hidden shadow-lg rounded-2xl border">
          <div className="overflow-x-auto">
            <table className="min-w-full w-full block lg:table">
              <thead className="hidden lg:table-header-group bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[25%]">Staff Member</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[10%]">Staff ID</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[15%]">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[15%]">Timings</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[12%]">Working Time</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[12%]">Required</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[15%]">Temporary Exits</th>
                </tr>
              </thead>
              <tbody className="block lg:table-row-group bg-white lg:divide-y lg:divide-gray-200">
                {filteredStaff.map((staff) => { 
                  const todayAttendance = getTodayAttendance(staff.id); 
                  const workingMinutes = todayAttendance ? (todayAttendance.checkOut ? todayAttendance.totalWorkingMinutes : calculateFrontendWorkingMinutes(todayAttendance)) : 0;
                  const requiredMinutesForStaff = todayAttendance?.requiredMinutes || (dailyRequiredHours * 60);
                  const remainingMinutes = Math.max(0, requiredMinutesForStaff - workingMinutes);
                  const staffWithId = staff as StaffMemberWithId;
                  const mobileCellStyle = "block lg:table-cell py-2 px-4 lg:py-4 lg:px-6 text-sm text-right lg:text-left before:content-[attr(data-label)] before:font-bold before:float-left lg:before:content-none";
                  const requiredCellStyle = `${mobileCellStyle} ${remainingMinutes > 0 && workingMinutes > 0 && !todayAttendance?.isWorkComplete ? 'text-red-600' : (todayAttendance?.isWorkComplete ? 'text-green-600' : 'text-gray-700')}`;

                  return (
                    <tr key={staff.id} className="block lg:table-row mb-4 lg:mb-0 border lg:border-none rounded-lg shadow-md lg:shadow-none bg-white hover:bg-slate-50 transition-colors duration-200">
                        <td className="p-4 lg:py-4 lg:px-6 whitespace-nowrap block lg:table-cell border-b lg:border-none">
                            <div className="flex items-center">
                                <Avatar src={staff.image} name={staff.name} className="h-11 w-11" />
                                <div className="ml-4">
                                    <div className="text-base font-bold text-gray-900 truncate cursor-pointer hover:text-purple-700 hover:underline" onClick={() => setViewingStaffDetails(staff)} title={`View attendance report for ${staff.name}`}>{staff.name}</div>
                                    <div className="text-xs text-gray-500">{staff.position}</div>
                                </div>
                            </div>
                        </td>
                        <td data-label="Staff ID:" className={`${mobileCellStyle} text-gray-600 font-mono`}>{staffWithId.staffIdNumber || 'N/A'}</td>
                        <td data-label="Status:" className={mobileCellStyle}>
                            {todayAttendance ? (
                                (todayAttendance.status === 'week_off' && !todayAttendance.checkOut) ? 
                                <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md bg-cyan-100 text-cyan-800">Week Off</span> : 
                                <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md ${todayAttendance.isWorkComplete ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                    {(todayAttendance.status === 'week_off' ? 'Present' : todayAttendance.status).charAt(0).toUpperCase() + (todayAttendance.status === 'week_off' ? 'present' : todayAttendance.status).slice(1).replace('_', ' ')}
                                    {!todayAttendance.isWorkComplete && ' (Incomplete)'}
                                </span>
                            ) : 
                            <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md bg-gray-100 text-gray-800">Not Recorded</span>
                            }
                        </td>
                        <td data-label="Timings:" className={`${mobileCellStyle} text-gray-700 font-mono`}>
                            <div className="flex items-center justify-end lg:justify-start">
                                <LogIn className="h-4 w-4 text-green-500 mr-1.5 inline-block" /> {todayAttendance?.checkIn ? format(todayAttendance.checkIn, 'HH:mm') : '—'}
                            </div>
                            <div className="flex items-center justify-end lg:justify-start mt-1 lg:mt-0">
                                <LogOut className="h-4 w-4 text-red-500 mr-1.5 inline-block" /> {todayAttendance?.checkOut ? format(todayAttendance.checkOut, 'HH:mm') : '—'}
                            </div>
                        </td>
                        <td data-label="Working:" className={`${mobileCellStyle} font-semibold text-gray-900`}>{formatDuration(workingMinutes)}</td>
                        <td data-label="Required:" className={requiredCellStyle}>
                            {todayAttendance?.isWorkComplete ? 
                                <span className="flex items-center justify-end lg:justify-start text-green-600 font-semibold"><CheckCircle size={16} className="mr-1.5"/>Completed</span> : 
                                (remainingMinutes > 0 && workingMinutes > 0 ? `${formatDuration(remainingMinutes)} remaining` : formatDuration(requiredMinutesForStaff))
                            }
                        </td>
                        <td data-label="Temp Exits:" className={mobileCellStyle}>
                            {todayAttendance?.temporaryExits && todayAttendance.temporaryExits.length > 0 ? (
                                <div className="space-y-1.5 text-right lg:text-left">
                                    {todayAttendance.temporaryExits.map((exit: TemporaryExitTypeFE) => (
                                        <div key={exit.id} className="text-xs" title={exit.reason ?? undefined}>
                                            <div className={`flex items-center justify-end lg:justify-start space-x-1.5 ${exit.isOngoing ? 'text-blue-600 font-semibold animate-pulse' : 'text-gray-500'}`}>
                                                <span>{format(exit.startTime, 'HH:mm')} - {exit.endTime ? format(exit.endTime, 'HH:mm') : 'Ongoing'}</span>
                                                {!exit.isOngoing && exit.endTime && (<span className="text-purple-600">({formatDuration(exit.durationMinutes)})</span>)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (todayAttendance && todayAttendance.checkIn && !todayAttendance.checkOut ? <span className="text-gray-400">No Exits</span> : '—')}
                        </td>
                    </tr>
                  );
                })}
                 {filteredStaff.length === 0 && (
                    <tr className="block lg:table-row">
                        <td colSpan={7} className="text-center py-12 text-gray-500 block lg:table-cell">
                            No staff members found.
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AttendanceActionModal 
        isOpen={isAttendanceModalOpen} 
        onClose={() => setIsAttendanceModalOpen(false)} 
        activeStaffMembers={activeStaffMembers} 
        getTodayAttendance={getTodayAttendance} 
        handleCheckIn={handleCheckIn} 
        handleCheckOutAttempt={handleCheckOutAttempt} 
        handleStartTempExit={handleStartTempExit} 
        handleEndTempExit={handleEndTempExit} 
      />
      
      {showWeekOffModal && <ApplyWeekOffModal staffMembers={activeStaffMembers} attendanceRecords={attendanceRecordsFE} onClose={() => setShowWeekOffModal(false)} onApply={applyWeekOff} />}
      
      <ConfirmationModal
        isOpen={showConfirmModal && !!pendingCheckOutData}
        onGoBack={() => { setShowConfirmModal(false); setPendingCheckOutData(null); }}
        onConfirm={() => { if (pendingCheckOutData) confirmCheckOut(pendingCheckOutData.attendanceId, pendingCheckOutData.requiredHours); }}
        staffName={pendingCheckOutData?.staffName}
        requiredHours={pendingCheckOutData?.requiredHours}
      />

      <RemoveWeekOffModal
          weekOffRecord={weekOffToRemove}
          onCancel={() => setWeekOffToRemove(null)}
          onConfirm={handleConfirmRemoveWeekOff}
      />
    </div>
  );
};

export default Attendance;