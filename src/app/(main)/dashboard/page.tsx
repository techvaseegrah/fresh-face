// /app/(main)/dashboard/page.tsx - TENANT-AWARE VERSION
'use client';

import React, { useState, useEffect, useCallback, FC } from 'react';
import { useSession, getSession } from 'next-auth/react'; // <-- 1. Import getSession
import {
  CalendarDaysIcon,
  UserGroupIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  UserIcon as UserOutline,
  UsersIcon,
  DocumentTextIcon,
  ReceiptPercentIcon,
  BanknotesIcon,
  QrCodeIcon,
  XCircleIcon,
  ScaleIcon,
  CurrencyRupeeIcon,
} from '@heroicons/react/24/outline';
import {
  CalendarDaysIcon as CalendarSolid,
  UserGroupIcon as UserSolid,
} from '@heroicons/react/24/solid';
import AnimatedNumber from '@/components/AnimatedNumber';
import { toast } from 'react-toastify'; // Good for showing errors

// --- Reusable Components (No changes needed here) ---
const StatCard: FC<any> = ({ title, value, icon: Icon, color = 'blue', onClick }) => {
  const colorClasses: any = { blue: 'text-blue-600 bg-blue-50', green: 'text-green-600 bg-green-50', purple: 'text-purple-600 bg-purple-50', red: 'text-red-600 bg-red-50' };
  return (<div className={`flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}><div className="flex items-center justify-between flex-grow"><div className="flex-1 min-h-[60px]"><p className="text-sm font-medium text-gray-600 mb-1">{title}</p><div className="text-3xl font-bold text-gray-900">{typeof value === 'number' ? <AnimatedNumber value={value} /> : value}</div></div><div className={`p-3 rounded-lg ${colorClasses[color]}`}><Icon className={`h-6 w-6 ${colorClasses[color].split(' ')[0]}`} /></div></div></div>);
};
const QuickActionCard: FC<any> = ({ title, description, icon: Icon, onClick }) => (<div onClick={onClick} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all cursor-pointer group hover:border-gray-300"><div className="flex items-start space-x-4"><div className="p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100 transition-colors"><Icon className="h-6 w-6 text-gray-600" /></div><div className="flex-1"><h3 className="text-lg font-semibold text-gray-900 group-hover:text-gray-700">{title}</h3><p className="text-sm text-gray-600 mt-1">{description}</p></div></div></div>);
const LowStockStatCard = ({ data }: { data: any }) => {
  return (<div className="group relative"><StatCard title="Products Low on Stock" value={data.count} icon={ExclamationTriangleIcon} color="red" onClick={() => (window.location.href = '/shop')} />{data.count > 0 && (<div className="absolute top-full mt-2 w-72 max-h-64 overflow-y-auto rounded-xl bg-white text-black opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none shadow-xl border border-gray-200"><div className="p-3"><div className="mb-2 pb-2 border-b border-gray-200"><h4 className="font-semibold text-base text-gray-800">Low Stock Items</h4><p className="text-xs text-gray-500">Threshold is {data.threshold} or less</p></div><ul className="space-y-1">{data.products.slice(0, 10).map((p: any) => (<li key={p.sku} className="flex items-center justify-between text-sm p-1.5 rounded-md"><div className="flex items-center min-w-0"><ExclamationTriangleIcon className="h-4 w-4 text-red-400 mr-2 shrink-0" /><span className="truncate pr-2 text-gray-700">{p.name}</span></div><span className="font-bold text-red-600 whitespace-nowrap">{p.numberOfItems} left</span></li>))}{data.products.length > 10 && (<p className="text-gray-500 text-xs mt-2 text-center border-t border-gray-200 pt-2">...and {data.products.length - 10} more</p>)}</ul></div><div className="absolute left-1/2 -translate-x-1/2 top-[-5px] h-2.5 w-2.5 bg-white rotate-45 border-l border-t border-gray-200"></div></div>)}</div>);
};
const SalesStatCard: FC<{ title: string; value: number; icon: React.ElementType; color?: string; isCurrency?: boolean; }> = ({ title, value, icon: Icon, color = 'bg-gray-100 text-gray-600', isCurrency = false }) => (<div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center space-x-4"><div className={`p-3 rounded-lg ${color}`}> <Icon className="h-6 w-6" /> </div><div><p className="text-sm text-gray-500">{title}</p><div className="text-2xl font-bold text-gray-900"><AnimatedNumber value={value} prefix={isCurrency ? '₹' : ''} decimals={isCurrency ? 2 : 0} /></div></div></div>);
const SummaryStatCard: FC<{ title: string; value: React.ReactNode; icon: React.ElementType; color: string; subtitle?: string; subValue?: React.ReactNode; }> = ({ title, value, icon: Icon, color, subtitle, subValue }) => {
  const colorClasses: any = { blue: 'text-blue-600 bg-blue-50', green: 'text-green-600 bg-green-50', purple: 'text-purple-600 bg-purple-50', red: 'text-red-600 bg-red-50', pink: 'text-pink-600 bg-pink-50', teal: 'text-teal-600 bg-teal-50', orange: 'text-orange-600 bg-orange-50' };
  return (<div className="flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"><div className="flex items-start justify-between flex-grow"><div className="flex-1 min-h-[60px]"><p className="text-sm font-medium text-gray-600 mb-1">{title}</p><div className="text-3xl font-bold text-gray-900">{value}</div>{subtitle && (<div className="mt-2"><p className="text-xs font-medium text-gray-500">{subtitle}</p><div className="text-lg font-semibold text-gray-800">{subValue}</div></div>)}</div><div className={`p-3 rounded-lg ${colorClasses[color]}`}><Icon className={`h-6 w-6 ${colorClasses[color].split(' ')[0]}`} /></div></div></div>);
};


// --- Main Dashboard Page Component ---
export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<any>({ todayAppointments: 0, totalCustomers: 0, monthlyRevenue: 0 });
  const [lowStockData, setLowStockData] = useState<any>({ count: 0, products: [] });
  const [isOverviewLoading, setIsOverviewLoading] = useState(true);
  const [salesReportData, setSalesReportData] = useState<any>(null);
  const [isReportLoading, setIsReportLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];
  const [dateRange, setDateRange] = useState({ startDate: today, endDate: today });

  // <-- 2. ADD THE TENANT-AWARE FETCH HELPER -->
  const tenantFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const currentSession = await getSession(); // Use getSession for the latest data
    if (!currentSession?.user?.tenantId) {
      // This is a critical error, the user should not be here.
      toast.error("Your session is invalid. Please log in again.");
      throw new Error("Missing tenant ID in session");
    }
    const headers = {
      ...options.headers,
      'x-tenant-id': currentSession.user.tenantId,
    };
    return fetch(url, { ...options, headers });
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsOverviewLoading(true);
      try {
        // <-- 3. USE tenantFetch FOR ALL API CALLS -->
        const [statsRes, lowStockRes] = await Promise.all([
          tenantFetch('/api/dashboard/stats'),
          tenantFetch('/api/dashboard/low-stock-products')
        ]);
        
        if (statsRes.ok) {
            const data = await statsRes.json();
            if(data.success) setStats(data.stats);
        } else {
             toast.error("Could not load dashboard overview stats.");
        }

        if (lowStockRes.ok) {
            const data = await lowStockRes.json();
            if(data.success) setLowStockData(data);
        } else {
            toast.error("Could not load low stock product data.");
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error("An unexpected error occurred while fetching dashboard data.");
      } finally {
        setIsOverviewLoading(false);
      }
    };
    if (session) { // Only fetch data if the session is available
        fetchDashboardData();
    }
  }, [session, tenantFetch]); // <-- 4. Add tenantFetch to dependency array

  const fetchSalesReportData = useCallback(async () => {
    if (!session) return; // Don't fetch if no session
    setIsReportLoading(true);
    try {
      const { startDate, endDate } = dateRange;
      // <-- 3. USE tenantFetch FOR ALL API CALLS -->
      const response = await tenantFetch(`/api/dashboard/sales-summary?startDate=${startDate}&endDate=${endDate}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.message || "Failed to fetch sales data.");
      setSalesReportData(result.data);
    } catch (err: any) {
      console.error("Failed to fetch sales report", err);
      toast.error(err.message);
      setSalesReportData(null); // Clear data on error
    } finally {
      setIsReportLoading(false);
    }
  }, [dateRange, session, tenantFetch]); // <-- 4. Add dependencies

  useEffect(() => {
    fetchSalesReportData();
  }, [fetchSalesReportData]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => setDateRange(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const formatCurrency = (amount: number, digits = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount || 0);
  const totalFilteredRevenue = salesReportData ? salesReportData.payments.Cash + salesReportData.payments.Card + salesReportData.payments.Ewallet : 0;
  
  // (The entire JSX return statement remains exactly the same)
  return (
    <div className="space-y-8 p-6 bg-gray-50 min-h-screen">
      {/* SECTION 1: ORIGINAL DASHBOARD (OVERVIEW) */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div><h1 className="text-3xl font-bold text-gray-900">Welcome back, {session?.user.name}! 👋</h1><p className="text-gray-600 mt-1">Here's what's happening at your salon today.</p></div>
        </div>
        
        {isOverviewLoading ? <div className="animate-pulse mt-6"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"><div className="h-32 bg-gray-200 rounded-xl"></div><div className="h-32 bg-gray-200 rounded-xl"></div><div className="h-32 bg-gray-200 rounded-xl"></div><div className="h-32 bg-gray-200 rounded-xl"></div></div></div> : (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Today's Appointments" value={stats.todayAppointments} icon={CalendarSolid} color="blue" onClick={() => window.location.href = '/appointment'} />
              <StatCard title="Total Customers" value={stats.totalCustomers} icon={UserSolid} color="green" onClick={() => window.location.href = '/crm'} />
              <StatCard title="Monthly Revenue" value={formatCurrency(stats.monthlyRevenue)} icon={CreditCardIcon} color="purple" />
              <LowStockStatCard data={lowStockData} />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><QuickActionCard title="Book Appointment" description="Schedule a new appointment for a customer" icon={CalendarDaysIcon} onClick={() => window.location.href = '/appointment'} /><QuickActionCard title="Add Customer" description="Register a new customer in the system" icon={UserGroupIcon} onClick={() => window.location.href = '/crm'} /></div>
            </div>
          </div>
        )}
      </div>

      <hr className="my-8 border-gray-300 border-dashed" />

      {/* SECTION 2: NEW SALES SUMMARY REPORT */}
      <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Sales Summary</h2>
        <div className="bg-gray-50 p-4 rounded-xl border mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div><label htmlFor="startDate" className="text-sm font-medium mr-2">From:</label><input type="date" name="startDate" value={dateRange.startDate} onChange={handleDateChange} className="p-2 border rounded-md text-sm" /></div>
            <div><label htmlFor="endDate" className="text-sm font-medium mr-2">To:</label><input type="date" name="endDate" value={dateRange.endDate} onChange={handleDateChange} className="p-2 border rounded-md text-sm" /></div>
          </div>
        </div>

        {isReportLoading ? <div className="text-center p-10 font-semibold text-gray-600">Loading Report...</div> : !salesReportData ? <div className="text-center p-10 text-red-500 bg-red-50 rounded-lg">Could not load sales report.</div> : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               <SummaryStatCard title="Service Bills" value={<AnimatedNumber value={salesReportData.serviceBills} />} icon={DocumentTextIcon} color="pink" />
              <SummaryStatCard title="Total Revenue" value={<AnimatedNumber value={totalFilteredRevenue} prefix="₹" decimals={2} />} icon={CurrencyRupeeIcon} color="teal" />
              <SummaryStatCard title="Service Net" value={<AnimatedNumber value={salesReportData.serviceNet} prefix="₹" decimals={2} />} icon={ReceiptPercentIcon} color="orange" subtitle="Gross" subValue={<AnimatedNumber value={salesReportData.serviceGross} prefix="₹" decimals={2} />} />
              <SummaryStatCard title="Product Net" value={<AnimatedNumber value={salesReportData.productNet} prefix="₹" decimals={2} />} icon={BanknotesIcon} color="purple" subtitle="Gross" subValue={<AnimatedNumber value={salesReportData.productGross} prefix="₹" decimals={2} />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <SalesStatCard title="No. Of Bills" value={salesReportData.noOfBills} icon={DocumentTextIcon} />
                <div className="grid grid-cols-2 gap-4"><SalesStatCard title="Men" value={salesReportData.men} icon={UserOutline} /><SalesStatCard title="Women" value={salesReportData.women} icon={UsersIcon} color="bg-pink-100 text-pink-600" /></div>
                <SalesStatCard title="No. Of Cancelled Bills" value={salesReportData.noOfCancelledBills} icon={XCircleIcon} />
                <SalesStatCard title="Total Discount" value={salesReportData.totalDiscount} icon={ReceiptPercentIcon} isCurrency={true} />
                <SalesStatCard title="Average Sale" value={salesReportData.averageSale} icon={ScaleIcon} isCurrency={true} />
              </div>
              <div className="space-y-4">
                <SalesStatCard title="Cash" value={salesReportData.payments.Cash} icon={BanknotesIcon} color="bg-green-100 text-green-600" isCurrency={true}/><SalesStatCard title="Card" value={salesReportData.payments.Card} icon={CreditCardIcon} color="bg-red-100 text-red-600" isCurrency={true} /><SalesStatCard title="E-wallet" value={salesReportData.payments.Ewallet} icon={QrCodeIcon} color="bg-blue-100 text-blue-600" isCurrency={true} />
                <div className="p-4 bg-white rounded-xl shadow-sm border"><h3 className="font-semibold mb-2 text-lg">Total Collection</h3><div className="space-y-2 text-sm"><p className="flex justify-between border-b pb-1"><span>Σ = Total Cash</span> <span className="font-bold"><AnimatedNumber value={salesReportData.payments.Cash} prefix="₹" decimals={2} /></span></p><p className="flex justify-between border-b pb-1"><span>Σ = Total Card</span> <span className="font-bold"><AnimatedNumber value={salesReportData.payments.Card} prefix="₹" decimals={2} /></span></p><p className="flex justify-between"><span>Σ = Total Ewallet</span> <span className="font-bold"><AnimatedNumber value={salesReportData.payments.Ewallet} prefix="₹" decimals={2} /></span></p></div></div>
              </div>
              <div className="p-4 bg-white rounded-xl shadow-sm border space-y-4">
                <div><h3 className="font-semibold text-lg mb-2">E-Wallet Details</h3><div className="space-y-2 text-sm"><p className="flex justify-between"><span>UPI</span> <span className="font-medium"><AnimatedNumber value={salesReportData.ewalletBreakdown.UPI} prefix="₹" decimals={2} /></span></p><p className="flex justify-between"><span>Other</span> <span className="font-medium"><AnimatedNumber value={salesReportData.ewalletBreakdown.Other} prefix="₹" decimals={2} /></span></p></div></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}