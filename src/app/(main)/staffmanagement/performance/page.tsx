'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, Search, Star, TrendingUp, Users, IndianRupee, X, CalendarDays, Wrench, ShoppingCart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Label } from 'recharts';
import { format, parseISO } from 'date-fns';

// --- Type Definitions (No changes needed) ---
interface PerformanceData {
    staffId: string;
    name: string;
    position: string;
    image?: string;
    sales: number;
    customers: number;
    rating: number;
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

// --- UI Components (No changes needed) ---
const SummaryCardSkeleton: React.FC = () => (
  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 animate-pulse">
    <div className="flex items-center">
      <div className="w-12 h-12 rounded-full bg-gray-200 mr-4"></div>
      <div className="space-y-2 flex-1">
        <div className="h-6 bg-gray-300 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
      </div>
    </div>
  </div>
);

const SummaryCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: string | number;
  iconBgColor: string;
  bgIconColor: string;
}> = ({ icon, title, value, iconBgColor, bgIconColor }) => (
  <div className="relative bg-white p-5 rounded-xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden">
    <div className={`absolute -right-4 -bottom-5 ${bgIconColor} opacity-70`}>
      {React.cloneElement(icon as React.ReactElement, { size: 96, strokeWidth: 1 })}
    </div>
    <div className="relative z-10">
      <div className={`p-3 rounded-lg inline-block ${iconBgColor}`}>
        {React.cloneElement(icon as React.ReactElement, { size: 24 })}
      </div>
      <p className="mt-4 text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="font-bold text-gray-800">{label}</p>
        {payload.map((pld: any) => (
          <div key={pld.dataKey} style={{ color: pld.fill }} className="text-sm flex justify-between items-center">
            <span className="mr-3">{pld.name}:</span>
            <span className="font-semibold">
                {pld.dataKey === 'sales' ? `₹${pld.value.toLocaleString()}` : pld.value}
                {pld.dataKey === 'rating' && '/10'}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};


// --- Main Performance Page Component ---
const PerformancePage: React.FC = () => {
  // --- STATE AND HOOKS (No changes needed) ---
  const [searchTerm, setSearchTerm] = useState('');
  const [currentMonthIndex, setCurrentMonthIndex] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<PerformanceData | null>(null);
  const [staffDailyPerformance, setStaffDailyPerformance] = useState<DailyPerformanceRecord[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const months = useMemo(() => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], []);

  // --- DATA FETCHING (No changes needed) ---
  useEffect(() => {
    const fetchPerformanceData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const month = currentMonthIndex + 1;
        const response = await fetch(`/api/performance?month=${month}&year=${currentYear}`);
        if (!response.ok) throw new Error('Failed to fetch monthly performance data');
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'API returned an error');
        setSummaryData(data.summary);
        setPerformanceData(data.staffPerformance);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPerformanceData();
  }, [currentMonthIndex, currentYear]);

  // --- HANDLERS AND MEMOIZED VALUES (No changes needed) ---
  const handleOpenDetails = async (staff: PerformanceData) => {
    setSelectedStaff(staff);
    setIsLoadingDetails(true);
    setErrorDetails(null);
    setStaffDailyPerformance([]);
    try {
      const month = currentMonthIndex + 1;
      const response = await fetch(`/api/performance?staffId=${staff.staffId}&month=${month}&year=${currentYear}`);
      if (!response.ok) throw new Error('Could not fetch daily details.');
      const data = await response.json();
      if (!data.success) throw new Error(data.message || 'API returned an error fetching details.');
      setStaffDailyPerformance(data.details || []);
    } catch (err: any) {
      setErrorDetails(err.message);
    } finally {
      setIsLoadingDetails(false);
    }
  };
  const handleCloseDetails = () => setSelectedStaff(null);
  const panelSummary = useMemo(() => {
    if (!staffDailyPerformance || staffDailyPerformance.length === 0) {
      return { totalSales: 0, totalCustomers: 0, averageRating: 0 };
    }
    const totalSales = staffDailyPerformance.reduce((sum: number, day: DailyPerformanceRecord) => sum + day.serviceSales + day.productSales, 0);
    const totalCustomers = staffDailyPerformance.reduce((sum: number, day: DailyPerformanceRecord) => sum + day.customersServed, 0);
    const validRatings = staffDailyPerformance.filter((day: DailyPerformanceRecord) => day.rating > 0);
    const averageRating = validRatings.length > 0 ? validRatings.reduce((sum: number, day: DailyPerformanceRecord) => sum + day.rating, 0) / validRatings.length : 0;
    return { totalSales, totalCustomers, averageRating };
  }, [staffDailyPerformance]);
  const filteredStaffPerformance = useMemo(() => performanceData.filter((staff: PerformanceData) => staff.name.toLowerCase().includes(searchTerm.toLowerCase())), [performanceData, searchTerm]);
  const ratingRing = useMemo(() => {
    if (!selectedStaff) return { circumference: 0, offset: 0 };
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (selectedStaff.rating / 10) * circumference;
    return { circumference, offset };
  }, [selectedStaff]);

  return (
    <div className="bg-gray-50 min-h-screen p-4 sm:p-6 lg:p-8 space-y-8">
      {/* --- Header & Filters (MODIFIED: Responsive stacking and sizing) --- */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Performance Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-500 mt-1">An overview for {months[currentMonthIndex]} {currentYear}.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Search staff..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full bg-white pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder:text-gray-400"/>
          </div>
          <select value={currentMonthIndex} onChange={(e) => setCurrentMonthIndex(parseInt(e.target.value))}
            className="w-full sm:w-auto px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900">
            {months.map((month: string, index: number) => (<option key={month} value={index}>{month}</option>))}
          </select>
          <select value={currentYear} onChange={(e) => setCurrentYear(parseInt(e.target.value))}
            className="w-full sm:w-auto px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900">
            {[...Array(5)].map((_, i) => { const year = new Date().getFullYear() - 2 + i; return (<option key={year} value={year}>{year}</option>);})}
          </select>
        </div>
      </header>
      
      {/* --- Summary Cards (MODIFIED: Responsive grid is already good) --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          <><SummaryCardSkeleton /><SummaryCardSkeleton /><SummaryCardSkeleton /><SummaryCardSkeleton /></>
        ) : error ? <div className="col-span-full text-center p-10 bg-white rounded-xl shadow-sm text-red-500">{error}</div> : (
          <>
            <SummaryCard icon={<Star className="text-amber-600" />} title="Average Rating" value={summaryData?.averageRating || '0.0'} iconBgColor="bg-amber-100" bgIconColor="text-amber-100"/>
            <SummaryCard icon={<Users className="text-teal-600" />} title="Total Customers" value={summaryData?.totalCustomers || 0} iconBgColor="bg-teal-100" bgIconColor="text-teal-100"/>
            <SummaryCard icon={<IndianRupee className="text-green-600" />} title="Revenue Generated" value={`₹${summaryData?.revenueGenerated.toLocaleString() || 0}`} iconBgColor="bg-green-100" bgIconColor="text-green-100"/>
            <SummaryCard icon={<TrendingUp className="text-indigo-600" />} title="Avg Service Quality" value={summaryData?.avgServiceQuality || '0.0'} iconBgColor="bg-indigo-100" bgIconColor="text-indigo-100"/>
          </>
        )}
      </div>
      
      {/* --- Main Chart (MODIFIED: Made horizontally scrollable on mobile) --- */}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Staff Performance Overview</h2>
          {isLoading ? <div className="flex items-center justify-center h-96 text-gray-500">Loading Chart...</div> : error ? <div className="flex items-center justify-center h-96 text-red-500">{error}</div> :
          <div className="overflow-x-auto">
            <div className="h-96 w-full min-w-[600px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredStaffPerformance} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                  <defs>
                      <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0.2}/></linearGradient>
                      <linearGradient id="colorCustomers" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8}/><stop offset="95%" stopColor="#14b8a6" stopOpacity={0.2}/></linearGradient>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16a34a" stopOpacity={0.8}/><stop offset="95%" stopColor="#16a34a" stopOpacity={0.2}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} tick={{fontSize: 12, fill: '#4b5563'}} />
                  <YAxis yAxisId="ratingAxis" orientation="left" stroke="#f59e0b" tick={{fontSize: 12}} domain={[0, 10]}>
                      <Label value="Rating" angle={-90} position="insideLeft" style={{textAnchor: 'middle'}} fill="#f59e0b" />
                  </YAxis>
                  <YAxis yAxisId="customerAxis" orientation="right" stroke="#14b8a6" tick={{fontSize: 12}} >
                      <Label value="Customers" angle={-90} position="insideRight" style={{textAnchor: 'middle'}} fill="#14b8a6" />
                  </YAxis>
                  <YAxis yAxisId="salesAxis" orientation="right" stroke="#16a34a" tick={{fontSize: 12}} dx={50}>
                      <Label value="Sales (₹)" angle={-90} position="insideRight" offset={-15} style={{textAnchor: 'middle'}} fill="#16a34a" />
                  </YAxis>
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(238, 242, 255, 0.6)' }}/>
                  <Legend iconType="circle" wrapperStyle={{paddingTop: '30px'}}/>
                  <Bar yAxisId="ratingAxis" dataKey="rating" name="Rating" barSize={15} fill="url(#colorRating)" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="customerAxis" dataKey="customers" name="Customers" barSize={15} fill="url(#colorCustomers)" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="salesAxis" dataKey="sales" name="Sales (₹)" barSize={15} fill="url(#colorSales)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>}
      </div>

      {/* --- Individual Records Table (MODIFIED: Responsive table/card list) --- */}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Individual Performance Records</h2>
        
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Customers</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Sales (₹)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (<tr><td colSpan={4} className="text-center p-10 text-gray-500">Loading Records...</td></tr>) :
               error ? (<tr><td colSpan={4} className="text-center p-10 text-red-500">{error}</td></tr>) :
               filteredStaffPerformance.length > 0 ? (
                filteredStaffPerformance.map((staff: PerformanceData) => (
                  <tr key={staff.staffId} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleOpenDetails(staff)}>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center">
                        <img className="h-11 w-11 rounded-full object-cover" src={staff.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=random&color=fff`} alt={staff.name} />
                        <div className="ml-4">
                          <div className="text-sm font-semibold text-gray-800">{staff.name}</div>
                          <div className="text-sm text-gray-500">{staff.position}</div>
                        </div>
                    </div></td>
                    <td className="px-6 py-4 whitespace-nowrap text-center"><div className="flex items-center justify-center"><Star className="h-4 w-4 text-amber-500 mr-1.5 fill-current" /><span className="text-sm font-medium text-gray-900">{staff.rating.toFixed(1)}/10</span></div></td>
                    <td className="px-6 py-4 whitespace-nowrap text-center"><span className="text-sm text-gray-900">{staff.customers}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-center"><span className="text-sm font-bold text-green-700">₹{staff.sales.toLocaleString()}</span></td>
                  </tr>
                ))
              ) : (<tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">No records found.</td></tr>)}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="block md:hidden">
            {isLoading ? <div className="text-center p-10 text-gray-500">Loading Records...</div> :
             error ? <div className="text-center p-10 text-red-500">{error}</div> :
             filteredStaffPerformance.length > 0 ? (
                <div className="space-y-4">
                    {filteredStaffPerformance.map((staff: PerformanceData) => (
                        <div key={staff.staffId} className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm active:bg-gray-50" onClick={() => handleOpenDetails(staff)}>
                            <div className="flex items-center mb-4">
                                <img className="h-11 w-11 rounded-full object-cover" src={staff.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=random&color=fff`} alt={staff.name} />
                                <div className="ml-4">
                                    <p className="font-semibold text-gray-800">{staff.name}</p>
                                    <p className="text-sm text-gray-500">{staff.position}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center border-t pt-3">
                                <div>
                                    <p className="text-xs text-gray-500">Rating</p>
                                    <p className="font-semibold text-amber-600 flex items-center justify-center mt-1"><Star className="w-4 h-4 mr-1 fill-current"/>{staff.rating.toFixed(1)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Customers</p>
                                    <p className="font-semibold text-teal-600 mt-1">{staff.customers}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Sales</p>
                                    <p className="font-semibold text-green-600 mt-1">₹{staff.sales.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
             ) : ( <p className="px-6 py-10 text-center text-gray-500">No records found.</p> )}
        </div>
      </div>
      
      {/* --- Details Slide-Out Panel (MODIFIED: Responsive padding and text sizes) --- */}
      {selectedStaff && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity" onClick={handleCloseDetails}></div>
          <div className={`fixed top-0 right-0 h-full w-full max-w-lg bg-gray-50 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${selectedStaff ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex flex-col h-full">
              <header className="flex justify-between items-center p-4 border-b border-gray-200 bg-white">
                <h2 className="text-lg font-semibold text-gray-800">Performance Details</h2>
                <button onClick={handleCloseDetails} className="p-1 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors">
                  <X size={24} />
                </button>
              </header>
              <div className="flex-grow p-4 sm:p-6 overflow-y-auto space-y-6">
                <div className="relative flex flex-col sm:flex-row items-center p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                   <div className="relative w-24 h-24 flex-shrink-0">
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                            <circle className="text-gray-200" strokeWidth="8" stroke="currentColor" fill="transparent" r="38" cx="50" cy="50" />
                            <circle className="text-amber-500" strokeWidth="8" strokeDasharray={ratingRing.circumference} strokeDashoffset={ratingRing.offset} strokeLinecap="round" stroke="currentColor" fill="transparent" r="38" cx="50" cy="50" style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }} transform="rotate(-90 50 50)" />
                        </svg>
                        <img className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-20 rounded-full object-cover" src={selectedStaff.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedStaff.name)}&background=random&color=fff`} alt={selectedStaff.name} />
                   </div>
                  <div className="ml-0 sm:ml-5 mt-4 sm:mt-0 text-center sm:text-left">
                    <h3 className="text-xl font-bold text-gray-900">{selectedStaff.name}</h3>
                    <p className="text-sm text-gray-600">{selectedStaff.position}</p>
                    <div className="mt-2 flex items-center justify-center sm:justify-start text-lg font-bold text-amber-600">
                        <Star className="w-5 h-5 mr-1.5 fill-current" />
                        <span>{selectedStaff.rating.toFixed(1)} <span className="text-sm font-medium text-gray-500">/ 10 (Monthly)</span></span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <h4 className="text-md font-semibold text-gray-800 mb-3">Summary for {months[currentMonthIndex]}</h4>
                    {isLoadingDetails ? (<div className="text-center py-4 text-gray-500">Loading...</div>) : 
                     errorDetails ? (<div className="text-center py-4 text-red-500">{errorDetails}</div>) :
                    (<div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                        <div><p className="text-md sm:text-lg font-bold text-green-600">₹{panelSummary.totalSales.toLocaleString()}</p><p className="text-xs text-gray-500">Total Sales</p></div>
                        <div><p className="text-md sm:text-lg font-bold text-teal-600">{panelSummary.totalCustomers}</p><p className="text-xs text-gray-500">Customers</p></div>
                        <div><p className="text-md sm:text-lg font-bold text-amber-600">{panelSummary.averageRating.toFixed(1)}</p><p className="text-xs text-gray-500">Avg Rating</p></div>
                    </div>)
                    }
                </div>
                
                <div>
                  <h4 className="text-md font-semibold text-gray-800 mb-3 px-1">Daily Breakdown</h4>
                  <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 max-h-[45vh] overflow-y-auto">
                    {isLoadingDetails ? (<div className="text-center py-10 text-gray-500">Loading records...</div>) :
                     errorDetails ? (<div className="text-center py-10 text-red-500">{errorDetails}</div>) :
                     staffDailyPerformance.length > 0 ? (
                       <div className="space-y-1">
                        {staffDailyPerformance.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((day) => (
                          <div key={day.date} className="p-3 rounded-lg flex flex-wrap gap-x-2 gap-y-1 items-center text-sm hover:bg-gray-50">
                            <div className="font-semibold text-gray-700 flex items-center w-full sm:w-auto sm:flex-1">
                                <CalendarDays className="w-4 h-4 mr-2 text-gray-400" />
                                {format(parseISO(day.date), 'dd MMM, yyyy')}
                            </div>
                            <div className="text-xs flex items-center justify-center text-blue-700" title="Service Sales">
                              <Wrench className="w-3 h-3 mr-1.5" /><span>₹{day.serviceSales.toLocaleString()}</span>
                            </div>
                            <div className="text-xs flex items-center justify-center text-purple-700" title="Product Sales">
                               <ShoppingCart className="w-3 h-3 mr-1.5" /><span>₹{day.productSales.toLocaleString()}</span>
                            </div>
                            <div className="ml-auto flex items-center">
                              <Star className="w-4 h-4 text-amber-500 fill-current mr-1"/>
                              <span className="font-semibold text-gray-800">{day.rating.toFixed(1)}</span>
                            </div>
                          </div>
                        ))}
                       </div>
                     ) : ( <p className="text-sm text-gray-500 text-center py-10">No daily records found.</p> )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PerformancePage;