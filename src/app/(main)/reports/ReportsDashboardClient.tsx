// src/app/(main)/reports/ReportsDashboardClient.tsx - CORRECTED
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import {
  IndianRupee, CalendarCheck, Users, GitPullRequestArrow, ReceiptText, Percent,
  TrendingUp, Gift, Package, Plane, Landmark, Banknote, ShieldAlert, LucideIcon,
  Wrench, Zap, ClipboardCheck, BookCheck, BarChart,
} from 'lucide-react';

// --- Reusable UI Component ---
interface SummaryCardProps {
  title: string;
  value: string | number;
  description?: string;
  Icon: LucideIcon;
  link: string;
  isLoading?: boolean;
  color: 'pink' | 'teal' | 'purple' | 'orange' | 'blue' | 'green' | 'red' | 'yellow' | 'indigo' | 'gray' | 'lime' | 'cyan';
}

const colorSchemes = {
  pink: 'from-pink-500 to-rose-500',
  teal: 'from-teal-400 to-cyan-500',
  purple: 'from-purple-500 to-indigo-500',
  orange: 'from-amber-500 to-orange-500',
  blue: 'from-blue-500 to-sky-500',
  green: 'from-green-500 to-emerald-500',
  red: 'from-red-500 to-rose-500',
  yellow: 'from-yellow-400 to-amber-500',
  indigo: 'from-indigo-500 to-violet-500',
  gray: 'from-gray-500 to-slate-600',
  lime: 'from-lime-400 to-green-500',
  cyan: 'from-cyan-400 to-sky-500',
};

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, description, Icon, link, isLoading, color }) => {
    if (isLoading) {
      return (
        <div className="bg-gray-200 p-6 rounded-2xl animate-pulse h-[120px]">
          <div className="h-6 bg-gray-300 rounded w-1/2 mb-4"></div>
          <div className="h-10 bg-gray-300 rounded w-3/4"></div>
        </div>
      );
    }
    return (
      <Link href={link}>
        <div className={`relative p-6 rounded-2xl text-white overflow-hidden transition-all duration-300 hover:scale-105 shadow-lg bg-gradient-to-br ${colorSchemes[color]}`}>
          <div className="relative z-10">
            <p className="text-sm font-medium uppercase tracking-wider">{title}</p>
            <p className="mt-2 text-3xl sm:text-4xl font-bold">{value}</p>
            {description && <p className="text-xs opacity-80 mt-1 truncate">{description}</p>}
          </div>
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
            <Icon className="text-white opacity-80" size={36} style={{ transform: 'translateX(-8px) translateY(8px)' }}/>
          </div>
        </div>
      </Link>
    );
};

// --- Main Client Component ---

interface DashboardData {
  totalSales: number;
  totalInvoices: number;
  appointmentCount: number;
  pendingLeaveRequests: number;
  staffOnLeaveToday: number;
  pendingAdvances: number;
  pendingAdvanceAmount: number;
  giftCardsSoldValue: number;
  packagesSoldValue: number;
  targetAchieved: number;
  targetGoal: number;
  totalSalaryPaid: number;
  topPerformer: { name: string; totalSales: number } | null;
  lowStockToolCount: number;
  latestEBReading: { reading: number; date: string } | null;
  sopStats: { pending: number; approved: number; rejected: number; };
  taskStats: { pending: number; approved: number; rejected: number; };
  pendingIssuesCount: number;
  totalExpenses: number;
  budgetUsage: { percentage: number; totalBudget: number; };
}

