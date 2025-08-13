'use client';

import React, { 
    useState, 
    useEffect, 
    useMemo, 
    useRef,
    ReactNode 
} from 'react';
import { createPortal } from 'react-dom'; 
import { Search, Star, TrendingUp, Users, IndianRupee, X, CalendarDays, Sheet, FileDown, PieChart } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useSession } from 'next-auth/react';

// --- Imports for Charting ---
import { Doughnut } from 'react-chartjs-2'; 
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

// --- Interfaces ---
interface PerformanceData {
    staffId: string;
    staffIdNumber: string;
    name: string;
    position: string;
    image?: string;
    sales: number;
    customers: number;
    rating: number;
    totalServiceSales: number;
    totalProductSales: number;
}
interface SummaryData {
    averageRating: string;
    totalCustomers: number;
    revenueGenerated: number;
    avgServiceQuality: string;
}
interface DailyPerformanceRecord {
  date: string;
  serviceSales: number;
  productSales: number;
  customersServed: number;
  rating: number;
}
interface IncentiveReportData {
    dailyReport: any[];
    monthlyReport: any[];
    staffSummary: any[];
}

const CHART_COLORS = [ '#4f46e5', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6' ];

// --- UI Helper Components (Unchanged) ---
const SummaryCardSkeleton: React.FC = () => ( <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 animate-pulse"><div className="flex items-center"><div className="w-12 h-12 rounded-full bg-gray-200 mr-4"></div><div className="space-y-2 flex-1"><div className="h-6 bg-gray-300 rounded w-1/2"></div><div className="h-4 bg-gray-200 rounded w-1/3"></div></div></div></div> );
const SummaryCard: React.FC<{ icon: ReactNode; title: string; value: string | number; subValue?: string; iconBgColor: string; bgIconColor: string; }> = ({ icon, title, value, subValue, iconBgColor, bgIconColor }) => ( <div className="relative bg-white p-5 rounded-xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden"><div className={`absolute -right-4 -bottom-5 ${bgIconColor} opacity-70`}>{React.cloneElement(icon as React.ReactElement, { size: 96, strokeWidth: 1 })}</div><div className="relative z-10"><div className={`p-3 rounded-lg inline-block ${iconBgColor}`}>{React.cloneElement(icon as React.ReactElement, { size: 24 })}</div><p className="mt-4 text-sm text-gray-500">{title}</p><p className="text-2xl font-bold text-gray-800">{value}</p>{subValue && <p className="text-lg text-gray-800 font-bold">{subValue}</p>}</div></div> );
const ModalPortal: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  return mounted ? createPortal(children, document.body) : null;
};

// --- Pie Chart Components ---
const PerformancePieChart: React.FC<{ data: PerformanceData[] }> = ({ data }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;
    const sortedData = [...data].sort((a, b) => b.sales - a.sales);
    const topPerformers = sortedData.slice(0, 5);
    const othersSales = sortedData.slice(5).reduce((sum, staff) => sum + staff.sales, 0);
    const labels = topPerformers.map(staff => staff.name);
    const salesData = topPerformers.map(staff => staff.sales);
    if (othersSales > 0) {
      labels.push('Others');
      salesData.push(othersSales);
    }
    return { labels, datasets: [{ label: 'Total Sales', data: salesData, backgroundColor: CHART_COLORS, borderColor: '#ffffff', borderWidth: 2, hoverOffset: 8 }] };
  }, [data]);
  if (!chartData) return null;
  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-lg font-bold text-gray-800 flex items-center mb-4"><PieChart className="mr-2 text-indigo-500" size={20}/>Sales Contribution by Staff</h3>
      <div className="relative h-80 w-full">
        <Doughnut data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }} />
      </div>
    </div>
  );
};
const IncentivePieChart: React.FC<{ data: any[], chartRef: React.RefObject<any> }> = ({ data, chartRef }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;
    const filteredData = data.filter(staff => parseFloat(staff['Total Incentive (₹)']) > 0);
    if (filteredData.length === 0) return null;
    const labels = filteredData.map(staff => staff['Staff Name']);
    const incentiveData = filteredData.map(staff => parseFloat(staff['Total Incentive (₹)']));
    return { labels, datasets: [{ label: 'Total Incentive (₹)', data: incentiveData, backgroundColor: CHART_COLORS.slice().reverse(), borderColor: '#ffffff', borderWidth: 2, hoverOffset: 8 }] };
  }, [data]);
  if (!chartData) return null;
  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-lg font-bold text-gray-800 flex items-center mb-4"><PieChart className="mr-2 text-teal-500" size={20}/>Incentive Contribution by Staff</h3>
      <div className="relative h-80 w-full">
        <Doughnut ref={chartRef} data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }} />
      </div>
    </div>
  );
};

