'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button'; // Assuming you created the reusable Button

interface ScheduleCallbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  // This function expects the outcome data that logAndProceed needs
  onSchedule: (data: { outcome: string; callbackDate: Date; notes?: string }) => void;
}

export default function ScheduleCallbackModal({ isOpen, onClose, onSchedule }: ScheduleCallbackModalProps) {
  // State for the form inputs
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Reset state when the modal is opened
  useEffect(() => {
    if (isOpen) {
      // Set a default date for tomorrow to make it easier for the user
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0); // Default to 10:00 AM

      // Format for the datetime-local input
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      const hours = String(tomorrow.getHours()).padStart(2, '0');
      const minutes = String(tomorrow.getMinutes()).padStart(2, '0');
      
      setDate(`${year}-${month}-${day}T${hours}:${minutes}`);
      setNotes('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = () => {
    // Basic validation
    if (!date) {
      setError('Please select a callback date and time.');
      return;
    }
    const selectedDate = new Date(date);
    if (selectedDate < new Date()) {
      setError('Callback date cannot be in the past.');
      return;
    }

    // Call the onSchedule function passed from the parent page
    onSchedule({
      outcome: 'Specific Date', // We can standardize on this outcome
      callbackDate: selectedDate,
      notes: notes.trim(),
    });

    // Close the modal after successful submission
    onClose();
  };

  return (
    // Modal backdrop
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      {/* Modal content */}
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md animate-fade-in-up">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Schedule a Callback</h2>
        
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <div className="space-y-4">
          <div>
            <label htmlFor="callback-date" className="block text-sm font-medium text-gray-700">
              Callback Date & Time
            </label>
            <input
              type="datetime-local"
              id="callback-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Client asked to call after 5 PM regarding hair spa."
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex justify-end space-x-3">
          <Button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800">
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white">
            Schedule Callback
          </Button>
        </div>
      </div>
    </div>
  );
}