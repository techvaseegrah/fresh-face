// src/app/(main)/telecalling/components/ComplaintModal.tsx
'use client';
import { useState } from 'react';
import  Button  from '@/components/ui/Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLogComplaint: (data: { outcome: string; notes: string }) => void;
}

export default function ComplaintModal({ isOpen, onClose, onLogComplaint }: Props) {
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!notes.trim()) {
      alert('Please enter the complaint details.');
      return;
    }
    onLogComplaint({
      outcome: 'Complaint',
      notes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Log Complaint Details</h2>
        <textarea
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Please provide specific details about the client's complaint..."
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
        <div className="mt-6 flex justify-end space-x-3">
          <Button onClick={onClose} className="bg-gray-300 hover:bg-gray-400 text-black">Cancel</Button>
          <Button onClick={handleSubmit} className="bg-red-600 hover:bg-red-700">Log Complaint</Button>
        </div>
      </div>
    </div>
  );
}