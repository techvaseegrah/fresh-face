'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Star, TrendingUp, Users, IndianRupee, Sheet, FileDown, PieChart } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useSession } from 'next-auth/react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';

ChartJS.register(ArcElement, Tooltip, Legend);

// --- Interfaces ---
interface PerformanceData { staffId: string; staffIdNumber: string; name: string; position: string; image?: string; sales: number; customers: number; rating: number; totalServiceSales: number; totalProductSales: number; }
interface SummaryData { averageRating: string; totalCustomers: number; revenueGenerated: number; avgServiceQuality: string; }
interface IncentiveReportData { dailyReport: any[]; monthlyReport: any[]; staffSummary: any[]; }
const CHART_COLORS = [ '#4f46e5', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#64748b', '#14b8a6', '#f97316', '#a855f7' ];

// --- UI Helper Components ---
const SummaryCard: React.FC<{ icon: React.ReactNode; title: string; value: string | number; subValue?: string; iconBgColor: string; bgIconColor: string; }> = ({ icon, title, value, subValue, iconBgColor, bgIconColor }) => ( <div className="relative bg-white p-5 rounded-xl shadow-sm border border-slate-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden"><div className={`absolute -right-4 -bottom-5 ${bgIconColor} opacity-50`}>{React.cloneElement(icon as React.ReactElement, { size: 96, strokeWidth: 1 })}</div><div className="relative z-10"><div className={`p-3 rounded-lg inline-block ${iconBgColor}`}>{React.cloneElement(icon as React.ReactElement, { size: 24 })}</div><p className="mt-4 text-sm text-slate-500">{title}</p><p className="text-2xl font-bold text-slate-800">{value}</p>{subValue && <p className="text-lg text-slate-800 font-semibold">{subValue}</p>}</div></div> );
const PerformancePieChart: React.FC<{ data: PerformanceData[] }> = ({ data }) => { const chartData = useMemo(() => { if (!data || data.length === 0) return null; const sortedData = [...data].sort((a, b) => b.sales - a.sales); const labels = sortedData.map(staff => staff.name); const salesData = sortedData.map(staff => staff.sales); return { labels, datasets: [{ label: 'Total Sales', data: salesData, backgroundColor: CHART_COLORS, borderColor: '#ffffff', borderWidth: 2, hoverOffset: 8 }] }; }, [data]); if (!chartData) return null; return ( <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-100"><h3 className="text-lg font-bold text-slate-800 flex items-center mb-4"><PieChart className="mr-2 text-indigo-500" size={20}/>Sales Contribution</h3><div className="relative h-64 sm:h-80 w-full"><Doughnut data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }} /></div></div> ); };
// --- FIX: Incentive Chart Component is now included ---
const IncentivePieChart: React.FC<{ data: any[] }> = ({ data }) => { const chartData = useMemo(() => { if (!data || data.length === 0) return null; const filteredData = data.filter(staff => parseFloat(staff['Total Incentive (₹)']) > 0); if (filteredData.length === 0) return null; const labels = filteredData.map(staff => staff['Staff Name']); const incentiveData = filteredData.map(staff => parseFloat(staff['Total Incentive (₹)'])); return { labels, datasets: [{ label: 'Total Incentive (₹)', data: incentiveData, backgroundColor: CHART_COLORS.slice().reverse(), borderColor: '#ffffff', borderWidth: 2, hoverOffset: 8 }] }; }, [data]); if (!chartData) return null; return ( <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-100"><h3 className="text-lg font-bold text-slate-800 flex items-center mb-4"><PieChart className="mr-2 text-teal-500" size={20}/>Incentive Contribution</h3><div className="relative h-64 sm:h-80 w-full"><Doughnut data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }} /></div></div> ); };


// --- Main Report Component ---
const PerformanceReport: React.FC = () => {
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());
  
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  // --- FIX: Added state for incentive data ---
  const [incentiveReportData, setIncentiveReportData] = useState<IncentiveReportData | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    setIncentiveReportData(null); // Reset incentive data on new fetch

    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');
    const tenantId = session.user.tenantId;

    try {
      // --- FIX: Fetch both performance and incentive data in parallel ---
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
  
  // --- FIX: Restored full download logic ---
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
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
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isLoading || filteredStaffPerformance.length === 0}><FileDown size={16} className="mr-2 text-red-600"/>PDF</Button>
                <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={isLoading || filteredStaffPerformance.length === 0}><Sheet size={16} className="mr-2 text-green-600"/>Excel</Button>
            </div>
        </div>

        <div className="overflow-x-auto">
          {/* Desktop Table */}
          <table className="min-w-full hidden md:table">
            <thead className="bg-slate-50"><tr><th className="p-4 text-left text-xs font-semibold text-slate-500 uppercase">Staff</th><th className="p-4 text-right text-xs font-semibold text-slate-500 uppercase">Total Sales</th><th className="p-4 text-center text-xs font-semibold text-slate-500 uppercase">Clients</th><th className="p-4 text-right text-xs font-semibold text-slate-500 uppercase">ABV</th><th className="p-4 text-right text-xs font-semibold text-slate-500 uppercase">Projected Sales</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
                {isLoading ? <tr><td colSpan={5} className="text-center p-10">Loading...</td></tr> : 
                 filteredStaffPerformance.map(staff => {
                    const abv = staff.customers > 0 ? staff.sales / staff.customers : 0;
                    const projectedSales = daysEnded > 0 ? (staff.sales / daysEnded) * projectionDays : 0;
                    return (
                        <tr key={staff.staffId} className="hover:bg-slate-50">
                            <td className="p-4"><div className="flex items-center"><p className="font-semibold">{staff.name}</p></div></td>
                            <td className="p-4 text-right font-semibold">{formatCurrency(staff.sales)}</td>
                            <td className="p-4 text-center">{staff.customers}</td>
                            <td className="p-4 text-right text-indigo-600 font-bold">{formatCurrency(abv)}</td>
                            <td className="p-4 text-right text-green-600">{formatCurrency(projectedSales)}</td>
                        </tr>
                    );
                 })}
                 <tr className="bg-slate-100 font-bold">
                    <td className="p-4">GRAND TOTAL</td><td className="p-4 text-right">{formatCurrency(grandTotals.totalSales)}</td><td className="p-4 text-center">{grandTotals.totalClients}</td>
                    <td className="p-4 text-right">{formatCurrency(grandTotals.avgAbv)}</td><td className="p-4 text-right">{formatCurrency(grandTotals.projectedSales)}</td>
                 </tr>
            </tbody>
          </table>
          {/* Mobile View */}
          <div className="md:hidden divide-y divide-slate-100">{/* ... Mobile view JSX ... */}</div>
        </div>
        
        {/* --- FIX: Grid for two charts --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
          <PerformancePieChart data={performanceData} />
          {incentiveReportData && <IncentivePieChart data={incentiveReportData.staffSummary} />}
        </div>
      </Card>
    </div>
  );
};

export default PerformanceReport;