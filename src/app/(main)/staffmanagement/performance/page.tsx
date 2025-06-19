// src/app/staffmanagement/performance/page.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, Search, Star, TrendingUp, Users, IndianRupee } from 'lucide-react';
import { useStaff, StaffMember } from '@/context/StaffContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Define the structure of the data we expect from our API
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

const PerformancePage: React.FC = () => {
  const { staffMembers } = useStaff();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentMonthIndex, setCurrentMonthIndex] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  // State to hold data fetched from our new API endpoint
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const months = useMemo(() => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ], []);

  // ✅ MAIN FIX: Fetch data from the `/api/performance` endpoint
  useEffect(() => {
    const fetchPerformanceData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Month is 1-based for the API
        const month = currentMonthIndex + 1;
        const response = await fetch(`/api/performance?month=${month}&year=${currentYear}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch performance data');
        }
        
        const data = await response.json();
        setSummaryData(data.summary);
        setPerformanceData(data.staffPerformance);

      } catch (err: any) {
        setError(err.message);
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformanceData();
  }, [currentMonthIndex, currentYear]); // Refetch when month or year changes

  // Filter staff based on the search term
  const filteredStaffPerformance = useMemo(() => 
    performanceData.filter(staff => 
        staff.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [performanceData, searchTerm]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Performance Dashboard</h1>
        {/* The "Add Record" button is removed, as data entry is now daily */}
      </div>
      
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <input type="text" placeholder="Search staff..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 placeholder:text-gray-400"/>
        </div>
        <div>
          <select value={currentMonthIndex} onChange={(e) => setCurrentMonthIndex(parseInt(e.target.value))}
            className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900">
            {months.map((month, index) => (<option key={month} value={index}>{month}</option>))}
          </select>
        </div>
        <div>
          <select value={currentYear} onChange={(e) => setCurrentYear(parseInt(e.target.value))}
            className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900">
            {[...Array(5)].map((_, i) => { const year = new Date().getFullYear() - 2 + i; return (<option key={year} value={year}>{year}</option>);})}
          </select>
        </div>
      </div>
      
      {/* ✅ FIX: Summary cards now use data directly from the API */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card><div className="flex flex-col items-center text-center p-4"><div className="p-3 rounded-full bg-purple-100 mb-4"><Star className="h-8 w-8 text-purple-600" /></div><p className="text-2xl font-bold text-gray-900">{isLoading ? '...' : summaryData?.averageRating || '0.0'}</p><p className="text-sm text-gray-600">Average Rating</p></div></Card>
        <Card><div className="flex flex-col items-center text-center p-4"><div className="p-3 rounded-full bg-teal-100 mb-4"><Users className="h-8 w-8 text-teal-600" /></div><p className="text-2xl font-bold text-gray-900">{isLoading ? '...' : summaryData?.totalCustomers || 0}</p><p className="text-sm text-gray-600">Total Customers</p></div></Card>
        <Card><div className="flex flex-col items-center text-center p-4"><div className="p-3 rounded-full bg-pink-100 mb-4"><IndianRupee className="h-8 w-8 text-pink-600" /></div><p className="text-2xl font-bold text-gray-900">₹{isLoading ? '...' : summaryData?.revenueGenerated.toLocaleString() || 0}</p><p className="text-sm text-gray-600">Revenue Generated</p></div></Card>
        <Card><div className="flex flex-col items-center text-center p-4"><div className="p-3 rounded-full bg-amber-100 mb-4"><TrendingUp className="h-8 w-8 text-amber-600" /></div><p className="text-2xl font-bold text-gray-900">{isLoading ? '...' : summaryData?.avgServiceQuality || '0.0'}</p><p className="text-sm text-gray-600">Avg Service Quality</p></div></Card>
      </div>
      
      <Card title="Staff Performance Overview" className="overflow-hidden">
        {isLoading ? <div className="text-center p-10">Loading Chart Data...</div> : error ? <div className="text-center p-10 text-red-500">{error}</div> :
        <div className="h-96 p-4">
          <ResponsiveContainer width="100%" height="100%">
            {/* ✅ FIX: Chart now uses the filtered performance data */}
            <BarChart data={filteredStaffPerformance} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" angle={-30} textAnchor="end" height={60} interval={0} tick={{fontSize: 10}} />
              <YAxis yAxisId="left" orientation="left" stroke="#8B5CF6" label={{ value: 'Rating (0-10)', angle: -90, position: 'insideLeft', offset: 0, style: {textAnchor: 'middle', fill: '#8B5CF6'} }} domain={[0, 10]}/>
              <YAxis yAxisId="right" orientation="right" stroke="#0D9488" label={{ value: 'Customers / Sales (₹)', angle: 90, position: 'insideRight', offset: 10, style: {textAnchor: 'middle', fill: '#0D9488'} }} />
              <Tooltip formatter={(value, name) => name === 'Sales (₹)' ? `₹${Number(value).toLocaleString()}` : value} />
              <Legend verticalAlign="top" height={36}/>
              <Bar yAxisId="left" dataKey="rating" fill="#8B5CF6" name="Rating" barSize={20} />
              <Bar yAxisId="right" dataKey="customers" fill="#0D9488" name="Customers" barSize={20} />
              <Bar yAxisId="right" dataKey="sales" fill="#EC4899" name="Sales (₹)" barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>}
      </Card>
      
      <Card title={`Individual Performance Records - ${months[currentMonthIndex]} ${currentYear}`} className="overflow-hidden">
        <div className="overflow-x-auto">
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
              {isLoading ? (<tr><td colSpan={4} className="text-center p-10">Loading Records...</td></tr>) :
               error ? (<tr><td colSpan={4} className="text-center p-10 text-red-500">{error}</td></tr>) :
               filteredStaffPerformance.length > 0 ? (
                filteredStaffPerformance.map(staff => (
                  // ✅ FIX: Table now uses the correct data structure
                  <tr key={staff.staffId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center">
                        <img className="h-10 w-10 rounded-full object-cover" src={staff.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=random`} alt={staff.name} />
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                          <div className="text-sm text-gray-500">{staff.position}</div>
                        </div>
                    </div></td>
                    <td className="px-6 py-4 whitespace-nowrap text-center"><div className="flex items-center justify-center">
                        <Star className="h-4 w-4 text-amber-500 mr-1 fill-current" /><span className="text-sm font-medium text-gray-900">{staff.rating.toFixed(1)}/10</span>
                    </div></td>
                    <td className="px-6 py-4 whitespace-nowrap text-center"><span className="text-sm text-gray-900">{staff.customers}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-center"><span className="text-sm text-gray-900">₹{staff.sales.toLocaleString()}</span></td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                  No performance records found for {months[currentMonthIndex]} {currentYear}.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default PerformancePage;