// /app/routes/incentives/page.tsx (Updated)

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { Settings, Search, ChevronLeft, ChevronRight, Edit, Download, Users, RefreshCw, Star, ArrowUp, ArrowDown, PieChart } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useSession } from 'next-auth/react';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

import IncentiveSettingsModal from '@/components/IncentiveSettingsModal';
import IncentiveResultsModal from '@/components/IncentiveResultsModal';
import EditWeekModal from '@/components/EditWeekModal';
import WeeklySummaryModal from '@/components/WeeklySummaryModal'; // Import the new modal

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HookData } from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface StaffMember {
  id: string;
  name: string;
}
interface IncentiveData {
    [staffId: string]: {
        [date: string]: {
            incentive: number;
            sales: number;
            isTargetMet: boolean;
            customerCount: number;
        };
    };
}
// Define type for weekly summary data
interface WeeklySummaryData {
  totalNetServiceSale: number;
  totalProductSale: number;
  totalPackageSale: number;
  totalGiftCardSale: number;
  totalReviewsWithName: number;
  totalReviewsWithPhoto: number;
  totalCustomerCount: number;
}


export default function IncentivesPage() {
  const { data: session } = useSession();
  const currentTenantId = session?.user?.tenantId;
  const canManageIncentives = useMemo(() => hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.STAFF_INCENTIVES_MANAGE), [session]);

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [incentiveData, setIncentiveData] = useState<IncentiveData>({});
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const startDate = new Date(today.setDate(diff));
    startDate.setHours(0, 0, 0, 0);
    return startDate;
  });

  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDayData, setSelectedDayData] = useState<any>(null);
  const [selectedStaffForEdit, setSelectedStaffForEdit] = useState<StaffMember | null>(null);

  // State for the new weekly summary modal
  const [isWeeklySummaryModalOpen, setIsWeeklySummaryModalOpen] = useState(false);
  const [selectedWeeklyData, setSelectedWeeklyData] = useState<WeeklySummaryData | null>(null);
  const [selectedStaffForSummary, setSelectedStaffForSummary] = useState<StaffMember | null>(null);


  const weekDays = useMemo(() =>
    Array.from({ length: 7 }).map((_, i) => {
      const day = new Date(currentWeekStart);
      day.setDate(currentWeekStart.getDate() + i);
      return day;
    }), [currentWeekStart]);

  const filteredStaff = useMemo(() =>
    staffList.filter(staff => staff.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [staffList, searchTerm]);

  useEffect(() => {
    const fetchStaff = async () => {
      if (!currentTenantId) {
        setIsLoadingStaff(false);
        return;
      }
      setIsLoadingStaff(true);
      try {
        const headers = new Headers({ 'X-Tenant-ID': currentTenantId });
        const res = await fetch('/api/staff?action=list', { headers });
        const result = await res.json();
        if (res.ok) {
          setStaffList(result.data.map((s: any) => ({ id: s.id, name: s.name })));
        } else {
          toast.error("Failed to fetch staff list.");
          setStaffList([]);
        }
      } catch (error) {
        toast.error("Network error fetching staff.");
        setStaffList([]);
      } finally {
        setIsLoadingStaff(false);
      }
    };
    fetchStaff();
  }, [currentTenantId]);

  useEffect(() => {
    if (!currentTenantId || staffList.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const startDate = toLocalDateString(weekDays[0]);
    const endDate = toLocalDateString(weekDays[6]);

    const fetchIncentives = async () => {
      try {
        const headers = new Headers({ 'X-Tenant-ID': currentTenantId });
        const res = await fetch(`/api/incentives/summary?startDate=${startDate}&endDate=${endDate}`, { headers });
        const result = await res.json();
        if (res.ok) {
          setIncentiveData(result.data);
        } else {
          toast.error("Failed to load incentive data.");
        }
      } catch (error) {
        toast.error("Network error loading incentive data.");
      } finally {
        setLoading(false);
      }
    };
    fetchIncentives();
  }, [currentTenantId, staffList, currentWeekStart, refetchTrigger]);

    useEffect(() => {
    const handleFocus = () => {
      toast.info("Refreshing data...");
      setRefetchTrigger(prev => prev + 1);
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const changeWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setDate(prevDate.getDate() + (direction === 'prev' ? -7 : 7));
      return newDate;
    });
  };

  const handleViewDayDetails = async (staffId: string, date: Date) => {
    if (!currentTenantId) return;
    toast.info("Fetching details...");
    try {
        const dateString = toLocalDateString(date);
        const headers = new Headers({ 'X-Tenant-ID': currentTenantId });
        const res = await fetch(`/api/incentives/calculation/${staffId}?date=${dateString}`, { headers });
        const data = await res.json();
        if (res.ok) {
            setSelectedDayData(data);
            setIsDetailsModalOpen(true);
        } else {
            toast.error(data.message || 'Could not fetch details.');
        }
    } catch (error) {
        toast.error('Network error fetching details.');
    }
  };

  const handleOpenEditModal = (staff: StaffMember) => {
      setSelectedStaffForEdit(staff);
      setIsEditModalOpen(true);
  };

  // Function to handle opening the new weekly summary modal
  const handleViewWeeklySummary = async (staff: StaffMember) => {
    if (!currentTenantId) return;
    toast.info("Fetching weekly summary...");
    try {
        const startDate = toLocalDateString(weekDays[0]);
        const endDate = toLocalDateString(weekDays[6]);
        const headers = new Headers({ 'X-Tenant-ID': currentTenantId });
        const res = await fetch(`/api/incentives/weekly-summary?staffId=${staff.id}&startDate=${startDate}&endDate=${endDate}`, { headers });
        const result = await res.json();
        if (res.ok) {
            setSelectedWeeklyData(result.data);
            setSelectedStaffForSummary(staff);
            setIsWeeklySummaryModalOpen(true);
        } else {
            toast.error(result.message || 'Could not fetch weekly summary.');
        }
    } catch (error) {
        toast.error('Network error fetching summary.');
    }
  };


  const handleSaveEdits = () => {
    setIsEditModalOpen(false);
    setRefetchTrigger(prev => prev + 1);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const tableColumn = ["Staff Name", ...weekDays.map(day => day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })), "Weekly Total"];
    const tableRows: (string | number)[][] = [];
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
    const worksheetData: any[][] = [["Staff Name", ...weekDays.map(day => day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })), "Weekly Total"]];
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

  const weekRangeString = `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8">
      {isSettingsModalOpen && currentTenantId && <IncentiveSettingsModal onClose={() => setIsSettingsModalOpen(false)} tenantId={currentTenantId} />}
      {isDetailsModalOpen && <IncentiveResultsModal data={selectedDayData} onClose={() => setIsDetailsModalOpen(false)} />}
      {isEditModalOpen && selectedStaffForEdit && <EditWeekModal staff={selectedStaffForEdit} weekDays={weekDays} onClose={() => setIsEditModalOpen(false)} onSave={handleSaveEdits} tenantId={currentTenantId!} />}
      {isWeeklySummaryModalOpen && selectedStaffForSummary && <WeeklySummaryModal staffName={selectedStaffForSummary.name} data={selectedWeeklyData} weekRange={weekRangeString} onClose={() => setIsWeeklySummaryModalOpen(false)} />}


      <header className="mb-8">
        <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
                <h1 className="text-4xl font-bold text-slate-900">Incentive Management</h1>
                <p className="text-slate-500 mt-2">Automated sales tracking from billing. Click any day or weekly total to view details.</p>
            </div>
            <div className="flex items-center gap-3">
                {canManageIncentives && (<Button onClick={() => setIsSettingsModalOpen(true)} variant="outline" className="flex items-center gap-2"><Settings size={16} /> Manage Rules</Button>)}
                <Button onClick={() => setRefetchTrigger(prev => prev + 1)} variant="outline" className="flex items-center gap-2"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh</Button>
                <Button onClick={handleDownloadPDF} variant="outline" className="flex items-center gap-2"><Download size={16} /> PDF</Button>
                <Button onClick={handleDownloadExcel} variant="outline" className="flex items-center gap-2"><Download size={16} /> Excel</Button>
            </div>
        </div>
      </header>

      <Card className="mb-8 p-4 rounded-2xl">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="relative flex-grow max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="Search by staff name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 p-3 border rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-shadow" />
          </div>
          <div className="flex items-center gap-3 font-semibold text-slate-700">
            <Button variant="outline" onClick={() => changeWeek('prev')}><ChevronLeft size={20} /></Button>
            <span className="text-center w-60 text-lg">{weekRangeString}</span>
            <Button variant="outline" onClick={() => changeWeek('next')}><ChevronRight size={20} /></Button>
          </div>
        </div>
      </Card>

      {isLoadingStaff ? (
        <div className="text-center p-16 text-slate-500">Loading Staff...</div>
      ) : staffList.length === 0 ? (
        <div className="text-center p-16 text-slate-500">No staff members found. Add staff to begin.</div>
      ) : loading ? (
        <div className="text-center p-16 text-slate-500">Loading Incentive Data...</div>
      ) : (
        <div className="space-y-8">
          {filteredStaff.map(staff => {
            // Calculate weekly total incentive on the fly from existing data
            const weeklyTotalIncentive = weekDays.reduce((total, day) => {
              const dateString = toLocalDateString(day);
              return total + (incentiveData[staff.id]?.[dateString]?.incentive ?? 0);
            }, 0);

            return (
              <Card key={staff.id} className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-2xl">
                <div className="p-5 flex justify-between items-center bg-white border-b-4 border-amber-400">
                  <h2 className="text-2xl font-bold text-slate-800">{staff.name}</h2>
                  {canManageIncentives && (<Button variant="ghost" size="sm" className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800" onClick={() => handleOpenEditModal(staff)}><Edit size={16}/> Edit Week Reviews</Button>)}
                </div>
                {/* Changed to 8 columns to accommodate the weekly total */}
                <div className="grid grid-cols-1 md:grid-cols-8 bg-white">
                  {weekDays.map(day => {
                    const dateString = toLocalDateString(day);
                    const dayData = incentiveData[staff.id]?.[dateString];
                    const incentiveAmount = dayData?.incentive ?? 0;
                    const targetMet = dayData?.isTargetMet ?? false;
                    const customerCount = dayData?.customerCount ?? 0;

                    return (
                      <div key={dateString} className="text-center p-4 border-t md:border-t-0 md:border-l border-slate-100 cursor-pointer transition-all duration-300 hover:bg-indigo-50" onClick={() => handleViewDayDetails(staff.id, day)}>
                        <p className="font-semibold text-sm text-slate-500">{day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</p>
                        <p className="text-2xl font-bold text-slate-800">{day.getDate()}</p>
                        <div className={`mt-3 font-bold text-3xl ${targetMet ? 'text-green-500' : 'text-slate-700'}`}>
                          ₹{incentiveAmount.toFixed(0)}
                        </div>
                        <div className={`mt-2 flex items-center justify-center gap-2 text-sm font-semibold ${incentiveAmount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {incentiveAmount > 0 ? <Star size={14} className="fill-current" /> : <ArrowDown size={14} />}
                          <span>{incentiveAmount > 0 ? "Incentive Earned" : "No Incentive"}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
                          <Users size={14} />
                          <span>{customerCount} Customers</span>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* --- NEW WEEKLY TOTAL COLUMN --- */}
                  <div 
                    className="text-center p-4 border-t md:border-t-0 md:border-l border-slate-200 cursor-pointer transition-all duration-300 bg-slate-50 hover:bg-indigo-100 flex flex-col justify-center items-center"
                    onClick={() => handleViewWeeklySummary(staff)}
                  >
                      <p className="font-bold text-sm text-slate-600">WEEKLY TOTAL</p>
                      <div className={`my-4 font-bold text-4xl ${weeklyTotalIncentive > 0 ? 'text-indigo-600' : 'text-slate-800'}`}>
                        ₹{weeklyTotalIncentive.toFixed(0)}
                      </div>
                      <div className="flex items-center justify-center gap-2 text-sm font-semibold text-indigo-700">
                        <PieChart size={14} />
                        <span>View Summary</span>
                      </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  );
}