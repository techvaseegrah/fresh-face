// src/components/Layout.tsx
'use client';

import { useState } from 'react';
import Sidebar from './Sidebar'; // Make sure this path is correct
import { Bars3Icon } from '@heroicons/react/24/outline';

export default function Layout({ children }) {
  // State to control mobile sidebar visibility
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // State to control desktop sidebar expansion
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar Component */}
      <Sidebar 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
        isExpanded={isExpanded} 
        setIsExpanded={setIsExpanded} 
      />

      {/* Main Content Area */}
      <div className={
        `flex-1 flex flex-col transition-all duration-300 ease-in-out ${isExpanded ? 'md:pl-64' : 'md:pl-20'}`
      }>
        {/* Mobile Header with Hamburger Menu Button */}
        <header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden">
          <div>
            {/* You can put your mobile logo here */}
            <h1 className="text-lg font-bold">Salon Dashboard</h1>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="-ml-2 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
          >
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}