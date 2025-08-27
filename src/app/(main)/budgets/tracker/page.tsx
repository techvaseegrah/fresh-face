"use client";

import { useState, useEffect, useCallback, useMemo, ElementType } from 'react';
import { useSession } from 'next-auth/react';
import { ITrackerData } from '@/types/budget';
import { Download, AlertCircle, Wallet, CreditCard, TrendingUp } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

// Reusable Dashboard Card Component
type DashboardCardProps = {
  title: string;
  value: number;
  icon: ElementType;
  colorClass: string;
};

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


export default function BudgetTrackerPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [trackerData, setTrackerData] = useState<ITrackerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 1. useSession hook correctly retrieves the authenticated user's session data.
  const { data: session, status } = useSession();

  const fetchTrackerData = useCallback(async () => {
    // 2. This guard clause correctly waits for authentication and ensures the tenantId exists.
    if (status !== 'authenticated' || !session?.user?.tenantId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const headers = new Headers();
      // 3. CRITICAL STEP: The tenantId is securely retrieved from the session
      //    and added to the request headers. This is the correct implementation.
      headers.append('x-tenant-id', session.user.tenantId);

      // 4. The fetch request is sent with the tenant-aware headers.
      const res = await fetch(`/api/budget-tracker?month=${month}&year=${year}`, { headers });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch data');
      }
      const { data } = await res.json();
      setTrackerData(data || []);
    } catch (err: any) {
      setError(err.message);
      setTrackerData([]);
    } finally {
      setIsLoading(false);
    }
    // The dependency array correctly includes 'session' and 'status' to re-run when the user logs in.
  }, [month, year, session, status]);

  useEffect(() => {
    if (status === 'authenticated') {
        fetchTrackerData();
    }
  }, [fetchTrackerData, status]);

  const summary = useMemo(() => {
    return trackerData.reduce((acc, item) => {
        acc.totalBudget += item.budget;
        acc.totalSpent += item.spentTillDate;
        return acc;
    }, { totalBudget: 0, totalSpent: 0 });
  }, [trackerData]);
  const remainingBudget = summary.totalBudget - summary.totalSpent;

  // No changes are needed in the download handlers as they operate on the
  // 'trackerData' state, which is already correctly fetched for the tenant.
  const handleDownloadCsv = () => {
    if (trackerData.length === 0) {
        setError("Cannot generate CSV. No data available.");
        return;
    }

    const csvRows = [];
    csvRows.push(`"Metric","Value"`);
    csvRows.push(`"Total Budget","₹${summary.totalBudget.toLocaleString()}"`);
    csvRows.push(`"Total Spent","₹${summary.totalSpent.toLocaleString()}"`);
    csvRows.push(`"Remaining Budget","₹${remainingBudget.toLocaleString()}"`);
    csvRows.push('');

    const headers = ['Category', 'Budget', 'Spent', 'Remaining', 'Usage (%)', 'Remaining (%)'];
    csvRows.push(headers.join(','));

    for (const item of trackerData) {
        const remainingPercentage = item.budget > 0 ? ((item.remainingBudget / item.budget) * 100).toFixed(2) : '0.00';
        const category = `"${item.category.replace(/"/g, '""')}"`;
        csvRows.push([
            category,
            item.budget,
            item.spentTillDate,
            item.remainingBudget,
            item.budgetUsedIn.replace('%', ''),
            remainingPercentage,
        ].join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget_report_${month}-${year}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    if (trackerData.length === 0) {
        setError("Cannot generate PDF. No data available.");
        return;
    }
    const doc = new jsPDF();
    const monthName = months.find(m => m.value === month)?.name || 'Unknown';
    
    doc.setFontSize(18);
    doc.text(`Budget Report - ${monthName} ${year}`, 14, 22);

    const cardWidth = 58;
    const cardHeight = 25;
    const startX = 14;
    const startY = 30;
    const gap = 5;

    doc.setFillColor(60, 150, 220);
    doc.roundedRect(startX, startY, cardWidth, cardHeight, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('TOTAL BUDGET', startX + 5, startY + 8);
    doc.setFontSize(16);
    doc.text(`₹${summary.totalBudget.toLocaleString()}`, startX + 5, startY + 18);

    doc.setFillColor(239, 68, 68);
    doc.roundedRect(startX + cardWidth + gap, startY, cardWidth, cardHeight, 3, 3, 'F');
    doc.text('TOTAL SPENT', startX + cardWidth + gap + 5, startY + 8);
    doc.text(`₹${summary.totalSpent.toLocaleString()}`, startX + cardWidth + gap + 5, startY + 18);

    doc.setFillColor(16, 185, 129);
    doc.roundedRect(startX + 2 * (cardWidth + gap), startY, cardWidth, cardHeight, 3, 3, 'F');
    doc.text('REMAINING BUDGET', startX + 2 * (cardWidth + gap) + 5, startY + 8);
    doc.text(`₹${remainingBudget.toLocaleString()}`, startX + 2 * (cardWidth + gap) + 5, startY + 18);

    autoTable(doc, {
      startY: startY + cardHeight + 10,
      head: [['Category', 'Budget', 'Spent', 'Remaining', 'Usage (%)', 'Remaining (%)']],
      body: trackerData.map(item => {
        const remainingPercentage = item.budget > 0 ? `${((item.remainingBudget / item.budget) * 100).toFixed(2)}%` : '0.00%';
        return [
          item.category,
          `₹${item.budget.toLocaleString()}`,
          `₹${item.spentTillDate.toLocaleString()}`,
          `₹${item.remainingBudget.toLocaleString()}`,
          item.budgetUsedIn,
          remainingPercentage,
        ];
      }),
      showFoot: 'lastPage',
      foot: [['Total', `₹${summary.totalBudget.toLocaleString()}`, `₹${summary.totalSpent.toLocaleString()}`, `₹${remainingBudget.toLocaleString()}`, '', '']],
      headStyles: { fillColor: [41, 128, 185] },
      footStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255] }
    });

    doc.save(`budget_report_${month}-${year}.pdf`);
  };
  
  const getUsageColor = (usageString: string) => {
      const usage = parseFloat(usageString);
      if (usage > 100) return 'text-red-600 font-bold bg-red-100';
      if (usage >= 80) return 'text-orange-800 font-bold bg-orange-100';
      return 'text-green-800 font-bold bg-green-100';
  };
  
  const getRemainingColor = (remaining: number) => {
    if (remaining < 0) return 'text-red-600 font-bold bg-red-100';
    if (remaining <= 20) return 'text-orange-800 font-bold bg-orange-100';
    return 'text-green-800 font-bold bg-green-100';
  }

  return (
    <main className="p-4 sm:p-8 bg-gray-50 min-h-screen">
      
      <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Budget Tracker</h1>
          <p className="text-gray-500 mt-1">Review your budget performance and download reports.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500">
            {months.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={handleDownloadCsv} disabled={isLoading || trackerData.length === 0} className="flex items-center bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400">
              <Download size={18} className="mr-2" /> CSV
          </button>
           <button onClick={handleDownloadPdf} disabled={isLoading || trackerData.length === 0} className="flex items-center bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400">
              <Download size={18} className="mr-2" /> PDF
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <DashboardCard title="Total Budget" value={summary.totalBudget} icon={Wallet} colorClass="bg-gradient-to-tr from-blue-500 to-sky-500" />
        <DashboardCard title="Total Spent" value={summary.totalSpent} icon={CreditCard} colorClass="bg-gradient-to-tr from-rose-500 to-red-500" />
        <DashboardCard title="Remaining Budget" value={remainingBudget} icon={TrendingUp} colorClass="bg-gradient-to-tr from-emerald-500 to-green-500" />
      </div>
      
      {error && <div className="p-4 mb-6 text-center text-red-700 bg-red-100 rounded-lg flex items-center justify-center gap-2"><AlertCircle/> {error}</div>}

      <div className="bg-white rounded-lg shadow-md overflow-x-auto border-t-4 border-blue-500">
        {isLoading && <div className="p-10 text-center text-gray-500">Loading data...</div>}
        {!isLoading && !error && trackerData.length === 0 && <div className="p-10 text-center text-gray-500">No data available for the selected period.</div>}
        {!isLoading && !error && trackerData.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 uppercase">
              <tr>
                <th className="p-4 font-semibold">Category</th>
                <th className="p-4 font-semibold">Budget</th>
                <th className="p-4 font-semibold">Spent</th>
                <th className="p-4 font-semibold">Remaining</th>
                <th className="p-4 font-semibold text-center">Usage (%)</th>
                <th className="p-4 font-semibold text-center">Remaining (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {trackerData.map((item, index) => {
                const remainingPercentage = item.budget > 0 ? parseFloat(((item.remainingBudget / item.budget) * 100).toFixed(2)) : 0.00;
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-800">{item.category}</td>
                    <td className="p-4 text-gray-700">₹{item.budget.toLocaleString()}</td>
                    <td className="p-4 text-gray-700">₹{item.spentTillDate.toLocaleString()}</td>
                    <td className={`p-4 font-medium ${item.remainingBudget < 0 ? 'text-red-500' : 'text-gray-700'}`}>₹{item.remainingBudget.toLocaleString()}</td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs ${getUsageColor(item.budgetUsedIn)}`}>{item.budgetUsedIn}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs ${getRemainingColor(remainingPercentage)}`}>
                        {remainingPercentage.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}