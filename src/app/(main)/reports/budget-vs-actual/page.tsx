'use client';

import React, { useState, useEffect, useCallback, useMemo, ElementType } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { Download, AlertCircle, Loader2, Wallet, CreditCard, TrendingUp } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { hasPermission, PERMISSIONS } from '../../../../lib/permissions'; // Path to your permissions file

// --- Interface ---
interface IBudgetVsActual {
  category: string;
  type: 'Fixed' | 'Variable';
  budget: number;
  spent: number;
  remaining: number;
  usagePercentage: string;
  remainingPercentage: string;
}

type DashboardCardProps = {
  title: string;
  value: number;
  icon: ElementType;
  colorClass: string;
};

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
const months = [
  { value: 1, name: 'January' }, { value: 2, name: 'February' },
  { value: 3, name: 'March' }, { value: 4, name: 'April' },
  { value: 5, name: 'May' }, { value: 6, name: 'June' },
  { value: 7, name: 'July' }, { value: 8, name: 'August' },
  { value: 9, name: 'September' }, { value: 10, name: 'October' },
  { value: 11, name: 'November' }, { value: 12, name: 'December' },
];

const DashboardCard = ({ title, value, icon: Icon, colorClass }: DashboardCardProps) => (
  <div className={`relative p-6 rounded-xl shadow-lg text-white overflow-hidden ${colorClass}`}>
    <div className="relative z-10">
      <p className="text-sm font-semibold uppercase">{title}</p>
      <p className="text-4xl font-bold mt-2">₹{value.toLocaleString()}</p>
    </div>
    <div className="absolute -right-4 -bottom-4 opacity-20 z-0">
      <Icon size={80} />
    </div>
  </div>
);

