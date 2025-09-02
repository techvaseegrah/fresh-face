'use client';

import { useState } from 'react';
import clsx from 'clsx';
import Sidebar from '@/components/Sidebar'; // Adjust path if needed

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // State for hover-to-expand on desktop
  const [isExpanded, setIsExpanded] = useState(false);
  // State for opening/closing on mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* --- SIDEBAR --- */}
      {/* It receives the state and functions to update the state */}
      <Sidebar
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* --- MAIN CONTENT WRAPPER --- */}
      {/* This is the key part: it adjusts its margin based on the sidebar's state */}
      <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {/* You can add a Header/Navbar here if you have one */}
        {/* <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} /> */}

        <main
          className={clsx(
            'flex-1 transition-all duration-300 ease-in-out',
            // On desktop, margin changes when sidebar expands
            'md:ml-20',
            { 'md:ml-64': isExpanded }
          )}
        >
          {/* --- THIS IS THE FIXED PART --- */}
          {/* We removed max-w-screen-2xl and mx-auto */}
          <div className="p-4 md:p-6 2xl:p-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}