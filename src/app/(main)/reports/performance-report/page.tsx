'use client';

import React, { useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Search, Star, TrendingUp, Users, IndianRupee, Sheet, FileDown, PieChart, X, CalendarDays, Package, Gift, Target } from 'lucide-react';
import { format, startOfMonth, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useSession } from 'next-auth/react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import { hasPermission, PERMISSIONS } from '../../../../lib/permissions';

ChartJS.register(ArcElement, Tooltip, Legend);

// --- Interfaces ---
interface PerformanceData { staffId: string; staffIdNumber: string; name: string; position: string; image?: string; sales: number; customers: number; rating: number; totalServiceSales: number; totalProductSales: number; }
interface SummaryData { averageRating: string; totalCustomers: number; revenueGenerated: number; avgServiceQuality: string; }

// ✅ ADDITION: Interface for the detailed daily records for the modal.
interface DailyPerformanceRecord {
  date: string;
  serviceSales: number;
  productSales: number;
  packageSales: number;
  giftCardSales: number;
  customersServed: number;
  rates: { daily: number; monthly: number; package: number; giftCard: number; };
  incentives: { daily: number; monthly: number; package: number; giftCard: number; };
}

interface IncentiveReportData { dailyReport: any[]; dailySummaryReport: any[]; monthlyReport: any[]; staffSummary: any[]; packageReport: any[]; giftCardReport: any[]; }
const CHART_COLORS = [ '#4f46e5', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#64748b', '#14b8a6', '#f97316', '#a855f7' ];

// --- UI Helper Components ---
const SummaryCard: React.FC<{ icon: React.ReactNode; title: string; value: string | number; subValue?: string; iconBgColor: string; bgIconColor: string; }> = ({ icon, title, value, subValue, iconBgColor, bgIconColor }) => ( <div className="relative bg-white p-5 rounded-xl shadow-sm border border-slate-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden"><div className={`absolute -right-4 -bottom-5 ${bgIconColor} opacity-50`}>{React.cloneElement(icon as React.ReactElement, { size: 96, strokeWidth: 1 })}</div><div className="relative z-10"><div className={`p-3 rounded-lg inline-block ${iconBgColor}`}>{React.cloneElement(icon as React.ReactElement, { size: 24 })}</div><p className="mt-4 text-sm text-slate-500">{title}</p><p className="text-2xl font-bold text-slate-800">{value}</p>{subValue && <p className="text-lg text-slate-800 font-semibold">{subValue}</p>}</div></div> );
const PerformancePieChart: React.FC<{ data: PerformanceData[] }> = ({ data }) => { const chartData = useMemo(() => { if (!data || data.length === 0) return null; const sortedData = [...data].sort((a, b) => b.sales - a.sales); const labels = sortedData.map(staff => staff.name); const salesData = sortedData.map(staff => staff.sales); return { labels, datasets: [{ label: 'Total Sales', data: salesData, backgroundColor: CHART_COLORS, borderColor: '#ffffff', borderWidth: 2, hoverOffset: 8 }] }; }, [data]); if (!chartData) return null; return ( <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-100"><h3 className="text-lg font-bold text-slate-800 flex items-center mb-4"><PieChart className="mr-2 text-indigo-500" size={20}/>Sales Contribution</h3><div className="relative h-64 sm:h-80 w-full"><Doughnut data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }} /></div></div> ); };
const IncentivePieChart: React.FC<{ data: any[] }> = ({ data }) => { const chartData = useMemo(() => { if (!data || data.length === 0) return null; const filteredData = data.filter(staff => parseFloat(staff['Total Incentive (₹)']) > 0); if (filteredData.length === 0) return null; const labels = filteredData.map(staff => staff['Staff Name']); const incentiveData = filteredData.map(staff => parseFloat(staff['Total Incentive (₹)'])); return { labels, datasets: [{ label: 'Total Incentive (₹)', data: incentiveData, backgroundColor: CHART_COLORS.slice().reverse(), borderColor: '#ffffff', borderWidth: 2, hoverOffset: 8 }] }; }, [data]); if (!chartData) return null; return ( <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-100"><h3 className="text-lg font-bold text-slate-800 flex items-center mb-4"><PieChart className="mr-2 text-teal-500" size={20}/>Incentive Contribution</h3><div className="relative h-64 sm:h-80 w-full"><Doughnut data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }} /></div></div> ); };

// ✅ ADDITION: Portal component for rendering the modal.
const ModalPortal: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  return mounted ? createPortal(children, document.body) : null;
};


const PerformanceReport: React.FC = () => {
  const { data: session, status: sessionStatus } = useSession();
  const userPermissions = useMemo(() => session?.user?.role?.permissions || [], [session]);

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());
  
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [incentiveReportData, setIncentiveReportData] = useState<IncentiveReportData | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ ADDITION: State variables for the details modal.
  const [selectedStaff, setSelectedStaff] = useState<PerformanceData | null>(null);
  const [staffDailyPerformance, setStaffDailyPerformance] = useState<DailyPerformanceRecord[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const today = new Date();
  const isViewingCurrentMonth = today.getFullYear() === endDate.getFullYear() && today.getMonth() === endDate.getMonth();
  const daysInSelectedMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
  const daysEnded = isViewingCurrentMonth ? today.getDate() : daysInSelectedMonth;
  const projectionDays = daysInSelectedMonth;

  useEffect(() => {
    if (session?.user?.tenantId) {
      fetchReportData();
    }
  }, [session]);

  const fetchReportData = async () => {
    if (!session?.user?.tenantId || !startDate || !endDate) return;
    setIsLoading(true);
    setError(null);
    setIncentiveReportData(null);

    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');
    const tenantId = session.user.tenantId;

    try {
      const [performanceRes, incentiveRes] = await Promise.all([
        fetch(`/api/performance?startDate=${formattedStartDate}&endDate=${formattedEndDate}`, { headers: { 'x-tenant-id': tenantId } }),
        fetch('/api/incentives/report', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId }, body: JSON.stringify({ startDate: formattedStartDate, endDate: formattedEndDate }) })
      ]);

      if (!performanceRes.ok) throw new Error('Failed to fetch performance data');
      const perfData = await performanceRes.json();
      if (!perfData.success) throw new Error(perfData.message || 'API error (performance)');
      setSummaryData(perfData.summary);
      setPerformanceData(perfData.staffPerformance);

      if (incentiveRes.ok) {
        const incData = await incentiveRes.json();
        if (incData.success) setIncentiveReportData(incData.data);
      } else {
        console.warn("Could not fetch incentive data.");
      }

    } catch (err: any) { setError(err.message); } 
    finally { setIsLoading(false); }
  };
  
  // ✅ ADDITION: Function to fetch daily details for the selected staff.
  const handleOpenDetails = async (staff: PerformanceData) => {
    if (!session?.user?.tenantId || !startDate || !endDate) return;
    setSelectedStaff(staff);
    setIsLoadingDetails(true);
    setErrorDetails(null);
    setStaffDailyPerformance([]);
    try {
      const formattedStartDate = format(startDate, 'yyyy-MM-dd');
      const formattedEndDate = format(endDate, 'yyyy-MM-dd');
      const response = await fetch(`/api/performance?staffId=${staff.staffId}&startDate=${formattedStartDate}&endDate=${formattedEndDate}`, { headers: { 'x-tenant-id': session.user.tenantId } });
      if (!response.ok) throw new Error('Could not fetch daily details.');
      const data = await response.json();
      if (!data.success) throw new Error(data.message || 'API error fetching details.');
      setStaffDailyPerformance(data.details || []);
    } catch (err: any) { setErrorDetails(err.message); } 
    finally { setIsLoadingDetails(false); }
  };

  const handleCloseDetails = () => setSelectedStaff(null);

  // ✅ ADDITION: Calculations for the modal's summary panels.
  const panelSummary = useMemo(() => {
      if (!staffDailyPerformance.length) return { totalSales: 0, totalCustomers: 0 };
      const totalSales = staffDailyPerformance.reduce((sum, day) => sum + day.serviceSales + day.productSales + (day.packageSales || 0) + (day.giftCardSales || 0), 0);
      const totalCustomers = staffDailyPerformance.reduce((sum, day) => sum + day.customersServed, 0);
      return { totalSales, totalCustomers };
  }, [staffDailyPerformance]);

  const modalIncentiveSummary = useMemo(() => {
      const initial = { totalAchieved: 0, monthlyIncentive: 0, packageIncentive: 0, giftCardIncentive: 0, dailyIncentiveComponent: 0, monthlyTarget: 0 };
      if (!selectedStaff || !incentiveReportData) return initial;
      const staffName = selectedStaff.name;
      const staffRec = incentiveReportData.staffSummary?.find(rec => rec['Staff Name'] === staffName) ?? {};
      const dailySummaryRec = incentiveReportData.dailySummaryReport?.find(rec => rec['Staff Name'] === staffName) ?? {};
      const monthlyRec = incentiveReportData.monthlyReport?.find(rec => rec['Staff Name'] === staffName) ?? {};
      const packageRec = incentiveReportData.packageReport?.find(rec => rec['Staff Name'] === staffName) ?? {};
      const giftCardRec = incentiveReportData.giftCardReport?.find(rec => rec['Staff Name'] === staffName) ?? {};
      const totalAchieved = parseFloat(staffRec['Total Incentive (₹)'] ?? '0');
      const dailyIncentiveComponent = parseFloat(dailySummaryRec['Incentive (₹)'] ?? '0');
      const monthlyIncentive = parseFloat(monthlyRec['Incentive (₹)'] ?? '0');
      const packageIncentive = parseFloat(packageRec['Incentive (₹)'] ?? '0');
      const giftCardIncentive = parseFloat(giftCardRec['Incentive (₹)'] ?? '0');
      const monthlyTarget = parseFloat(monthlyRec['Target (₹)'] ?? '0');
      return { totalAchieved, monthlyIncentive, packageIncentive, giftCardIncentive, dailyIncentiveComponent, monthlyTarget };
  }, [selectedStaff, incentiveReportData]);

  
  const filteredStaffPerformance = useMemo(() => performanceData.filter((staff) => staff.name.toLowerCase().includes(searchTerm.toLowerCase())), [performanceData, searchTerm]);
  
  const grandTotals = useMemo(() => {
    const totalSales = filteredStaffPerformance.reduce((sum, s) => sum + s.sales, 0);
    const totalClients = filteredStaffPerformance.reduce((sum, s) => sum + s.customers, 0);
    const totalServiceSales = filteredStaffPerformance.reduce((sum, s) => sum + s.totalServiceSales, 0);
    const totalProductSales = filteredStaffPerformance.reduce((sum, s) => sum + s.totalProductSales, 0);
    const avgAbv = totalClients > 0 ? totalSales / totalClients : 0;
    const projectedSales = daysEnded > 0 ? (totalSales / daysEnded) * projectionDays : 0;
    const projectedClients = daysEnded > 0 ? (totalClients / daysEnded) * projectionDays : 0;
    return { totalSales, totalClients, avgAbv, projectedSales, projectedClients, totalServiceSales, totalProductSales };
  }, [filteredStaffPerformance, daysEnded, projectionDays]);

  const topPerformersSummary = useMemo(() => {
    if (!performanceData || performanceData.length === 0) return { topService: { name: 'N/A', value: 0 }, topProduct: { name: 'N/A', value: 0 } };
    const topService = [...performanceData].sort((a, b) => b.totalServiceSales - a.totalServiceSales)[0];
    const topProduct = [...performanceData].sort((a, b) => b.totalProductSales - a.totalProductSales)[0];
    return { topService: { name: topService.name, value: topService.totalServiceSales }, topProduct: { name: topProduct.name, value: topProduct.totalProductSales } };
  }, [performanceData]);
  
  const formatCurrency = (value: number | string) => `₹${Math.round(Number(value)).toLocaleString('en-IN')}`;
  
  // ✅ MODIFICATION: Added the new columns to the export data.
  const getExportData = () => {
    const headers = ["S.NO", "Employee Name", "Employee Code", "Client Count", "ABV", "Service Net Sales", "Product Sales", "Total Sales", "Projected Sales", "Projected Clients"];
    const body = filteredStaffPerformance.map((staff, index) => {
      const abv = staff.customers > 0 ? staff.sales / staff.customers : 0;
      const projectedSales = daysEnded > 0 ? (staff.sales / daysEnded) * projectionDays : 0;
      const projectedClients = daysEnded > 0 ? (staff.customers / daysEnded) * projectionDays : 0;
      return [index + 1, staff.name, staff.staffIdNumber, staff.customers, Math.round(abv), staff.totalServiceSales, staff.totalProductSales, staff.sales, Math.round(projectedSales), Math.round(projectedClients)];
    });
    const totalsRow = ["", "GRAND TOTAL", "", grandTotals.totalClients, Math.round(grandTotals.avgAbv), grandTotals.totalServiceSales, grandTotals.totalProductSales, Math.round(grandTotals.totalSales), Math.round(grandTotals.projectedSales), Math.round(grandTotals.projectedClients)];
    return { headers, body, totalsRow };
  };
  
  const handleDownloadExcel = () => {
    const { headers, body, totalsRow } = getExportData();
    const wb = XLSX.utils.book_new();
    const wsPerf = XLSX.utils.aoa_to_sheet([headers, ...body, totalsRow]);
    wsPerf['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsPerf, "Performance Report");
    XLSX.writeFile(wb, `Performance_Report_${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}.xlsx`);
  };

  const handleDownloadPdf = () => {
    const { headers, body, totalsRow } = getExportData();
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18); doc.text(`Performance Report (${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')})`, 14, 20);
    doc.setFontSize(11); doc.setTextColor(100); doc.text(`Report generated on: ${format(new Date(), 'dd-MM-yyyy')}`, 14, 26);
    autoTable(doc, { head: [headers], body, foot: [totalsRow], startY: 30, theme: 'grid', headStyles: { fillColor: [22, 160, 133], fontSize: 8 }, footStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: 'bold' }, styles: { fontSize: 8, cellPadding: 2 } });
    doc.save(`Performance_Report_${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}.pdf`);
  };

  if (sessionStatus === 'loading') {
      return <div className="p-6 text-center">Loading session...</div>;
  }

  if (sessionStatus === 'unauthenticated' || !hasPermission(userPermissions, PERMISSIONS.REPORT_PERFORMANCE_READ)) {
      return (
          <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
              <div className="text-center">
                  <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
                  <p className="mt-2 text-gray-600">You do not have permission to view this report.</p>
              </div>
          </div>
      );
  }

  return (
    <div className="font-sans">
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Performance Report</h1>
          <p className="text-sm text-slate-500 mt-1">
            Data from <strong>{format(startDate, 'dd MMM, yyyy')}</strong> to <strong>{format(endDate, 'dd MMM, yyyy')}</strong>.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <input type="date" value={format(startDate, 'yyyy-MM-dd')} onChange={(e) => setStartDate(new Date(e.target.value))} className="p-2 border border-gray-300 rounded-md shadow-sm text-sm"/>
          <input type="date" value={format(endDate, 'yyyy-MM-dd')} onChange={(e) => setEndDate(new Date(e.target.value))} className="p-2 border border-gray-300 rounded-md shadow-sm text-sm"/>
          <Button onClick={fetchReportData} className="bg-purple-600 hover:bg-purple-700 text-white" disabled={isLoading}>{isLoading ? 'Fetching...' : 'Fetch Report'}</Button>
        </div>
      </header>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 p-4">
          {isLoading ? <>...</> : error ? <div className="col-span-full text-center p-10 bg-white rounded-xl text-red-500">{error}</div> :
            <>
              <SummaryCard icon={<Users/>} title="Total Customers" value={summaryData?.totalCustomers || 0} iconBgColor="bg-teal-100" bgIconColor="text-teal-100"/>
              <SummaryCard icon={<IndianRupee/>} title="Total Revenue" value={formatCurrency(summaryData?.revenueGenerated || 0)} iconBgColor="bg-green-100" bgIconColor="text-green-100"/>
              <SummaryCard icon={<Star/>} title="Top Service Earner" value={formatCurrency(topPerformersSummary.topService.value)} subValue={topPerformersSummary.topService.name} iconBgColor="bg-amber-100" bgIconColor="text-amber-100"/>
              <SummaryCard icon={<TrendingUp/>} title="Top Product Earner" value={formatCurrency(topPerformersSummary.topProduct.value)} subValue={topPerformersSummary.topProduct.name} iconBgColor="bg-indigo-100" bgIconColor="text-indigo-100"/>
            </>
          }
        </div>

        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-4 border-b">
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="text" placeholder="Search staff..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-full pr-4 py-2 border border-slate-300 rounded-lg"/>
            </div>
            {hasPermission(userPermissions, PERMISSIONS.REPORT_PERFORMANCE_MANAGE) && (
              <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isLoading || filteredStaffPerformance.length === 0}><FileDown size={16} className="mr-2 text-red-600"/>PDF</Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={isLoading || filteredStaffPerformance.length === 0}><Sheet size={16} className="mr-2 text-green-600"/>Excel</Button>
              </div>
            )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full hidden md:table">
            {/* ✅ MODIFICATION: Added "Staff ID" and "Projected Clients" headers. */}
            <thead className="bg-slate-50"><tr><th className="p-4 text-left text-xs font-semibold text-slate-500 uppercase">Staff</th><th className="p-4 text-left text-xs font-semibold text-slate-500 uppercase">Staff ID</th><th className="p-4 text-right text-xs font-semibold text-slate-500 uppercase">Total Sales</th><th className="p-4 text-center text-xs font-semibold text-slate-500 uppercase">Clients</th><th className="p-4 text-right text-xs font-semibold text-slate-500 uppercase">ABV</th><th className="p-4 text-right text-xs font-semibold text-slate-500 uppercase">Projected Sales</th><th className="p-4 text-right text-xs font-semibold text-slate-500 uppercase">Projected Clients</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
                {isLoading ? <tr><td colSpan={7} className="text-center p-10">Loading...</td></tr> : 
                 filteredStaffPerformance.map(staff => {
                    const abv = staff.customers > 0 ? staff.sales / staff.customers : 0;
                    const projectedSales = daysEnded > 0 ? (staff.sales / daysEnded) * projectionDays : 0;
                    const projectedClients = daysEnded > 0 ? (staff.customers / daysEnded) * projectionDays : 0;
                    return (
                        // ✅ MODIFICATION: Added onClick handler and cursor style to the row.
                        <tr key={staff.staffId} onClick={() => handleOpenDetails(staff)} className="hover:bg-slate-50 cursor-pointer">
                            <td className="p-4"><div className="flex items-center"><p className="font-semibold">{staff.name}</p></div></td>
                            {/* ✅ ADDITION: New table cells for the added data. */}
                            <td className="p-4 text-left">{staff.staffIdNumber}</td>
                            <td className="p-4 text-right font-semibold">{formatCurrency(staff.sales)}</td>
                            <td className="p-4 text-center">{staff.customers}</td>
                            <td className="p-4 text-right text-indigo-600 font-bold">{formatCurrency(abv)}</td>
                            <td className="p-4 text-right text-green-600">{formatCurrency(projectedSales)}</td>
                            <td className="p-4 text-right text-purple-600">{Math.round(projectedClients)}</td>
                        </tr>
                    );
                 })}
                 <tr className="bg-slate-100 font-bold">
                    <td className="p-4">GRAND TOTAL</td><td className="p-4"></td><td className="p-4 text-right">{formatCurrency(grandTotals.totalSales)}</td><td className="p-4 text-center">{grandTotals.totalClients}</td>
                    <td className="p-4 text-right">{formatCurrency(grandTotals.avgAbv)}</td><td className="p-4 text-right">{formatCurrency(grandTotals.projectedSales)}</td><td className="p-4 text-right">{Math.round(grandTotals.projectedClients)}</td>
                 </tr>
            </tbody>
          </table>
          <div className="md:hidden divide-y divide-slate-100">{/* Mobile view remains unchanged */}</div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
          <PerformancePieChart data={performanceData} />
          {incentiveReportData && <IncentivePieChart data={incentiveReportData.staffSummary} />}
        </div>
      </Card>

        {/* ✅ ADDITION: The complete modal component for displaying staff details. */}
        {selectedStaff && (
            <ModalPortal>
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={handleCloseDetails}>
                <div className="relative w-full h-full sm:max-w-4xl sm:max-h-[90vh] bg-slate-50 sm:rounded-2xl shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-slate-200 bg-white sm:rounded-t-2xl">
                    <h2 className="text-lg font-semibold text-slate-800">Performance Details</h2><button onClick={handleCloseDetails} className="p-1 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"><X size={24} /></button>
                    </header>

                    <div className="flex-grow p-4 sm:p-6 overflow-y-auto">
                        {isLoadingDetails ? <div className="py-20 text-center text-slate-500">Loading Details...</div> : errorDetails ? <div className="py-20 text-center text-red-500">{errorDetails}</div> :
                        <div className="space-y-6">
                            <div className="flex items-center p-4 bg-white rounded-xl shadow-sm border border-slate-200"><img className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover" src={selectedStaff.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedStaff.name)}&background=4f46e5&color=fff`} alt={selectedStaff.name} /><div className="ml-4"><h3 className="text-lg sm:text-xl font-bold text-slate-900">{selectedStaff.name}</h3><p className="text-sm text-slate-600">{selectedStaff.position}</p></div></div>
                            
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200"><h4 className="text-md font-semibold text-slate-800 mb-3">Summary for Period</h4><div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-center"><div><p className="text-lg font-bold text-green-600">{formatCurrency(panelSummary.totalSales)}</p><p className="text-xs text-slate-500 uppercase">Total Sales</p></div><div><p className="text-lg font-bold text-teal-600">{panelSummary.totalCustomers}</p><p className="text-xs text-slate-500 uppercase">Customers</p></div><div><p className="text-lg font-bold text-blue-600">{formatCurrency(modalIncentiveSummary.monthlyTarget)}</p><p className="text-xs text-slate-500 uppercase">Monthly Target</p></div><div><p className="text-lg font-bold text-purple-600">{formatCurrency(modalIncentiveSummary.totalAchieved)}</p><p className="text-xs text-slate-500 uppercase">Total Incentive</p></div></div></div>
                            
                            {incentiveReportData && (
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                    <h4 className="text-md font-semibold text-slate-800 mb-3">Incentive Breakdown (Period Total)</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between items-center p-2 rounded bg-slate-50"><div className="flex items-center"><CalendarDays className="w-4 h-4 mr-2 text-indigo-500" /> <span className="text-slate-600">Daily Target Total:</span></div><span className="font-semibold text-slate-800">{formatCurrency(modalIncentiveSummary.dailyIncentiveComponent)}</span></div>
                                        <div className="flex justify-between items-center p-2 rounded bg-slate-50"><div className="flex items-center"><Target className="w-4 h-4 mr-2 text-blue-500" /> <span className="text-slate-600">Monthly Sales Incentive:</span></div><span className="font-semibold text-slate-800">{formatCurrency(modalIncentiveSummary.monthlyIncentive)}</span></div>
                                        <div className="flex justify-between items-center p-2 rounded bg-slate-50"><div className="flex items-center"><Package className="w-4 h-4 mr-2 text-amber-500" /> <span className="text-slate-600">Package Sale Incentive:</span></div><span className="font-semibold text-slate-800">{formatCurrency(modalIncentiveSummary.packageIncentive)}</span></div>
                                        <div className="flex justify-between items-center p-2 rounded bg-slate-50"><div className="flex items-center"><Gift className="w-4 h-4 mr-2 text-rose-500" /> <span className="text-slate-600">Gift Card Sale Incentive:</span></div><span className="font-semibold text-slate-800">{formatCurrency(modalIncentiveSummary.giftCardIncentive)}</span></div>
                                        <div className="flex justify-between pt-2 border-t mt-2 font-bold text-base"><span className="text-slate-600">Total Incentive Earned:</span><span className="text-purple-700">{formatCurrency(modalIncentiveSummary.totalAchieved)}</span></div>
                                    </div>
                                </div>
                            )}
                            
                            <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 max-h-[45vh] overflow-y-auto">
                                <h4 className="text-md font-semibold text-slate-800 mb-3 px-2 sticky top-0 bg-white py-2 z-10 border-b">Daily Breakdown</h4>
                                {staffDailyPerformance.length > 0 ? (
                                <div className="space-y-2 px-1 pb-1">
                                    {staffDailyPerformance.map((day) => {
                                        const dailyTotalIncentive = (day.incentives?.daily || 0) + (day.incentives?.monthly || 0) + (day.incentives?.package || 0) + (day.incentives?.giftCard || 0);
                                        return (
                                            <div key={day.date} className="p-3 rounded-lg hover:bg-slate-50 border border-slate-100">
                                                <div className="font-semibold flex items-center text-sm mb-3 text-slate-700"><CalendarDays className="w-4 h-4 mr-2 text-indigo-500" />{format(parseISO(day.date), 'dd MMM, yyyy')}</div>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs mb-2">
                                                    <div className="p-2 rounded-md bg-blue-100 text-blue-800"><p className="font-bold">{formatCurrency(day.serviceSales)}</p><p className="text-[10px] uppercase">Service</p></div>
                                                    <div className="p-2 rounded-md bg-purple-100 text-purple-800"><p className="font-bold">{formatCurrency(day.productSales)}</p><p className="text-[10px] uppercase">Product</p></div>
                                                    <div className="p-2 rounded-md bg-amber-100 text-amber-800"><p className="font-bold">{formatCurrency(day.packageSales || 0)}</p><p className="text-[10px] uppercase">Package</p></div>
                                                    <div className="p-2 rounded-md bg-rose-100 text-rose-800"><p className="font-bold">{formatCurrency(day.giftCardSales || 0)}</p><p className="text-[10px] uppercase">Gift Card</p></div>
                                                </div>
                                                <div className="grid grid-cols-4 gap-2 text-center text-xs mb-2">
                                                    <div className="p-2 rounded-md bg-slate-100 text-slate-800"><p className="font-bold">{(day.rates?.daily || 0).toFixed(2)}</p><p className="text-[10px] uppercase">Daily Rate</p></div>
                                                    <div className="p-2 rounded-md bg-slate-100 text-slate-800"><p className="font-bold">{(day.rates?.monthly || 0).toFixed(2)}</p><p className="text-[10px] uppercase">Monthly Rate</p></div>
                                                    <div className="p-2 rounded-md bg-slate-100 text-slate-800"><p className="font-bold">{(day.rates?.package || 0).toFixed(2)}</p><p className="text-[10px] uppercase">Package Rate</p></div>
                                                    <div className="p-2 rounded-md bg-slate-100 text-slate-800"><p className="font-bold">{(day.rates?.giftCard || 0).toFixed(2)}</p><p className="text-[10px] uppercase">GiftCard Rate</p></div>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
                                                   <div className="p-2 rounded-md bg-teal-100 text-teal-800"><p className="font-bold">{day.customersServed}</p><p className="text-[10px] uppercase">Clients</p></div>
                                                   <div className="p-2 rounded-md bg-indigo-100 text-indigo-800"><p className="font-bold">{formatCurrency((day.serviceSales + day.productSales + day.packageSales + day.giftCardSales) / (day.customersServed || 1))}</p><p className="text-[10px] uppercase">ABV</p></div>
                                                   <div className="p-2 rounded-md bg-slate-100 text-slate-800"><p className="font-bold">{/* Daily Target might be added here if available */}</p><p className="text-[10px] uppercase">Target</p></div>
                                                   <div className={`p-2 rounded-md ${dailyTotalIncentive > 0 ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}><p className="font-bold">{formatCurrency(dailyTotalIncentive)}</p><p className="text-[10px] uppercase">Incentive</p></div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                ) : ( <p className="text-sm text-center text-slate-500 py-10">No daily records found for this period.</p> )}
                            </div>
                        </div>
                        }
                    </div>
                </div>
                </div>
            </ModalPortal>
        )}
    </div>
  );
};

export default PerformanceReport;