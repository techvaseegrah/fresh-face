'use client';

import React, { useState, useCallback } from 'react';
import { useSession, getSession } from 'next-auth/react'; // 1. IMPORT getSession
import { toast } from 'react-toastify'; // Import toast for error handling in tenantFetch
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { BanknotesIcon, CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';
import DayEndClosingModal from './components/DayEndClosingModal';
import Link from 'next/link';

const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function DayEndClosingPage() {
  const { data: session } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [closingDate, setClosingDate] = useState(formatDateForInput(new Date()));

  // 2. ADD THE tenantFetch HELPER FUNCTION (from your DashboardPage)
  const tenantFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const currentSession = await getSession(); 
    if (!currentSession?.user?.tenantId) {
      toast.error("Session error: Tenant not found. Please log in again.");
      throw new Error("Missing tenant ID in session");
    }
    const headers = {
      ...options.headers,
      'Content-Type': 'application/json',
      'x-tenant-id': currentSession.user.tenantId,
    };
    return fetch(url, { ...options, headers });
  }, []);
  // ----------------------------------------------------------------------

  // Permission checks
  const canReadDayEnd = session && (hasPermission(session.user.role.permissions, PERMISSIONS.DAYEND_READ) || hasPermission(session.user.role.permissions, PERMISSIONS.DAYEND_MANAGE));
  const canCreateDayEnd = session && (hasPermission(session.user.role.permissions, PERMISSIONS.DAYEND_CREATE) || hasPermission(session.user.role.permissions, PERMISSIONS.DAYEND_MANAGE));

  // Check for read permission
  if (!session) {
    // Optional: Add a loading state while session is being fetched
    return <div className="p-6 bg-gray-50 min-h-screen">Loading session...</div>;
  }
  if (!canReadDayEnd) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <p className="text-red-500 font-semibold">Access Denied: You do not have permission to view day-end closing.</p>
      </div>
    );
  }

  const handleOpenModal = () => {
    if (!closingDate) {
      toast.error('Please select a date first.');
      return;
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSuccess = () => {
    // This is called when the modal's submission is successful
    // You might want to refresh some data here in the future
    handleCloseModal(); // Close the modal on success
  };

  return (
    <>
      <div className="p-6 bg-gray-50 min-h-screen">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Day-end Closing</h1>
          <p className="mt-1 text-sm text-gray-600">
            Reconcile and confirm the day's financial transactions.
          </p>
        </header>

        <div className="mb-6 text-right">
          <Link href="/DayendClosing/history"
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <ClockIcon className="h-5 w-5 text-gray-400" />
            View Closing History
          </Link>
        </div>

        <main className="bg-white p-6 md:p-8 rounded-xl shadow-sm max-w-2xl mx-auto">
          <div className="text-center">
            <BanknotesIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h2 className="mt-4 text-xl font-semibold text-gray-800">
              Start the Closing Process
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Select the date for which you want to reconcile the accounts. The process will compare system-recorded sales with your physical counts.
            </p>
          </div>

          <div className="mt-8">
            <label htmlFor="closing-date" className="block text-sm font-medium text-gray-700 mb-2">
              Select Closing Date
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <CalendarIcon className="h-5 w-5 text-gray-400" />
              </div>
             <input
                id="closing-date"
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                className="block w-full rounded-lg border-2 border-black py-3.5 pl-14 pr-4 text-gray-900 shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 text-lg sm:leading-6"
                disabled={!canCreateDayEnd}
            />
            </div>
          </div>
          
          <div className="mt-8 border-t pt-6">
            {canCreateDayEnd ? (
              <button
                onClick={handleOpenModal}
                disabled={!closingDate}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Day-End Process for {new Date(closingDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </button>
            ) : (
              <p className="text-center text-gray-500 text-sm">
                You don't have permission to create day-end closing reports.
              </p>
            )}
          </div>
        </main>
      </div>

      {/* 3. PASS tenantFetch AS A PROP TO THE MODAL */}
      {isModalOpen && canCreateDayEnd && (
        <DayEndClosingModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
          closingDate={closingDate}
          tenantFetch={tenantFetch} // <-- This is the crucial fix
        />
      )}
    </>
  );
}