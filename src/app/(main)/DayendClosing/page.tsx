// FILE: /app/DayendClosing/page.tsx
'use client';

import React, { useState } from 'react';
import { BanknotesIcon, CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';
import DayEndClosingModal from './components/DayEndClosingModal'; // Adjust this path if your components are elsewhere
import Link from 'next/link';


/**
 * A utility function to format a Date object into YYYY-MM-DD string format.
 * This is needed for the date input and for passing to the API.
 */
const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function DayEndClosingPage() {
  // State to manage the visibility of the modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State to store the date for which the closing is being done. Defaults to today.
  const [closingDate, setClosingDate] = useState(formatDateForInput(new Date()));

  const handleOpenModal = () => {
    // Prevent opening modal if date is not selected
    if (!closingDate) {
      alert('Please select a date first.');
      return;
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // This function will be called by the modal on successful submission
  const handleSuccess = () => {
    // You could add logic here to refresh data or redirect if needed
    console.log('Day-end process completed successfully.');
  };

  return (
    <>
      <div className="p-4 md:p-8">
        {/* Page Header */}
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

        {/* Main Content Card */}
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

          {/* Date Selection */}
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
                className="block w-full rounded-md border-gray-300 py-2 pl-10 pr-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
          
          {/* Action Button */}
          <div className="mt-8 border-t pt-6">
            <button
              onClick={handleOpenModal}
              disabled={!closingDate}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Day-End Process for {new Date(closingDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </button>
          </div>
        </main>
      </div>

      {/* The Modal Component */}
      {/* This component is not visible until isModalOpen is true */}
      <DayEndClosingModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        closingDate={closingDate}
      />
    </>
  );
}