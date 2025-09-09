'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import { ArrowLeft, ArrowRight, Loader2, AlertCircle, User, CalendarDays, Search, Download, Star, ArrowDown, Users } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useSession } from 'next-auth/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HookData } from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// --- TYPE DEFINITIONS ---
interface StaffMember { id: string; name: string; }
interface IncentiveData { [staffId: string]: { [date: string]: { incentive: number; isTargetMet: boolean; customerCount: number; }; }; }

// --- HELPER FUNCTIONS ---
const toLocalDateString = (date: Date) => date.toISOString().split('T')[0];
const getWeekDateRange = (date: Date) => {
  const start = new Date(date);
  start.setDate(start.getDate() - (start.getDay() === 0 ? 6 : start.getDay() - 1));
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { startDate: start, endDate: end };
};

// --- MAIN REPORT COMPONENT ---
export default function IncentiveReportPage() {
  const { data: session } = useSession();
  const currentTenantId = useMemo(() => session?.user?.tenantId, [session]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [incentiveData, setIncentiveData] = useState<IncentiveData>({});
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => { const day = new Date(currentWeekStart); day.setDate(currentWeekStart.getDate() + i); return day; }), [currentWeekStart]);
  const filteredStaff = useMemo(() => staffList.filter(staff => staff.name.toLowerCase().includes(searchTerm.toLowerCase())), [staffList, searchTerm]);

  const fetchData = useCallback(async () => {
    if (!currentTenantId) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    const startDate = toLocalDateString(weekDays[0]);
    const endDate = toLocalDateString(weekDays[6]);
    try {
      const headers = new Headers({ 'X-Tenant-ID': currentTenantId });
      
      // --- THIS IS THE FIX: Fetch staff list first and handle specific permission errors ---
      const staffRes = await fetch('/api/staff?action=list', { headers });
      if (!staffRes.ok) {
        if (staffRes.status === 403 || staffRes.status === 401) {
            throw new Error("Could not load report. You may be missing the 'STAFF_LIST_READ' permission to view the staff list.");
        }
        throw new Error("Failed to fetch staff list. The report cannot be displayed.");
      }
      const staffResult = await staffRes.json();
      setStaffList(staffResult.data.map((s: any) => ({ id: s.id, name: s.name })));

      // Proceed to fetch incentive data only if staff list was successful
      const incentiveRes = await fetch(`/api/incentives/summary?startDate=${startDate}&endDate=${endDate}`, { headers });
      if (!incentiveRes.ok) throw new Error("Failed to load incentive data.");
      const incentiveResult = await incentiveRes.json();
      setIncentiveData(incentiveResult.data);
    } catch (err: any) {
      setError(err.message);
      // We don't toast here anymore since the error is displayed prominently.
    } finally {
      setIsLoading(false);
    }
  }, [currentTenantId, weekDays]);
  
  useEffect(() => { fetchData(); }, [fetchData]);

  const changeWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction === 'prev' ? -7 : 7));
      return newDate;
    });
  };

  const handleDownloadPDF = () => {
    if (filteredStaff.length === 0) return toast.info("No data to export.");
    const doc = new jsPDF();
    const tableColumn = ["Staff Name", ...weekDays.map(day => day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })), "Weekly Total"];
    const tableRows: string[][] = [];
    filteredStaff.forEach(staff => {
        let weeklyTotal = 0;
        const rowData = [staff.name];
        weekDays.forEach(day => {
            const dateString = toLocalDateString(day);
            const incentive = incentiveData[staff.id]?.[dateString]?.incentive ?? 0;
            rowData.push(`₹${incentive.toFixed(0)}`);
            weeklyTotal += incentive;
        });
        rowData.push(`₹${weeklyTotal.toFixed(0)}`);
        tableRows.push(rowData);
    });
    autoTable(doc, {
        head: [tableColumn], body: tableRows,
        didDrawPage: (data: HookData) => { doc.text(`Incentive Report: ${weekDays[0].toLocaleDateString()} - ${weekDays[6].toLocaleDateString()}`, data.settings.margin.left, 15); },
        styles: { halign: 'center' }, headStyles: { fillColor: '#34495E' },
        columnStyles: { 0: { halign: 'left', cellWidth: 45 }, 8: { fontStyle: 'bold' } }
    });
    doc.save(`incentive_report_${toLocalDateString(weekDays[0])}_${toLocalDateString(weekDays[6])}.pdf`);
  };

  const handleDownloadExcel = () => {
    if (filteredStaff.length === 0) return toast.info("No data to export.");
    const worksheetData: (string | number)[][] = [["Staff Name", ...weekDays.map(day => day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })), "Weekly Total"]];
    filteredStaff.forEach(staff => {
        const rowData: (string | number)[] = [staff.name];
        let total = 0;
        weekDays.forEach(day => {
            const dateString = toLocalDateString(day);
            const incentive = incentiveData[staff.id]?.[dateString]?.incentive ?? 0;
            rowData.push(incentive);
            total += incentive;
        });
        rowData.push(total);
        worksheetData.push(rowData);
    });
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Incentives");
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(data, `incentive_report_${toLocalDateString(weekDays[0])}_${toLocalDateString(weekDays[6])}.xlsx`);
  };

  const dateRangeDisplay = `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="font-sans">
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Weekly Incentive Report</h1>
          <p className="text-gray-500 mt-1">View weekly incentive earnings for all staff.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white border p-2 rounded-lg text-sm font-medium text-gray-700">
            <CalendarDays size={16} className="text-gray-500" />
            <span>{dateRangeDisplay}</span>
          </div>
          <Button onClick={() => changeWeek('prev')} variant="outline" size="sm" icon={<ArrowLeft size={16} />}>Previous</Button>
          <Button onClick={() => changeWeek('next')} variant="outline" size="sm" icon={<ArrowRight size={16} />}>Next</Button>
        </div>
      </header>
      
      <Card>
        <div className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-300">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" placeholder="Search staff..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-full pr-4 py-2 border border-gray-300 rounded-lg"/>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isLoading || !!error}><Download size={16} className="mr-2 text-red-600"/>PDF</Button>
            <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={isLoading || !!error}><Download size={16} className="mr-2 text-green-600"/>Excel</Button>
          </div>
        </div>

        {error && (
            <div className="p-6 bg-red-50 text-red-800 rounded-md m-4 border border-red-200">
                <div className="flex items-center gap-3">
                    <AlertCircle size={24}/>
                    <div>
                        <h3 className="font-bold">Error Loading Report</h3>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-1/4 border-b-2 border-r border-gray-300">Staff Name</th>
                {weekDays.map(day => (
                  <th key={day.toISOString()} className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-r border-gray-300">
                    {day.toLocaleDateString('en-US', { weekday: 'short' })} <br/> {day.getDate()}
                  </th>
                ))}
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-gray-300">Weekly Total</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {isLoading ? (
                <tr><td colSpan={9} className="text-center p-10 border-b border-gray-300"><Loader2 className="animate-spin inline-block mr-2"/>Loading Data...</td></tr>
              ) : !error && filteredStaff.length === 0 ? (
                <tr><td colSpan={9} className="text-center p-10 border-b border-gray-300">No staff found matching your search.</td></tr>
              ) : (
                !error && filteredStaff.map(staff => {
                  let weeklyTotal = 0;
                  return (
                    <tr key={staff.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-800 border-b border-r border-gray-300">{staff.name}</td>
                      {weekDays.map(day => {
                        const dateString = toLocalDateString(day);
                        const dayData = incentiveData[staff.id]?.[dateString];
                        const incentiveAmount = dayData?.incentive ?? 0;
                        weeklyTotal += incentiveAmount;
                        return (
                          <td key={dateString} className="px-6 py-4 whitespace-nowrap text-center border-b border-r border-gray-300">
                            <div className={`font-bold text-lg ${dayData?.isTargetMet ? 'text-green-600' : 'text-gray-800'}`}>
                              ₹{incentiveAmount.toFixed(0)}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {dayData?.customerCount ?? 0} Clients
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-xl text-indigo-600 border-b border-gray-300">
                        ₹{weeklyTotal.toFixed(0)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}