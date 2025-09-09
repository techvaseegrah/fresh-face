// src/app/(main)/reports/layout.tsx
import React from 'react';
import { ReportsNav } from './components/ReportsNav';

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode; 
}): JSX.Element {
  return (
    <div className="flex p-6">

      {/* Left-hand navigation column */}
      <aside className="w-full lg:w-64 pr-8 self-start sticky top-8">
        <ReportsNav />
      </aside>

      {/* Right-hand main content area */}
      {/* ▼▼▼ THESE ARE THE CLASSES THAT ADD THE VERTICAL LINE ▼▼▼ */}
      <main className="flex-1 w-full border-l border-gray-200 pl-8">
        {children}
      </main>
      
    </div>
  );
}