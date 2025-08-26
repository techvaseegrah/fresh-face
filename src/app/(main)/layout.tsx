// app/(main)/layout.tsx
'use client';

import { useSession } from 'next-auth/react';
// Import usePathname to read the current URL
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Bars3Icon } from '@heroicons/react/24/outline';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  // Get the current URL path
  const pathname = usePathname();

  // --- NEW: Check if the current page is a staff page ---
  // This assumes your staff routes start with '/staff-dashboard'
  const isStaffPage = pathname.startsWith('/staff-dashboard');

  useEffect(() => {
    if (status === 'loading') return;
    
    // The session check remains the same
    if (!session) {
      router.push('/login');
      return;
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return <LoadingSpinner />;
  }

  if (!session) {
    // This also remains the same
    return null;
  }
  
  // --- NEW: Conditionally render the layout ---
  // If it's a staff page, render *only* the children. This allows the 
  // staff-specific layout to take full control of the page structure.
  if (isStaffPage) {
    return <>{children}</>;
  }

  // If it's NOT a staff page, render the standard admin layout with the sidebar.
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar is only rendered for non-staff pages */}
      <Sidebar />
      
      {/* --- CORRECTED MAIN CONTENT AREA --- */}
      {/* 
        CHANGE 1: Removed `overflow-hidden`.
        CHANGE 2: Added `flex flex-col` to make it a flex container.
        CHANGE 3: Added `overflow-y-auto` here. This is now the scrollable container.
      */}
      <div className="flex-1 md:ml-64 flex flex-col overflow-y-auto">
        
        {/* Mobile-only Top Bar with Hamburger Menu (This remains the same) */}
        <div className="sticky top-0 z-10 flex md:hidden items-center justify-between border-b bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white font-bold text-sm">FF</div>
              <h1 className="text-lg font-semibold text-gray-800">Fresh Face</h1>
            </div>
            <button 
              type="button" 
              className="text-gray-500 hover:text-gray-600"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="sr-only">Open sidebar</span>
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>
        </div>

        {/* 
          CHANGE 4: Removed `h-full` and `overflow-y-auto` from <main>.
          It will now grow naturally with its content.
        */}
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}