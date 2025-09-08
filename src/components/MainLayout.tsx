// src/components/MainLayout.tsx
'use client';

import { useState } from 'react';
import clsx from 'clsx';
import Sidebar from '@/components/Sidebar'; 
import { Bars3Icon } from '@heroicons/react/24/outline';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    // The root layout container
    <div className="flex h-screen bg-gray-50">
      {/* --- SIDEBAR --- */}
      {/* This component is separate and does not scroll */}
      <Sidebar
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* --- MAIN CONTENT WRAPPER --- */}
      {/* This wrapper will contain the header and the main content */}
      <div className={clsx(
        "relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden",
        'md:ml-20',
        isExpanded && 'md:ml-64'
      )}>

        {/* ▼▼▼ THIS IS THE FIX ▼▼▼ */}
        {/* The <header> MUST be the FIRST item inside this div. */}
        {/* 'sticky top-0' locks it to the top. */}
        <header className="sticky top-0 z-20 flex h-[65px] flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm md:hidden">
          {/* Hamburger Button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-800 focus:outline-none"
            aria-label="Open sidebar"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          
          <h1 className="text-lg font-semibold text-gray-800">
            Fresh Face Salon
          </h1>
          
          {/* Spacer to center the title */}
          <div className="w-6" />
        </header>
        {/* ▲▲▲ END OF FIX ▲▲▲ */}

        {/* The <main> content comes AFTER the header */}
        <main className="flex-1 p-4 md:p-6 2xl:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}