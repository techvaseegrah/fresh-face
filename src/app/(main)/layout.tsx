'use client';

import { useState } from 'react';
import clsx from 'clsx';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';
import { Bars3Icon } from '@heroicons/react/24/outline';

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
        
        {/* Mobile Header with Hamburger Menu Button */}
        <header className="sticky top-0 z-20 flex h-[65px] flex-shrink-0 items-center border-b border-gray-200 bg-white px-3 sm:px-4 lg:px-6 shadow-sm md:hidden">
          <div className="flex items-center">
            {/* Hamburger Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-800 focus:outline-none transition-colors p-1 sm:p-2"
              aria-label="Open sidebar"
            >
              <Bars3Icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            
            <div className="flex items-center ml-1 sm:ml-2">
              {/* Salon Capp Logo */}
              <div className="relative h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                <Image
                  src="/image.png"
                  alt="Salon Capp Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <div className="ml-1 sm:ml-2">
                <h1 className="text-base sm:text-lg font-semibold text-gray-800 leading-tight">
                  Salon Capp
                </h1>
                <p className="text-xs text-gray-500 leading-none">Salon Management</p>
              </div>
            </div>
          </div>
        </header>

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