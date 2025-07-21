// src/app/(main)/staffmanagement/target/page.tsx

// Mark as dynamic to allow runtime fetches like no-store
export const dynamic = 'force-dynamic'; // ✅ this avoids static data fetch limitations

// Import the Client Component
import TargetView from './TargetView';

// Import types directly from the model
import type { TargetSheetData } from '@/models/TargetSheet';

// Data fetching function using relative fetch (safe in server component)
async function getTargetPageData(): Promise<TargetSheetData | null> {
  try {
    const cacheBuster = `?time=${Date.now()}`;
    const url = `/api/target${cacheBuster}`; // ✅ use relative URL, safe in Vercel

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

// Main Server Component for the page
export default async function TargetPage() {
  const data = await getTargetPageData();

  if (!data) {
    return (
      <div className="p-8 text-center text-red-500">
        Failed to load target data. Please try refreshing the page.
      </div>
    );
  }

  // Render client component with server-fetched data
  return <TargetView initialData={data} />;
}
