'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { X } from 'lucide-react';
import type { ToolLogAction } from '@/models/ToolLog'; // Import the type from your model

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tool: {
    _id: string;
    name: string;
    currentStock: number;
  } | null;
  tenantId: string | undefined;
}

export function StockAdjustmentModal({ isOpen, onClose, onSuccess, tool, tenantId }: StockAdjustmentModalProps) {
  const [action, setAction] = useState<ToolLogAction>('ADDITION');
  const [quantity, setQuantity] = useState(1);
  const [remarks, setRemarks] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form state when the modal is opened or the tool changes
  useEffect(() => {
    if (isOpen) {
      setAction('ADDITION');
      setQuantity(1);
      setRemarks('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!tenantId || !tool) {
      setError("Cannot perform action: Required information is missing.");
      return;
    }
    if (quantity <= 0) {
      setError("Quantity must be a positive number.");
      return;
    }
    // Prevent reducing stock below zero
    if (action !== 'ADDITION' && quantity > tool.currentStock) {
        setError(`Cannot reduce stock by ${quantity}. Only ${tool.currentStock} available.`);
        return;
    }


    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tool-stock/stock-adjustment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          toolId: tool._id,
          action,
          quantity,
          remarks,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'An unknown error occurred.');
      }

      onSuccess(); // Re-fetch data on the parent page
      onClose();   // Close the modal

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !tool) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Adjust Stock: <span className="text-blue-600">{tool.name}</span></h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
            <X size={24} />
          </button>
        </div>
        <p className="mb-4 text-gray-600">Current Stock: <span className="font-bold">{tool.currentStock}</span></p>

        <form onSubmit={handleSubmit}>
          {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
          
          <div className="mb-4">
            <label htmlFor="action" className="block text-gray-700 font-medium mb-1">Action*</label>
            <select
              id="action"
              value={action}
              onChange={(e) => setAction(e.target.value as ToolLogAction)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ADDITION">Add Stock (New Purchase)</option>
              <option value="DAMAGE">Record Damage</option>
              <option value="LOSS">Record Loss / Missing</option>
              <option value="DELETION">Record Deletion (End of Life)</option>
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="quantity" className="block text-gray-700 font-medium mb-1">Quantity*</label>
            <input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="remarks" className="block text-gray-700 font-medium mb-1">Remarks</label>
            <textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              placeholder="e.g., Dropped and broken, misplaced by staff..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Confirm Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}