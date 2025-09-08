'use client'

import SettingsNav from './components/SettingsNav';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const canReadSettings = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.SETTINGS_READ);

  if (!canReadSettings) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="text-gray-600">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Mobile and Desktop Layout */}
      <div className="md:flex md:h-full">
        {/* Renders the vertical sub-navigation menu on the left for desktop, mobile header for mobile */}
        <SettingsNav />

        {/* Renders the page content on the right for desktop, full width for mobile */}
        <main className="flex-1 md:p-6 md:overflow-y-auto">
          <div className="md:hidden p-4">
            {children}
          </div>
          <div className="hidden md:block">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}