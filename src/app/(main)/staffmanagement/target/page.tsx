// Make the page dynamic for API fetches
export const dynamic = 'force-dynamic';

import TargetView from './TargetView';
import type { TargetSheetData } from '@/models/TargetSheet';
import { headers } from 'next/headers'; // 1. Import the headers function

// Function to fetch target data from your internal API
async function getTargetPageData(requestHeaders: Headers): Promise<TargetSheetData | null> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const cacheBuster = `?time=${Date.now()}`;

    // 2. Pass the headers along in the fetch request
    const res = await fetch(`${baseUrl}/api/target${cacheBuster}`, {
      cache: 'no-store',
      headers: requestHeaders, // This sends the x-tenant-id to the API
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`Failed to fetch target data. Status: ${res.status}, Body: ${errorBody}`);
      return null;
    }

    return res.json();
  } catch (error) {
    console.error('Error in getTargetPageData:', error);
    return null;
  }
}

// The page component
export default async function TargetPage() {
  // 3. Get the headers and pass them to the data fetching function
  const requestHeaders = headers();
  const data = await getTargetPageData(requestHeaders);

  if (!data) {
    return (
      <div className="p-8 text-center text-red-500">
        Failed to load target data. Please try refreshing the page.
      </div>
    );
  }

  return <TargetView initialData={data} />;
}