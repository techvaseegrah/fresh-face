// src/app/(main)/reports/layout.tsx
'use client';

import React, { useState } from 'react';
import { ReportsNav } from './components/ReportsNav';
import { Menu, X } from 'lucide-react';

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode; 
}): JSX.Element {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">Reports</h1>
          <button
            onClick={toggleMobileMenu}
            className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[44px] min-w-[44px]"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-50 bg-black bg-opacity-50" 
          onClick={closeMobileMenu}
        >
          <div 
            className="bg-white w-64 h-full shadow-lg" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">Navigation</h2>
                <button
                  onClick={closeMobileMenu}
                  className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                  aria-label="Close navigation menu"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-4">
              <ReportsNav onItemClick={closeMobileMenu} />
            </div>
          </div>
        </div>
      )}

      <div className="flex p-3 sm:p-4 md:p-6">
        {/* Desktop Navigation - Hidden on mobile */}
        <aside className="hidden md:block w-64 pr-6 lg:pr-8 self-start sticky top-8">
          <ReportsNav />
        </aside>

        {/* Main content area */}
        <main className="flex-1 w-full md:border-l md:border-gray-200 md:pl-6 lg:pl-8">
          {children}
        </main>
      </div>
    </div>
  );
}