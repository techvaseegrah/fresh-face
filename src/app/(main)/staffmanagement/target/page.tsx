// src/app/(main)/staffmanagement/target/page.tsx

// Import the Client Component
import TargetView from './TargetView';

// --- THE FIX: Import types directly from the model, the single source of truth ---
import type { TargetSheetData } from '@/models/TargetSheet';

// Data fetching function (using the cache-busting technique for max reliability)
async function getTargetPageData(): Promise<TargetSheetData | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const cacheBuster = `?time=${new Date().getTime()}`;
    const url = `${apiUrl}/api/target${cacheBuster}`;
    
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      console.error("Failed to fetch target data. Status:", res.status);
      throw new Error('Failed to fetch data from server.');
    }
    return res.json();
  } catch (error) {
    console.error("Error in getTargetPageData:", error);
    return null;
  }
}

// The main Server Component for the page
export default async function TargetPage() {
  const data = await getTargetPageData();

  if (!data) {
    return <div className="p-8 text-center text-red-500">Failed to load target data. Please try refreshing the page.</div>;
  }
  
  // Pass the correctly typed data to the Client Component
  return <TargetView initialData={data} />;
}