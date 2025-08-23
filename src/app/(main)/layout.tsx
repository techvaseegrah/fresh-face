// app/(main)/layout.tsx
'use client';

import { useSession } from 'next-auth/react';
// Import usePathname to read the current URL
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import LoadingSpinner from '@/components/LoadingSpinner';

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
      
      {/* Main Content */}
      <div className="flex-1 ml-64 overflow-hidden">
        <main className="h-full overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}