'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
// ✅ ADDED `Users` ICON
import { Settings, Search, ChevronLeft, ChevronRight, Edit, Download, Users } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useSession } from 'next-auth/react';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

import IncentiveSettingsModal from '@/components/IncentiveSettingsModal';
import IncentiveResultsModal from '@/components/IncentiveResultsModal';
import EditWeekModal from '@/components/EditWeekModal';

// Import libraries for file downloads
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HookData } from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';


// Helper function to correctly format a local date to YYYY-MM-DD
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
// ✅ UPDATED INTERFACE
interface IncentiveData {
    [staffId: string]: {
        [date: string]: {
            incentive: number;
            sales: number;
            isTargetMet: boolean;
            customerCount: number; // ADDED CUSTOMER COUNT
        };
    };
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

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDayData, setSelectedDayData] = useState<any>(null);
  const [selectedStaffForEdit, setSelectedStaffForEdit] = useState<StaffMember | null>(null);

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
      if (!currentTenantId) return;
      try {
        const headers = new Headers({ 'X-Tenant-ID': currentTenantId });
        const res = await fetch('/api/staff?action=list', { headers });
        const result = await res.json();
        if (res.ok) {
          setStaffList(result.data.map((s: any) => ({ id: s.id, name: s.name })));
        } else {
          toast.error("Failed to fetch staff list.");
        }
      } catch (error) {
        toast.error("Network error fetching staff.");
      }
    };
    fetchStaff();
  }, [currentTenantId]);

  useEffect(() => {
    const fetchIncentives = async () => {
      if (!currentTenantId || staffList.length === 0) {
        setLoading(false);
        return;
      }
      setLoading(true);

      const startDate = toLocalDateString(weekDays[0]);
      const endDate = toLocalDateString(weekDays[6]);

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
        head: [tableColumn],
        body: tableRows,
        didDrawPage: (data: HookData) => {
            doc.text(`Incentive Report: ${weekDays[0].toLocaleDateString()} - ${weekDays[6].toLocaleDateString()}`, data.settings.margin.left, 15);
        },
        styles: { halign: 'center' },
        headStyles: { fillColor: '#34495E' },
        columnStyles: {
            0: { halign: 'left', cellWidth: 45 },
            8: { fontStyle: 'bold' }
        }
    });
    doc.save(`incentive_report_${toLocalDateString(weekDays[0])}_${toLocalDateString(weekDays[6])}.pdf`);
  };


  const handleDownloadExcel = () => {
    const worksheetData: any[][] = [
        ["Staff Name", ...weekDays.map(day => day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })), "Weekly Total"]
    ];

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


  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen text-gray-800">
      {isSettingsModalOpen && currentTenantId && <IncentiveSettingsModal onClose={() => setIsSettingsModalOpen(false)} tenantId={currentTenantId} />}
      {isDetailsModalOpen && <IncentiveResultsModal data={selectedDayData} onClose={() => setIsDetailsModalOpen(false)} />}
      {isEditModalOpen && selectedStaffForEdit && <EditWeekModal staff={selectedStaffForEdit} weekDays={weekDays} onClose={() => setIsEditModalOpen(false)} onSave={handleSaveEdits} tenantId={currentTenantId!} />}

      <header className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
            <h1 className="text-3xl font-bold">Incentive Management</h1>
            <p className="text-gray-600 mt-1">Sales are updated automatically from billing. Click a day to see details.</p>
        </div>
        <div className="flex items-center gap-2">
            {canManageIncentives && (
              <Button onClick={() => setIsSettingsModalOpen(true)} variant="outline" className="flex items-center gap-2">
                <Settings size={16} /> Manage Rules
              </Button>
            )}
            <Button onClick={handleDownloadPDF} variant="outline" className="flex items-center gap-2">
              <Download size={16} /> PDF
            </Button>
            <Button onClick={handleDownloadExcel} variant="outline" className="flex items-center gap-2">
              <Download size={16} /> Excel
            </Button>
        </div>
      </header>

      <Card className="mb-6">
        <div className="p-4 flex flex-wrap justify-between items-center gap-4">
          <div className="relative flex-grow max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by staff name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 p-2 border rounded-lg bg-white text-black"
            />
          </div>
          <div className="flex items-center gap-2 font-semibold">
            <Button variant="outline" onClick={() => changeWeek('prev')}><ChevronLeft size={20} /></Button>
            <span className="text-center w-52">{weekDays[0].toLocaleDateString()} - {weekDays[6].toLocaleDateString()}</span>
            <Button variant="outline" onClick={() => changeWeek('next')}><ChevronRight size={20} /></Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="text-center p-10">Loading Data...</div>
      ) : (
        <div className="space-y-6">
          {filteredStaff.length > 0 ? filteredStaff.map(staff => (
            <Card key={staff.id}>
              <div className="p-4 flex justify-between items-center border-b">
                <h2 className="text-xl font-bold">{staff.name}</h2>
                {canManageIncentives && (
                  <Button variant="ghost" size="sm" className="flex items-center gap-1" onClick={() => handleOpenEditModal(staff)}>
                      <Edit size={14}/> Edit Week Reviews
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-7 gap-2 p-4">
                {weekDays.map((day, index) => {
                  const dateString = toLocalDateString(day);
                  const dayData = incentiveData[staff.id]?.[dateString];
                  const incentiveAmount = dayData?.incentive ?? 0;
                  const targetMet = dayData?.isTargetMet ?? false;
                  // ✅ GET THE CUSTOMER COUNT
                  const customerCount = dayData?.customerCount ?? 0;

                  return (
                    <div
                      key={dateString}
                      className="text-center p-3 rounded-lg border cursor-pointer transition-all hover:bg-gray-100 hover:shadow-md"
                      onClick={() => handleViewDayDetails(staff.id, day)}
                    >
                      <p className="font-semibold text-sm text-gray-500">{day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</p>
                      <p className="text-lg font-bold">{day.getDate()}</p>
                      <div className={`mt-2 font-bold text-xl ${targetMet ? 'text-green-600' : 'text-gray-700'}`}>
                        ₹{incentiveAmount.toFixed(0)}
                      </div>
                      <p className={`text-xs font-medium ${incentiveAmount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {incentiveAmount > 0 ? "Incentive" : "No Incentive"}
                      </p>
                      {/* ✅ DISPLAY THE CUSTOMER COUNT */}
                      <div className="mt-1 flex items-center justify-center gap-1 text-xs text-gray-400">
                        <Users size={12} />
                        <span>{customerCount}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )) : (
            <div className="text-center p-10 text-gray-500">No staff found.</div>
          )}
        </div>
      )}
    </div>
  );
}