'use client';

import { useState, useEffect } from 'react'; // Added useEffect
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/LoadingSpinner'; // Assuming you have a loading spinner

// ▼▼▼ SOLUTION: DEFINE THE SHAPE OF THE DATA ▼▼▼
interface PerformanceDataRow {
  staffId: string;
  staffName: string;
  totalCalls: number;
  appointmentsBooked: number;
  conversionRate: number;
}

export default function PerformanceReportPage() {
  // ▼▼▼ SOLUTION: USE THE INTERFACE TO TYPE THE STATE ▼▼▼
  const [reportData, setReportData] = useState<PerformanceDataRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  const generateReport = async () => {
    setIsLoading(true);
    try {
      // Construct the URL with query parameters
      const url = `/api/telecalling/reports/performance?startDate=${dateRange.start}&endDate=${dateRange.end}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to fetch performance data');
      }
      const data: PerformanceDataRow[] = await res.json();
      setReportData(data);
    } catch (error) {
      console.error(error);
      // You might want to show an error message to the user
      // toast.error("Could not generate report.");
    } finally {
      setIsLoading(false);
    }
  };

  // Optional but recommended: Generate the report for today on initial page load
  useEffect(() => {
    generateReport();
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Telecaller Performance Report</h1>
      <p className="text-gray-600 mb-6">Analyze performance by staff member over a specific date range.</p>

      <div className="flex flex-wrap gap-4 items-end bg-gray-50 p-4 rounded-lg mb-6 border">
        <div>
          <label htmlFor="start-date" className="block text-sm font-medium text-gray-700">Start Date</label>
          <input
            type="date"
            id="start-date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="end-date" className="block text-sm font-medium text-gray-700">End Date</label>
          <input
            type="date"
            id="end-date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        <Button onClick={generateReport} disabled={isLoading} className="bg-black hover:bg-gray-800 text-white">
          {isLoading ? 'Generating...' : 'Generate Report'}
        </Button>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Calls</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Appointments Booked</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conversion Rate</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="text-center py-12">
                  <LoadingSpinner />
                </td>
              </tr>
            ) : reportData.length > 0 ? (
              reportData.map((row) => (
                <tr key={row.staffId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.staffName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.totalCalls}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.appointmentsBooked}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.conversionRate.toFixed(2)}%</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center py-12 text-gray-500">
                  No performance data found for the selected date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}