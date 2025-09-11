// src/app/(main)/reports/staff-sales-report/page.tsx

// --- THIS IS THE FIX (1/3): Import helpers to get the server-side session ---
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Adjust this path if your authOptions are elsewhere

import { format, startOfMonth } from 'date-fns';
import StaffSalesReportView, { StaffSaleRecord } from './StaffSalesReportView';

// This function now runs on the SERVER and gets the tenantId from the session
async function getInitialReportData(): Promise<{ data: StaffSaleRecord[]; error?: string }> {
  try {
    // --- THIS IS THE FIX (2/3): Get the session on the server ---
    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId;

    if (!tenantId) {
      // This is now the primary check for the tenant
      throw new Error("Tenant identification failed. Your session may have expired.");
    }

    // Construct the full URL for the server-to-server fetch
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const startDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const endDate = format(new Date(), 'yyyy-MM-dd');

    const res = await fetch(`${baseUrl}/api/reports/staff-sales-report?startDate=${startDate}&endDate=${endDate}`, {
      cache: 'no-store',
      // --- THIS IS THE FIX (3/3): Pass the tenantId from the session in the header ---
      headers: { 'x-tenant-id': tenantId }
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.message || `API Error: ${res.statusText}`);
    }

    const result = await res.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to get report data from API.');
    }

    return { data: result.data || [] };
  } catch (error: any) {
    console.error("Error in getInitialReportData:", error);
    return { data: [], error: error.message };
  }
}

// This is the main page component, now a SERVER component
export default async function StaffSalesReportPage() {
  const { data, error } = await getInitialReportData();

  // The client component receives the data fetched on the server
  return <StaffSalesReportView initialData={data} initialError={error} />;
}