// --- Main Performance Page Component ---
const PerformancePage: React.FC = () => {
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentMonthIndex, setCurrentMonthIndex] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [incentiveReportData, setIncentiveReportData] = useState<IncentiveReportData | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<PerformanceData | null>(null);
  const [staffDailyPerformance, setStaffDailyPerformance] = useState<DailyPerformanceRecord[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  
  const months = useMemo(() => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], []);
  const incentiveChartRef = useRef(null);

  const today = new Date();
  const reportDate = format(today, 'dd-MM-yyyy');
  const isViewingCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonthIndex;
  const daysInSelectedMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const daysEnded = isViewingCurrentMonth ? today.getDate() : daysInSelectedMonth;
  const projectionDays = daysInSelectedMonth;

  useEffect(() => {
    const fetchAllData = async () => {
      if (!session?.user?.tenantId) return;
      setIsLoading(true);
      setError(null);
      setIncentiveReportData(null);
      
      const month = currentMonthIndex + 1;
      const startDate = new Date(currentYear, currentMonthIndex, 1).toISOString().split('T')[0];
      const endDate = new Date(currentYear, currentMonthIndex + 1, 0).toISOString().split('T')[0];
      const tenantId = session.user.tenantId;

      try {
        const [performanceRes, incentiveRes] = await Promise.all([
          fetch(`/api/performance?month=${month}&year=${currentYear}`, { headers: { 'x-tenant-id': tenantId } }),
          fetch('/api/incentives/report', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
            body: JSON.stringify({ startDate, endDate })
          })
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
      } catch (err: any) { 
        setError(err.message); 
      } finally { 
        setIsLoading(false); 
      }
    };
    fetchAllData();
  }, [currentMonthIndex, currentYear, session]);

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
  
  const handleOpenDetails = async (staff: PerformanceData) => {
    if (!session?.user?.tenantId) { setErrorDetails('Session not found.'); return; }
    setSelectedStaff(staff);
    setIsLoadingDetails(true);
    setErrorDetails(null);
    setStaffDailyPerformance([]);
    try {
      const month = currentMonthIndex + 1;
      const response = await fetch(`/api/performance?staffId=${staff.staffId}&month=${month}&year=${currentYear}`, {
          headers: { 'x-tenant-id': session.user.tenantId }
      });
      if (!response.ok) throw new Error('Could not fetch daily details.');
      const data = await response.json();
      if (!data.success) throw new Error(data.message || 'API error fetching details.');
      setStaffDailyPerformance(data.details || []);
    } catch (err: any) { 
      setErrorDetails(err.message); 
    } finally { 
      setIsLoadingDetails(false); 
    }
  };
  const handleCloseDetails = () => setSelectedStaff(null);
  
  const panelSummary = useMemo(() => {
    if (!staffDailyPerformance.length) return { totalSales: 0, totalCustomers: 0 };
    const totalSales = staffDailyPerformance.reduce((sum, day) => sum + day.serviceSales + day.productSales, 0);
    const totalCustomers = staffDailyPerformance.reduce((sum, day) => sum + day.customersServed, 0);
    return { totalSales, totalCustomers };
  }, [staffDailyPerformance]);
  
  const modalIncentiveSummary = useMemo(() => {
    if (!selectedStaff || !incentiveReportData?.monthlyReport || !incentiveReportData?.dailyReport) {
      return { monthlyTarget: 0, monthlyAchieved: 0 };
    }
    const monthStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}`;
    const staffMonthlyRecord = incentiveReportData.monthlyReport.find(
      (rec) => rec['Staff Name'] === selectedStaff.name && rec['Month'] === monthStr
    );
    const totalDailyIncentive = incentiveReportData.dailyReport
      .filter(d => d['Staff Name'] === selectedStaff.name)
      .reduce((sum, day) => sum + parseFloat(day['Incentive (₹)']), 0);
    return {
      monthlyTarget: staffMonthlyRecord ? parseFloat(staffMonthlyRecord['Target (₹)']) : 0,
      monthlyAchieved: totalDailyIncentive,
    };
  }, [selectedStaff, incentiveReportData, currentMonthIndex, currentYear]);

  const topPerformersSummary = useMemo(() => {
    if (!performanceData || performanceData.length === 0) {
      return { topService: { name: 'N/A', value: 0 }, topProduct: { name: 'N/A', value: 0 } };
    }
    const topService = [...performanceData].sort((a, b) => b.totalServiceSales - a.totalServiceSales)[0];
    const topProduct = [...performanceData].sort((a, b) => b.totalProductSales - a.totalProductSales)[0];
    return {
      topService: { name: topService.name, value: topService.totalServiceSales },
      topProduct: { name: topProduct.name, value: topProduct.totalProductSales },
    };
  }, [performanceData]);

  const formatCurrency = (value: number | string) => `₹${Math.round(Number(value)).toLocaleString('en-IN')}`;
  const yearOptions = useMemo(() => Array.from({ length: new Date().getFullYear() - 2020 + 1 }, (_, i) => new Date().getFullYear() - i), []);

  // ✅ FIX: This function is now restored to its original state.
  const getExportData = () => {
    const headers = ["S.NO", "employee name", "employee code", "client count", "ABV", "service net sales", "product sales", "total sales", "total sales heading to", "No of Clients Heading To"];
    const body = filteredStaffPerformance.map((staff, index) => {
      const abv = staff.customers > 0 ? staff.sales / staff.customers : 0;
      const projectedSales = daysEnded > 0 ? (staff.sales / daysEnded) * projectionDays : 0;
      const projectedClients = daysEnded > 0 ? (staff.customers / daysEnded) * projectionDays : 0;
      return [index + 1, staff.name, staff.staffIdNumber, staff.customers, Math.round(abv), staff.totalServiceSales, staff.totalProductSales, staff.sales, Math.round(projectedSales), Math.round(projectedClients)];
    });
    const totalsRow = ["", "GRAND TOTAL", "", grandTotals.totalClients, Math.round(grandTotals.avgAbv), grandTotals.totalServiceSales, grandTotals.totalProductSales, Math.round(grandTotals.totalSales), Math.round(grandTotals.projectedSales), Math.round(grandTotals.projectedClients)];
    return { headers, body, totalsRow };
  };

  // ✅ FIX: This function now only exports the performance table.
  const handleDownloadExcel = () => {
    const { headers, body, totalsRow } = getExportData();
    const wb = XLSX.utils.book_new();
    const wsPerf = XLSX.utils.aoa_to_sheet([headers, ...body, totalsRow]);
    wsPerf['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsPerf, "Performance Report");
    XLSX.writeFile(wb, `Performance_Report_${months[currentMonthIndex]}_${currentYear}.xlsx`);
  };

  // ✅ FIX: This function now only exports the performance table.
  const handleDownloadPdf = () => {
    const { headers, body, totalsRow } = getExportData();
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18); doc.text(`Performance Report - ${months[currentMonthIndex]} ${currentYear}`, 14, 20);
    doc.setFontSize(11); doc.setTextColor(100); doc.text(`Report generated on: ${format(new Date(), 'dd-MM-yyyy')}`, 14, 26);
    autoTable(doc, { head: [headers], body, foot: [totalsRow], startY: 30, theme: 'grid', headStyles: { fillColor: [22, 160, 133], fontSize: 8 }, footStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: 'bold' }, styles: { fontSize: 8, cellPadding: 2 } });
    doc.save(`Performance_Report_${months[currentMonthIndex]}_${currentYear}.pdf`);
  };

  return (
    <div className="bg-gray-50 min-h-screen p-4 sm:p-6 lg:p-8 space-y-8">
      {/* --- HEADER --- */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Performance Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-500 mt-1">An overview for {months[currentMonthIndex]} {currentYear}.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2">
                <select value={currentMonthIndex} onChange={(e) => setCurrentMonthIndex(Number(e.target.value))} className="bg-white border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {months.map((month, index) => (<option key={index} value={index}>{month}</option>))}
                </select>
                <select value={currentYear} onChange={(e) => setCurrentYear(Number(e.target.value))} className="bg-white border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {yearOptions.map(year => (<option key={year} value={year}>{year}</option>))}
                </select>
            </div>
            <div className="relative w-full sm:w-auto sm:min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="Search staff..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-full bg-white pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={handleDownloadPdf} className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"><FileDown size={16} /><span>PDF</span></button>
                <button onClick={handleDownloadExcel} className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"><Sheet size={16} /><span>Excel</span></button>
            </div>
        </div>
      </header>
      
      {/* --- SUMMARY CARDS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? <><SummaryCardSkeleton /><SummaryCardSkeleton /><SummaryCardSkeleton /><SummaryCardSkeleton /></> : 
         error ? <div className="col-span-full text-center p-10 bg-white rounded-xl shadow-sm text-red-500">{error}</div> :
          <>
            <SummaryCard icon={<Users className="text-teal-600" />} title="Total Customers" value={summaryData?.totalCustomers || 0} iconBgColor="bg-teal-100" bgIconColor="text-teal-100"/>
            <SummaryCard icon={<IndianRupee className="text-green-600" />} title="Revenue Generated" value={formatCurrency(summaryData?.revenueGenerated || 0)} iconBgColor="bg-green-100" bgIconColor="text-green-100"/>
            <SummaryCard icon={<Star className="text-amber-600" />} title="Top Service Earner" value={formatCurrency(topPerformersSummary.topService.value)} subValue={topPerformersSummary.topService.name} iconBgColor="bg-amber-100" bgIconColor="text-amber-100"/>
            <SummaryCard icon={<TrendingUp className="text-indigo-600" />} title="Top Product Earner" value={formatCurrency(topPerformersSummary.topProduct.value)} subValue={topPerformersSummary.topProduct.name} iconBgColor="bg-indigo-100" bgIconColor="text-indigo-100"/>
          </>
        }
      </div>
      
      {/* --- MAIN CONTENT AREA --- */}
      <div className="space-y-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 sm:p-6 border-b border-gray-200 text-center">
            <div className="text-lg sm:text-xl font-bold text-gray-800 uppercase tracking-wider">Staff Service Sales and ABV Report</div>
             <div className="flex items-center justify-center gap-4 mt-3">
                <span className="inline-flex items-center gap-x-1.5 py-1.5 px-3 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Date: {reportDate}</span>
                <span className="inline-flex items-center gap-x-1.5 py-1.5 px-3 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Days Ended: {daysEnded}</span>
            </div>
          </div>
          <div className="hidden md:block p-4 space-y-2">
            <div className="flex items-center px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50 rounded-lg">
                <div className="w-[4%] text-center">S.NO</div>
                <div className="w-[8%] text-center">STAFF ID</div>
                <div className="w-[15%]">Staff Name</div>
                <div className="w-[12%] text-right">Total Sales</div>
                <div className="w-[11%] text-center">No of Clients</div>
                <div className="w-[12%] text-right">ABV</div>
                <div className="w-[19%] text-center">Total Sales Heading To</div>
                <div className="w-[19%] text-center">No of Clients Heading To</div>
            </div>
            {isLoading ? (<div className="text-center p-10 text-gray-500">Loading...</div>) : 
             error ? (<div className="text-center p-10 text-red-500">{error}</div>) :
             (<>
                {filteredStaffPerformance.map((staff, index) => {
                    const abv = staff.customers > 0 ? staff.sales / staff.customers : 0;
                    const projectedSales = daysEnded > 0 ? (staff.sales / daysEnded) * projectionDays : 0;
                    const projectedClients = daysEnded > 0 ? (staff.customers / daysEnded) * projectionDays : 0;
                    return (
                        <div key={staff.staffId} onClick={() => handleOpenDetails(staff)} className="flex items-center p-4 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer">
                            <div className="w-[4%] text-sm font-medium text-gray-500 text-center">{index + 1}.</div>
                            <div className="w-[8%] text-sm font-semibold text-gray-600 text-center">{staff.staffIdNumber}</div>
                            <div className="w-[15%] text-sm font-semibold text-gray-800">{staff.name}</div>
                            <div className="w-[12%] text-sm text-gray-700 text-right">{formatCurrency(staff.sales)}</div>
                            <div className="w-[11%] text-sm text-gray-700 text-center">{staff.customers}</div>
                            <div className="w-[12%] text-sm text-indigo-600 font-bold text-right">{formatCurrency(abv)}</div>
                            <div className="w-[19%] text-center"><span className="inline-flex w-28 justify-center items-center py-1 px-2.5 rounded-full text-xs font-bold bg-green-100 text-green-800">{formatCurrency(projectedSales)}</span></div>
                            <div className="w-[19%] text-center"><span className="inline-flex w-28 justify-center items-center py-1 px-2.5 rounded-full text-xs font-bold bg-green-100 text-green-800">{Math.round(projectedClients)}</span></div>
                        </div>
                    );
                })}
                <div className="flex items-center p-4 mt-2 font-bold text-gray-800 bg-slate-100 rounded-lg border-t-2 border-slate-200">
                    <div className="w-[4%]"></div>
                    <div className="w-[8%]"></div>
                    <div className="w-[15%] text-sm uppercase tracking-wider">Grand Total</div>
                    <div className="w-[12%] text-sm text-right">{formatCurrency(grandTotals.totalSales)}</div>
                    <div className="w-[11%] text-sm text-center">{grandTotals.totalClients}</div>
                    <div className="w-[12%] text-sm text-right text-indigo-700">{formatCurrency(grandTotals.avgAbv)}</div>
                    <div className="w-[19%] text-sm text-center">{formatCurrency(grandTotals.projectedSales)}</div>
                    <div className="w-[19%] text-sm text-center">{Math.round(grandTotals.projectedClients)}</div>
                </div>
             </>)
            }
          </div>
          <div className="block md:hidden p-4 space-y-4"></div>
          <div className="p-3 text-xs text-center text-gray-600 bg-slate-50 rounded-b-lg border-t border-gray-200 uppercase">
            TOTAL SALES HEADING TO MEANS THE ESTIMATED SALES YOU ARE GOING TO REACH BY THE END OF THE MONTH...
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <PerformancePieChart data={performanceData} />
          {incentiveReportData && <IncentivePieChart data={incentiveReportData.staffSummary} chartRef={incentiveChartRef} />}
        </div>
      </div>
      
      {selectedStaff && (
        <ModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60" onClick={handleCloseDetails}>
              <div className="relative w-full max-w-3xl max-h-[90vh] bg-gray-50 rounded-2xl shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b bg-white rounded-t-2xl">
                  <h2 className="text-lg font-semibold text-gray-800">Performance & Incentive Details</h2>
                  <button onClick={handleCloseDetails} className="p-1 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100"><X size={24} /></button>
                </header>
                <div className="flex-grow p-4 sm:p-6 overflow-y-auto">
                    <div className="space-y-6">
                        <div className="flex items-center p-4 bg-white rounded-xl shadow-sm border">
                            {selectedStaff.image ? (<img className="h-20 w-20 rounded-full object-cover" src={selectedStaff.image} alt={selectedStaff.name} />) : (<div className="h-20 w-20 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-3xl font-bold">{selectedStaff.name.charAt(0)}</div>)}
                            <div className="ml-5">
                                <h3 className="text-xl font-bold text-gray-900">{selectedStaff.name}</h3>
                                <p className="text-sm text-gray-600">{selectedStaff.position}</p>
                            </div>
                        </div>
                        
                        <div className="bg-white p-4 rounded-xl shadow-sm border">
                            <h4 className="text-md font-semibold text-gray-800 mb-3">Summary for {months[currentMonthIndex]}</h4>
                            {isLoadingDetails ? (<div className="py-4 text-center">Loading...</div>) : 
                            errorDetails ? (<div className="py-4 text-center text-red-500">{errorDetails}</div>) :
                            (<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-center">
                                <div><p className="text-lg font-bold text-green-600">{formatCurrency(panelSummary.totalSales)}</p><p className="text-xs text-gray-500">Total Sales</p></div>
                                <div><p className="text-lg font-bold text-teal-600">{panelSummary.totalCustomers}</p><p className="text-xs text-gray-500">Customers</p></div>
                                <div><p className="text-lg font-bold text-blue-600">{formatCurrency(modalIncentiveSummary.monthlyTarget)}</p><p className="text-xs text-gray-500">Incentive Target</p></div>
                                <div><p className="text-lg font-bold text-purple-600">{formatCurrency(modalIncentiveSummary.monthlyAchieved)}</p><p className="text-xs text-gray-500">Incentive Achieved</p></div>
                            </div>)
                            }
                        </div>
                        
                        <div className="bg-white p-2 rounded-xl shadow-sm border max-h-80 overflow-y-auto">
                            <h4 className="text-md font-semibold text-gray-800 mb-3 px-1">Daily Breakdown</h4>
                            {isLoadingDetails ? (<div className="py-10 text-center">Loading...</div>) :
                            errorDetails ? (<div className="py-10 text-center text-red-500">{errorDetails}</div>) :
                            staffDailyPerformance.length > 0 ? (
                            <div className="space-y-2">
                                {staffDailyPerformance.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((day) => {
                                    const dailyTotalSales = day.serviceSales + day.productSales;
                                    const dailyAbv = day.customersServed > 0 ? Math.round(dailyTotalSales / day.customersServed) : 0;
                                    const incentiveDay = incentiveReportData?.dailyReport.find(inc => inc.Date === day.date.split('T')[0] && inc['Staff Name'] === selectedStaff.name);
                                    return (
                                        <div key={day.date} className="p-3 rounded-lg hover:bg-gray-50 border-b last:border-b-0">
                                            <div className="font-semibold flex items-center text-sm mb-3">
                                                <CalendarDays className="w-4 h-4 mr-2 text-indigo-500" />
                                                {format(parseISO(day.date), 'dd MMM, yyyy')}
                                            </div>
                                            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 text-center text-xs">
                                                <div className="p-2 rounded-md bg-blue-50 text-blue-800"><p className="font-bold">{formatCurrency(day.serviceSales)}</p><p className="text-[10px] uppercase">Service</p></div>
                                                <div className="p-2 rounded-md bg-purple-50 text-purple-800"><p className="font-bold">{formatCurrency(day.productSales)}</p><p className="text-[10px] uppercase">Product</p></div>
                                                <div className="p-2 rounded-md bg-teal-50 text-teal-800"><p className="font-bold">{day.customersServed}</p><p className="text-[10px] uppercase">Clients</p></div>
                                                <div className="p-2 rounded-md bg-indigo-50 text-indigo-800"><p className="font-bold">{formatCurrency(dailyAbv)}</p><p className="text-[10px] uppercase">ABV</p></div>
                                                <div className="p-2 rounded-md bg-gray-100 text-gray-800"><p className="font-bold">{incentiveDay ? formatCurrency(incentiveDay['Target (₹)']) : 'N/A'}</p><p className="text-[10px] uppercase">Target</p></div>
                                                <div className="p-2 rounded-md bg-gray-100 text-gray-800"><p className="font-bold">{incentiveDay ? incentiveDay['Applied Rate'] : 'N/A'}</p><p className="text-[10px] uppercase">Rate</p></div>
                                                <div className="p-2 rounded-md bg-green-100 text-green-800"><p className="font-bold">{incentiveDay ? formatCurrency(incentiveDay['Incentive (₹)']) : 'N/A'}</p><p className="text-[10px] uppercase">Incentive</p></div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            ) : ( <p className="text-sm text-center py-10">No daily performance records found.</p> )}
                        </div>
                    </div>
                </div>
              </div>
            </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default PerformancePage;