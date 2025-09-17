// src/app/(main)/reports/page.tsx

import Link from 'next/link';
import { Suspense } from 'react';
import {
  IndianRupee,
  CalendarCheck,
  Users,
  GitPullRequestArrow,
  ReceiptText,
  Percent,
  TrendingUp,
  Gift,
  Package,
  Plane,
  Clock,
  Banknote,
  ShieldAlert,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { getTenantIdOrBail } from '@/lib/tenant';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { startOfMonth, endOfMonth, format } from 'date-fns';

// Import the new client component we will create in this file
import ReportsDashboardClient from './ReportsDashboardClient';

// Helper function to fetch initial data on the server
async function getInitialDashboardData() {
  try {
    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId;

    if (!tenantId) {
      throw new Error('User session or tenant ID not found.');
    }
    
    const today = new Date();
    const defaultStartDate = format(startOfMonth(today), 'yyyy-MM-dd');
    const defaultEndDate = format(endOfMonth(today), 'yyyy-MM-dd');

    // This assumes your API is running on the same domain.
    // In a real environment, you'd use an environment variable for the base URL.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/reports/dashboard-summary?startDate=${defaultStartDate}&endDate=${defaultEndDate}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId,
        // If using cookies for auth, they will be passed automatically in server-to-server fetch.
      },
       cache: 'no-store', // Ensure fresh data on every load
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to fetch initial dashboard data:", errorData.message);
      throw new Error(errorData.message || 'Could not load dashboard summary.');
    }

    return await response.json();
  } catch (error: any) {
    console.error("Error in getInitialDashboardData:", error);
    // Return a structured error to be handled by the client component
    return { error: error.message || 'An unexpected error occurred.' };
  }
}


// The main server component for the reports dashboard page
export default async function ReportsHomePage() {
  const initialData = await getInitialDashboardData();

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reports Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm">A high-level overview of your business performance.</p>
        </div>
      </div>

      {/* 
        We pass the server-fetched initialData to the client component.
        This provides a fast initial page load with data, while allowing
        the client to take over for interactive filtering.
      */}
      <Suspense fallback={<DashboardLoadingSkeleton />}>
        <ReportsDashboardClient initialData={initialData} />
      </Suspense>
    </div>
  );
}

// A simple loading skeleton to show while the server-side data is being fetched
function DashboardLoadingSkeleton() {
    return (
        <Card>
            <div className="p-4">
                 <div className="h-8 bg-gray-200 rounded w-1/3 mb-6 animate-pulse"></div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="bg-gray-100 p-4 rounded-lg animate-pulse">
                            <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
                            <div className="h-10 bg-gray-200 rounded w-3/4"></div>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    )
}