export default function BudgetVsActualReportPage() {
  const { data: session, status } = useSession();
  const userPermissions = session?.user?.role?.permissions || [];

  const currentTenantId = useMemo(() => session?.user?.tenantId, [session]);

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [reportData, setReportData] = useState<IBudgetVsActual[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    return reportData.reduce((acc, item) => {
        acc.totalBudget += item.budget;
        acc.totalSpent += item.spent;
        return acc;
    }, { totalBudget: 0, totalSpent: 0 });
  }, [reportData]);
  const remainingBudget = summary.totalBudget - summary.totalSpent;

  const fetchData = useCallback(async () => {
    if (status !== 'authenticated' || !currentTenantId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const headers = new Headers({ 'X-Tenant-ID': currentTenantId });
      const res = await fetch(`/api/reports/budget-vs-actual?month=${month}&year=${year}`, { headers });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to fetch report data.');
      setReportData(result.data || []);
    } catch (err: any) {
      setError(err.message);
      setReportData([]);
    } finally {
      setIsLoading(false);
    }
  }, [month, year, currentTenantId, status]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDownloadPDF = () => {
    if (reportData.length === 0) return toast.info("No data available to export.");
    const doc = new jsPDF();
    const monthName = months.find(m => m.value === month)?.name || 'N/A';
    doc.text(`Budget vs. Actual Report - ${monthName} ${year}`, 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Category', 'Budget (₹)', 'Spent (₹)', 'Remaining (₹)', 'Usage (%)', 'Remaining (%)']],
      body: reportData.map(item => [
        item.category,
        item.budget.toLocaleString(),
        item.spent.toLocaleString(),
        item.remaining.toLocaleString(),
        item.usagePercentage,
        item.remainingPercentage,
      ]),
      headStyles: { fillColor: '#2c3e50' },
    });
    doc.save(`budget_report_${month}_${year}.pdf`);
  };

  const handleDownloadExcel = () => {
    if (reportData.length === 0) return toast.info("No data available to export.");
    const worksheet = XLSX.utils.json_to_sheet(reportData.map(item => ({
      Category: item.category,
      'Budget (INR)': item.budget,
      'Spent (INR)': item.spent,
      'Remaining (INR)': item.remaining,
      'Usage (%)': item.usagePercentage,
      'Remaining (%)': item.remainingPercentage,
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Budget Report');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(data, `budget_report_${month}_${year}.xlsx`);
  };

  if (status === "loading") {
    return <div className="p-8 text-center"><Loader2 className="animate-spin inline-block mr-2"/>Loading session...</div>;
  }
  
  const getUsageColor = (usageString: string) => {
      const usage = parseFloat(usageString);
      if (usage > 100) return 'text-red-600 font-bold bg-red-100';
      if (usage >= 80) return 'text-orange-800 font-bold bg-orange-100';
      return 'text-green-800 font-bold bg-green-100';
  };
  
  const getRemainingColor = (remainingString: string) => {
    const remaining = parseFloat(remainingString);
    if (remaining < 0) return 'text-red-600 font-bold bg-red-100';
    if (remaining <= 20) return 'text-orange-800 font-bold bg-orange-100';
    return 'text-green-800 font-bold bg-green-100';
  }

  return (
    <div className="p-4 sm:p-6 font-sans bg-gray-50 min-h-screen">
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Budget vs. Actual Report</h1>
          <p className="text-gray-500 mt-1">Compare budgeted amounts to actual spending.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500">
            {months.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <DashboardCard title="Total Budget" value={summary.totalBudget} icon={Wallet} colorClass="bg-gradient-to-tr from-blue-500 to-sky-500" />
        <DashboardCard title="Total Spent" value={summary.totalSpent} icon={CreditCard} colorClass="bg-gradient-to-tr from-rose-500 to-red-500" />
        <DashboardCard title="Remaining Budget" value={remainingBudget} icon={TrendingUp} colorClass="bg-gradient-to-tr from-emerald-500 to-green-500" />
      </div>

      <div className="bg-white rounded-lg shadow-md border-t-4 border-blue-600">
        {hasPermission(userPermissions, PERMISSIONS.REPORT_BUDGET_VS_ACTUAL_MANAGE) && (
            <div className="p-4 flex justify-end items-center gap-2 border-b">
              <button onClick={handleDownloadPDF} disabled={isLoading || reportData.length === 0} className="flex items-center bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400 text-sm">
                <Download size={16} className="mr-2" /> PDF
              </button>
              <button onClick={handleDownloadExcel} disabled={isLoading || reportData.length === 0} className="flex items-center bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm">
                <Download size={16} className="mr-2" /> Excel
              </button>
            </div>
        )}

        {error && (
          <div className="p-6 m-4 bg-red-50 text-red-800 rounded-md border border-red-200 flex items-center gap-3">
            <AlertCircle size={24}/>
            <div><h3 className="font-bold">Error Loading Report</h3><p className="text-sm">{error}</p></div>
          </div>
        )}

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-10 text-center text-gray-500"><Loader2 className="animate-spin inline-block mr-2"/>Loading Report Data...</div>
          ) : !error && reportData.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No report data available for the selected period.</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-600 uppercase">
                <tr>
                  <th className="p-4 font-semibold">Category</th>
                  <th className="p-4 font-semibold text-right">Budget</th>
                  <th className="p-4 font-semibold text-right">Spent</th>
                  <th className="p-4 font-semibold text-right">Remaining</th>
                  <th className="p-4 font-semibold text-center">Usage (%)</th>
                  <th className="p-4 font-semibold text-center">Remaining (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reportData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-800">{item.category}</td>
                    <td className="p-4 text-right text-gray-700">₹{item.budget.toLocaleString()}</td>
                    <td className="p-4 text-right text-gray-700">₹{item.spent.toLocaleString()}</td>
                    <td className={`p-4 text-right font-medium ${item.remaining < 0 ? 'text-red-500' : 'text-gray-700'}`}>₹{item.remaining.toLocaleString()}</td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs ${getUsageColor(item.usagePercentage)}`}>{item.usagePercentage}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs ${getRemainingColor(item.remainingPercentage)}`}>{item.remainingPercentage}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}