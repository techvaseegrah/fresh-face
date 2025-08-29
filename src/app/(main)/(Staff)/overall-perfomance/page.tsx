'use client';

import React, {
    useState,
    useEffect,
    useMemo,
    useRef,
    ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import { Search, Star, TrendingUp, Users, IndianRupee, X, CalendarDays, PieChart } from 'lucide-react';
import { format, parseISO, startOfMonth } from 'date-fns';
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

const CHART_COLORS = [ '#4f46e5', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#64748b', '#14b8a6', '#f97316', '#a855f7' ];

// --- UI Helper Components ---
const SummaryCardSkeleton: React.FC = () => ( <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 animate-pulse"><div className="flex items-center"><div className="w-12 h-12 rounded-full bg-slate-200 mr-4"></div><div className="space-y-2 flex-1"><div className="h-6 bg-slate-300 rounded w-1/2"></div><div className="h-4 bg-slate-200 rounded w-1/3"></div></div></div></div> );
const SummaryCard: React.FC<{ icon: ReactNode; title: string; value: string | number; subValue?: string; iconBgColor: string; bgIconColor: string; }> = ({ icon, title, value, subValue, iconBgColor, bgIconColor }) => ( <div className="relative bg-white p-5 rounded-xl shadow-sm border border-slate-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden"><div className={`absolute -right-4 -bottom-5 ${bgIconColor} opacity-50`}>{React.cloneElement(icon as React.ReactElement, { size: 96, strokeWidth: 1 })}</div><div className="relative z-10"><div className={`p-3 rounded-lg inline-block ${iconBgColor}`}>{React.cloneElement(icon as React.ReactElement, { size: 24 })}</div><p className="mt-4 text-sm text-slate-500">{title}</p><p className="text-2xl font-bold text-slate-800">{value}</p>{subValue && <p className="text-lg text-slate-800 font-semibold">{subValue}</p>}</div></div> );
const ModalPortal: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  return mounted ? createPortal(children, document.body) : null;
};

// --- Pie Chart Components ---
const PerformancePieChart: React.FC<{ data: PerformanceData[] }> = ({ data }) => { const chartData = useMemo(() => { if (!data || data.length === 0) return null; const sortedData = [...data].sort((a, b) => b.sales - a.sales); const labels = sortedData.map(staff => staff.name); const salesData = sortedData.map(staff => staff.sales); return { labels, datasets: [{ label: 'Total Sales', data: salesData, backgroundColor: CHART_COLORS, borderColor: '#ffffff', borderWidth: 2, hoverOffset: 8 }] }; }, [data]); if (!chartData) return null; return ( <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-100"><h3 className="text-lg font-bold text-slate-800 flex items-center mb-4"><PieChart className="mr-2 text-indigo-500" size={20}/>Sales Contribution by Staff</h3><div className="relative h-64 sm:h-80 w-full"><Doughnut data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, animation: { animateScale: true, animateRotate: true } }} /></div></div> ); };
const IncentivePieChart: React.FC<{ data: any[], chartRef: React.RefObject<any> }> = ({ data, chartRef }) => { const chartData = useMemo(() => { if (!data || data.length === 0) return null; const filteredData = data.filter(staff => parseFloat(staff['Total Incentive (₹)']) > 0); if (filteredData.length === 0) return null; const labels = filteredData.map(staff => staff['Staff Name']); const incentiveData = filteredData.map(staff => parseFloat(staff['Total Incentive (₹)'])); return { labels, datasets: [{ label: 'Total Incentive (₹)', data: incentiveData, backgroundColor: CHART_COLORS.slice().reverse(), borderColor: '#ffffff', borderWidth: 2, hoverOffset: 8 }] }; }, [data]); if (!chartData) return null; return ( <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-100"><h3 className="text-lg font-bold text-slate-800 flex items-center mb-4"><PieChart className="mr-2 text-teal-500" size={20}/>Incentive Contribution by Staff</h3><div className="relative h-64 sm:h-80 w-full"><Doughnut ref={chartRef} data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, animation: { animateScale: true, animateRotate: true } }} /></div></div> ); };

// --- Main Performance Page Component ---
const PerformancePage: React.FC = () => {
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());
  
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [incentiveReportData, setIncentiveReportData] = useState<IncentiveReportData | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedStaff, setSelectedStaff] = useState<PerformanceData | null>(null);
  const [staffDailyPerformance, setStaffDailyPerformance] = useState<DailyPerformanceRecord[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const incentiveChartRef = useRef(null);

  const today = new Date();
  const isViewingCurrentMonth = today.getFullYear() === endDate.getFullYear() && today.getMonth() === endDate.getMonth();
  const daysInSelectedMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
  const daysEnded = isViewingCurrentMonth ? today.getDate() : daysInSelectedMonth;
  const projectionDays = daysInSelectedMonth;

  useEffect(() => {
    const fetchAllData = async () => {
      if (!session?.user?.tenantId || !startDate || !endDate) return;
      if (startDate > endDate) { setError("Start date cannot be after the end date."); setIsLoading(false); return; }
      
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

        if (incentiveRes.ok) { const incData = await incentiveRes.json(); if (incData.success) setIncentiveReportData(incData.data); } 
        else { console.warn("Could not fetch incentive data."); }
      } catch (err: any) { setError(err.message); } 
      finally { setIsLoading(false); }
    };
    fetchAllData();
  }, [startDate, endDate, session]);

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
    if (!session?.user?.tenantId || !startDate || !endDate) { setErrorDetails('Session or date range not found.'); return; }
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

  const panelSummary = useMemo(() => { if (!staffDailyPerformance.length) return { totalSales: 0, totalCustomers: 0 }; const totalSales = staffDailyPerformance.reduce((sum, day) => sum + day.serviceSales + day.productSales, 0); const totalCustomers = staffDailyPerformance.reduce((sum, day) => sum + day.customersServed, 0); return { totalSales, totalCustomers }; }, [staffDailyPerformance]);
  const modalIncentiveSummary = useMemo(() => { if (!selectedStaff || !incentiveReportData?.monthlyReport || !incentiveReportData?.dailyReport) return { monthlyTarget: 0, monthlyAchieved: 0 }; const totalDailyIncentive = incentiveReportData.dailyReport.filter(d => d['Staff Name'] === selectedStaff.name).reduce((sum, day) => sum + parseFloat(day['Incentive (₹)'] || '0'), 0); const staffMonthlyRecord = incentiveReportData.monthlyReport.find((rec) => rec['Staff Name'] === selectedStaff.name); const monthlyTarget = staffMonthlyRecord ? parseFloat(staffMonthlyRecord['Target (₹)'] || '0') : 0; return { monthlyTarget, monthlyAchieved: totalDailyIncentive }; }, [selectedStaff, incentiveReportData]);
  const topPerformersSummary = useMemo(() => { if (!performanceData || performanceData.length === 0) return { topService: { name: 'N/A', value: 0 }, topProduct: { name: 'N/A', value: 0 } }; const topService = [...performanceData].sort((a, b) => b.totalServiceSales - a.totalServiceSales)[0]; const topProduct = [...performanceData].sort((a, b) => b.totalProductSales - a.totalProductSales)[0]; return { topService: { name: topService.name, value: topService.totalServiceSales }, topProduct: { name: topProduct.name, value: topProduct.totalProductSales } }; }, [performanceData]);
  
  const formatCurrency = (value: number | string) => `₹${Math.round(Number(value)).toLocaleString('en-IN')}`;
  
  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8 space-y-8">
      <header className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Performance Dashboard</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            Showing results from <strong>{format(startDate, 'dd MMM, yyyy')}</strong> to <strong>{format(endDate, 'dd MMM, yyyy')}</strong>.
          </p>
        </div>
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg p-2">
                 <input type="date" value={format(startDate, 'yyyy-MM-dd')} onChange={(e) => setStartDate(new Date(e.target.value))} className="bg-transparent w-full focus:outline-none text-sm"/>
                 <span className="text-slate-400 text-sm">to</span>
                 <input type="date" value={format(endDate, 'yyyy-MM-dd')} onChange={(e) => setEndDate(new Date(e.target.value))} className="bg-transparent w-full focus:outline-none text-sm"/>
            </div>
            <div className="relative w-full lg:w-auto lg:min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="text" placeholder="Search staff..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-full bg-white pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"/>
            </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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

      <div className="space-y-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="p-4 sm:p-6 border-b border-slate-200 text-center"><div className="text-lg sm:text-xl font-bold text-slate-800 uppercase tracking-wider">Staff Performance Report</div></div>
          <div className="overflow-x-auto">
            <div className="hidden md:block">
              <div className="flex items-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase bg-slate-100">
                <div className="w-[4%] text-center">S.No</div><div className="w-[8%] text-center">Staff ID</div><div className="w-[15%]">Staff Name</div><div className="w-[12%] text-right">Total Sales</div><div className="w-[11%] text-center">Clients</div><div className="w-[12%] text-right">ABV</div><div className="w-[19%] text-center">Projected Sales</div><div className="w-[19%] text-center">Projected Clients</div>
              </div>
              <div className="divide-y divide-slate-100">
                {isLoading ? (<div className="text-center p-10 text-slate-500">Loading...</div>) : error ? (<div className="text-center p-10 text-red-500">{error}</div>) :
                  <>
                    {filteredStaffPerformance.map((staff, index) => { const abv = staff.customers > 0 ? staff.sales / staff.customers : 0; const projectedSales = daysEnded > 0 ? (staff.sales / daysEnded) * projectionDays : 0; const projectedClients = daysEnded > 0 ? (staff.customers / daysEnded) * projectionDays : 0; return ( <div key={staff.staffId} onClick={() => handleOpenDetails(staff)} className="flex items-center p-4 hover:bg-indigo-50 transition-colors cursor-pointer"><div className="w-[4%] text-sm font-medium text-slate-500 text-center">{index + 1}.</div><div className="w-[8%] text-sm font-semibold text-slate-600 text-center">{staff.staffIdNumber}</div><div className="w-[15%] text-sm font-semibold text-slate-800 truncate">{staff.name}</div><div className="w-[12%] text-sm text-slate-700 text-right">{formatCurrency(staff.sales)}</div><div className="w-[11%] text-sm text-slate-700 text-center">{staff.customers}</div><div className="w-[12%] text-sm text-indigo-600 font-bold text-right">{formatCurrency(abv)}</div><div className="w-[19%] text-center"><span className="inline-flex w-32 justify-center items-center py-1 px-2.5 rounded-full text-xs font-bold bg-green-100 text-green-800">{formatCurrency(projectedSales)}</span></div><div className="w-[19%] text-center"><span className="inline-flex w-32 justify-center items-center py-1 px-2.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">{Math.round(projectedClients)} Clients</span></div></div> ); })}
                    <div className="flex items-center p-4 font-bold text-slate-800 bg-slate-100 border-t-2 border-slate-200"><div className="w-[4%]"></div><div className="w-[8%]"></div><div className="w-[15%] text-sm uppercase tracking-wider">Grand Total</div><div className="w-[12%] text-sm text-right">{formatCurrency(grandTotals.totalSales)}</div><div className="w-[11%] text-sm text-center">{grandTotals.totalClients}</div><div className="w-[12%] text-sm text-right text-indigo-700">{formatCurrency(grandTotals.avgAbv)}</div><div className="w-[19%] text-sm text-center">{formatCurrency(grandTotals.projectedSales)}</div><div className="w-[19%] text-sm text-center">{Math.round(grandTotals.projectedClients)}</div></div>
                  </>
                }
              </div>
            </div>
            <div className="md:hidden divide-y divide-slate-100">
                {isLoading ? (<div className="text-center p-10 text-slate-500">Loading...</div>) : error ? (<div className="text-center p-10 text-red-500">{error}</div>) :
                    filteredStaffPerformance.map((staff) => {
                        const abv = staff.customers > 0 ? staff.sales / staff.customers : 0;
                        return (
                            <div key={staff.staffId} onClick={() => handleOpenDetails(staff)} className="p-4 active:bg-indigo-50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-slate-800">{staff.name}</p>
                                        <p className="text-xs text-slate-500">ID: {staff.staffIdNumber}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-lg text-indigo-600">{formatCurrency(abv)}</p>
                                        <p className="text-xs text-slate-500">ABV</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                                    <div><p className="text-xs text-slate-500">Total Sales</p><p className="font-semibold text-slate-700">{formatCurrency(staff.sales)}</p></div>
                                    <div><p className="text-xs text-slate-500">Clients</p><p className="font-semibold text-slate-700">{staff.customers}</p></div>
                                </div>
                            </div>
                        )
                    })
                }
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <PerformancePieChart data={performanceData} />
          {incentiveReportData && <IncentivePieChart data={incentiveReportData.staffSummary} chartRef={incentiveChartRef} />}
        </div>
      </div>

      {selectedStaff && (
        <ModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={handleCloseDetails}>
              <div className="relative w-full h-full sm:max-w-3xl sm:max-h-[90vh] bg-slate-50 sm:rounded-2xl shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-slate-200 bg-white sm:rounded-t-2xl">
                  <h2 className="text-lg font-semibold text-slate-800">Performance Details</h2><button onClick={handleCloseDetails} className="p-1 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"><X size={24} /></button>
                </header>

                <div className="flex-grow p-4 sm:p-6 overflow-y-auto">
                    <div className="space-y-6">
                        <div className="flex items-center p-4 bg-white rounded-xl shadow-sm border border-slate-200"><img className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover" src={selectedStaff.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedStaff.name)}&background=4f46e5&color=fff`} alt={selectedStaff.name} /><div className="ml-4"><h3 className="text-lg sm:text-xl font-bold text-slate-900">{selectedStaff.name}</h3><p className="text-sm text-slate-600">{selectedStaff.position}</p></div></div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200"><h4 className="text-md font-semibold text-slate-800 mb-3">Summary for Period</h4>{isLoadingDetails ? <div className="py-4 text-center text-slate-500">Loading...</div> : errorDetails ? <div className="py-4 text-center text-red-500">{errorDetails}</div> : <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-center"><div><p className="text-lg font-bold text-green-600">{formatCurrency(panelSummary.totalSales)}</p><p className="text-xs text-slate-500 uppercase">Total Sales</p></div><div><p className="text-lg font-bold text-teal-600">{panelSummary.totalCustomers}</p><p className="text-xs text-slate-500 uppercase">Customers</p></div><div><p className="text-lg font-bold text-blue-600">{formatCurrency(modalIncentiveSummary.monthlyTarget)}</p><p className="text-xs text-slate-500 uppercase">Inc. Target</p></div><div><p className="text-lg font-bold text-purple-600">{formatCurrency(modalIncentiveSummary.monthlyAchieved)}</p><p className="text-xs text-slate-500 uppercase">Inc. Achieved</p></div></div>}</div>
                        
                        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 max-h-[45vh] overflow-y-auto">
                            <h4 className="text-md font-semibold text-slate-800 mb-3 px-2 sticky top-0 bg-white py-2 z-10 border-b">Daily Breakdown</h4>
                            {isLoadingDetails ? <div className="py-10 text-center text-slate-500">Loading...</div> : errorDetails ? <div className="py-10 text-center text-red-500">{errorDetails}</div> : staffDailyPerformance.length > 0 ? (
                            <div className="space-y-2 px-1 pb-1">
                                {staffDailyPerformance.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((day) => {
                                    const dailyTotalSales = day.serviceSales + day.productSales;
                                    const dailyAbv = day.customersServed > 0 ? Math.round(dailyTotalSales / day.customersServed) : 0;
                                    const incentiveDay = incentiveReportData?.dailyReport.find(inc => inc.Date === day.date.split('T')[0] && inc['Staff Name'] === selectedStaff.name);
                                    return (
                                        <div key={day.date} className="p-3 rounded-lg hover:bg-slate-50 border border-slate-100">
                                            <div className="font-semibold flex items-center text-sm mb-3 text-slate-700"><CalendarDays className="w-4 h-4 mr-2 text-indigo-500" />{format(parseISO(day.date), 'dd MMM, yyyy')}</div>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-1 text-center text-xs">
                                                <div className="p-2 rounded-md bg-blue-100 text-blue-800"><p className="font-bold">{formatCurrency(day.serviceSales)}</p><p className="text-[10px] uppercase">Service</p></div>
                                                <div className="p-2 rounded-md bg-purple-100 text-purple-800"><p className="font-bold">{formatCurrency(day.productSales)}</p><p className="text-[10px] uppercase">Product</p></div>
                                                <div className="p-2 rounded-md bg-teal-100 text-teal-800"><p className="font-bold">{day.customersServed}</p><p className="text-[10px] uppercase">Clients</p></div>
                                                <div className="p-2 rounded-md bg-indigo-100 text-indigo-800"><p className="font-bold">{formatCurrency(dailyAbv)}</p><p className="text-[10px] uppercase">ABV</p></div>
                                                <div className="p-2 rounded-md bg-slate-100 text-slate-800"><p className="font-bold">{incentiveDay ? formatCurrency(incentiveDay['Target (₹)']) : 'N/A'}</p><p className="text-[10px] uppercase">Target</p></div>
                                                <div className="p-2 rounded-md bg-slate-100 text-slate-800"><p className="font-bold">{incentiveDay ? incentiveDay['Applied Rate'] : 'N/A'}</p><p className="text-[10px] uppercase">Rate</p></div>
                                                <div className="p-2 rounded-md bg-green-100 text-green-800"><p className="font-bold">{incentiveDay ? formatCurrency(incentiveDay['Incentive (₹)']) : 'N/A'}</p><p className="text-[10px] uppercase">Incentive</p></div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            ) : ( <p className="text-sm text-center text-slate-500 py-10">No daily records found.</p> )}
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