export default function ReportsDashboardClient() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const today = new Date();
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(endOfMonth(today), 'yyyy-MM-dd'));
  
  const handleFetchReport = useCallback(async (start: string, end: string, showToast: boolean = false) => {
    const tenantId = session?.user?.tenantId;
    if (!tenantId) {
      setError("Authentication failed: No tenant ID found in session.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/dashboard-summary?startDate=${start}&endDate=${end}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to fetch dashboard data.');
      }
      const result = await res.json();
      setData(result.data);
      if (showToast) {
        toast.success("Dashboard has been updated.");
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (status === 'authenticated') {
      handleFetchReport(startDate, endDate, false);
    } else if (status === 'unauthenticated') {
        setError("You are not authenticated. Please log in.");
        setIsLoading(false);
    }
  }, [status, startDate, endDate, handleFetchReport]);

  const handleApplyFilter = () => {
    handleFetchReport(startDate, endDate, true);
  };

  const formatCurrency = (value: number | undefined) => {
    if (typeof value !== 'number') return '₹0';
    return `₹${Math.round(value).toLocaleString('en-IN')}`;
  };

  const targetPercentage = useMemo(() => {
    if (!data || !data.targetGoal || data.targetGoal === 0) return 0;
    return Math.round((data.targetAchieved / data.targetGoal) * 100);
  }, [data]);
  
  if (error && !data) {
        return (
            <Card>
                <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg flex flex-col items-center gap-4">
                    <ShieldAlert size={40} />
                    <h2 className="text-xl font-bold">Failed to Load Dashboard</h2>
                    <p>{error}</p>
                    <Button onClick={handleApplyFilter} disabled={isLoading}>
                        {isLoading ? 'Retrying...' : 'Retry'}
                    </Button>
                </div>
            </Card>
        )
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="p-4 sm:p-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200/80 mb-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center gap-2">
                    <label htmlFor="startDate" className="text-sm font-medium">From:</label>
                    <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-2 border border-gray-300 rounded-md shadow-sm text-sm" />
                </div>
                <div className="flex items-center gap-2">
                    <label htmlFor="endDate" className="text-sm font-medium">To:</label>
                    <input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-2 border border-gray-300 rounded-md shadow-sm text-sm" min={startDate} />
                </div>
                <Button onClick={handleApplyFilter} disabled={isLoading}>
                    {isLoading ? 'Refreshing...' : 'Apply Filter'}
                </Button>
            </div>
        </div>
      
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <SummaryCard title="Total Sales" value={formatCurrency(data?.totalSales)} Icon={IndianRupee} link="/reports/sales-report" isLoading={isLoading} color="pink" description={`From ${data?.totalInvoices || 0} invoices`} />
            <SummaryCard title="Package Sales" value={formatCurrency(data?.packagesSoldValue)} Icon={Package} link="/reports/package-sales" isLoading={isLoading} color="blue" />
            <SummaryCard title="Gift Card Sales" value={formatCurrency(data?.giftCardsSoldValue)} Icon={Gift} link="/reports/gift-card-sold" isLoading={isLoading} color="green" />
            <SummaryCard title="Appointments" value={data?.appointmentCount ?? 0} Icon={CalendarCheck} link="/reports/appointment-report" isLoading={isLoading} color="purple" />
            <SummaryCard title="Target Achievement" value={`${targetPercentage}%`} Icon={Percent} link="/reports/target-report" isLoading={isLoading} color="teal" description={`${formatCurrency(data?.targetAchieved)} of ${formatCurrency(data?.targetGoal)}`} />
            <SummaryCard title="Expenses Report" value={formatCurrency(data?.totalExpenses)} Icon={Landmark} link="/reports/expenses" isLoading={isLoading} color="gray" description="Total expenses in period" />
            <SummaryCard 
                title="Budget vs Actual" 
                value={`${(data?.budgetUsage?.percentage ?? 0).toFixed(2)}% Used`} 
                Icon={BarChart} 
                link="/reports/budget-vs-actual" 
                isLoading={isLoading} 
                color="cyan" 
                description={`Of ${formatCurrency(data?.budgetUsage?.totalBudget)} budget`} 
            />
            <SummaryCard 
                title="Top Staff Performer" 
                value={data?.topPerformer?.name ?? 'N/A'} 
                Icon={TrendingUp} 
                link="/reports/performance-report" 
                isLoading={isLoading} 
                color="orange"
                description={data?.topPerformer ? `Sales: ${formatCurrency(data.topPerformer.totalSales)}` : 'No sales data'}
            />
            <SummaryCard
                title="Staff Sales Report"
                value="View Details"
                Icon={Users}
                link="/reports/staff-sales-report"
                isLoading={isLoading}
                color="indigo"
                description="Analyse sales per staff member"
            />
            
            {/* ▼▼▼ LINKS CORRECTED TO MATCH YOUR FOLDER STRUCTURE & VALUE MADE DYNAMIC ▼▼▼ */}
            <SummaryCard title="SOP Compliance" value={`${data?.sopStats?.pending ?? 0} Pending`} Icon={BookCheck} link="/reports/sop-compliance" isLoading={isLoading} color="blue" description={`${data?.sopStats?.approved ?? 0} Approved, ${data?.sopStats?.rejected ?? 0} Rejected`} />
            <SummaryCard title="Task Compliance" value={`${data?.taskStats?.pending ?? 0} Pending`} Icon={ClipboardCheck} link="/reports/task-compliance" isLoading={isLoading} color="lime" description={`${data?.taskStats?.approved ?? 0} Approved, ${data?.taskStats?.rejected ?? 0} Rejected`} />
            <SummaryCard title="Issue Dashboard" value={`${data?.pendingIssuesCount ?? 0} Pending`} Icon={ShieldAlert} link="/reports/issue-compliance" isLoading={isLoading} color="yellow" description="Issues requiring attention" />
           
            
            
            <SummaryCard title="Total Salary Paid" value={formatCurrency(data?.totalSalaryPaid)} Icon={Banknote} link="/reports/salary-report" isLoading={isLoading} color="red" description="For the selected period" />
            <SummaryCard title="Pending Advances" value={data?.pendingAdvances ?? 0} Icon={GitPullRequestArrow} link="/reports/advance-report" isLoading={isLoading} color="yellow" description={`Totaling ${formatCurrency(data?.pendingAdvanceAmount)}`} />
            <SummaryCard title="Pending Leave" value={data?.pendingLeaveRequests ?? 0} Icon={Plane} link="/reports/leave-report" isLoading={isLoading} color="gray" description={`${data?.staffOnLeaveToday || 0} on leave today`} />
            <SummaryCard title="Incentive Payouts" value="View Details" Icon={ReceiptText} link="/reports/incentive-payout" isLoading={isLoading} color="lime" description="Review pending & processed" />
            <SummaryCard title="Tool Stock Alert" value={`${data?.lowStockToolCount ?? 0} Items`} Icon={Wrench} link="/reports/tool-stock-report" isLoading={isLoading} color="cyan" description="Tools with low stock" />
            <SummaryCard title="Latest EB Reading" value={data?.latestEBReading?.reading ?? 'N/A'} Icon={Zap} link="/reports/eb-report" isLoading={isLoading} color="pink" description={data?.latestEBReading?.date ? `On ${format(parseISO(data.latestEBReading.date), 'dd MMM yyyy')}` : 'No readings found'} />
        </div>
      </div>
    </div>
  );
}