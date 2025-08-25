'use client';

import { Info } from 'lucide-react';

interface ConfirmDialogProps {
  message: string;
  feedback?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ message, feedback, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="mt-1">
          <Info size={20} className="text-blue-500" />
        </div>
        <div>
          <p className="font-semibold text-gray-800">{message}</p>
          {feedback && (
            <blockquote className="mt-2 pl-3 border-l-2 border-gray-300 text-sm text-gray-600 italic">
              "{feedback}"
            </blockquote>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700"
        >
          Confirm Re-submit
        </button>
      </div>
    </div>
  );
}