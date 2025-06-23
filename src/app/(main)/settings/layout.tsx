'use client'

import SettingsNav from './components/Settingsnav';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      {/* Renders the vertical sub-navigation menu on the left */}
      <SettingsNav />

      {/* Renders the page content (e.g., the loyalty form) on the right */}
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}