'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { X } from 'lucide-react';

interface ITool {
  _id: string;
  name: string;
  category: string;
  maintenanceDueDate?: string;
}

interface ToolFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  toolToEdit?: ITool | null;
  tenantId: string | undefined;
}

export function ToolFormModal({ isOpen, onClose, onSuccess, toolToEdit, tenantId }: ToolFormModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  // ✅ CHANGED: State is now a string to allow for an empty value in the input.
  const [openingStock, setOpeningStock] = useState('0');
  const [maintenanceDate, setMaintenanceDate] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!toolToEdit;

  useEffect(() => {
    if (isEditMode && toolToEdit) {
      setName(toolToEdit.name);
      setCategory(toolToEdit.category);
      if (toolToEdit.maintenanceDueDate) {
        setMaintenanceDate(new Date(toolToEdit.maintenanceDueDate).toISOString().split('T')[0]);
      }
    } else {
      setName('');
      setCategory('');
      // ✅ CHANGED: Reset to a string.
      setOpeningStock('0');
      setMaintenanceDate('');
    }
  }, [toolToEdit, isEditMode, isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
        setError("Cannot perform action: Tenant information is missing.");
        return;
    }
    setIsLoading(true);
    setError(null);

    const body = isEditMode
      ? { name, category, maintenanceDueDate: maintenanceDate || null }
      // ✅ CHANGED: Convert openingStock string to a number only on submission.
      : { name, category, openingStock: Number(openingStock) || 0, maintenanceDueDate: maintenanceDate || null };
    
    const url = isEditMode ? `/api/tool-stock/tools/${toolToEdit?._id}` : '/api/tool-stock/tools';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'An unknown error occurred.');
      }

      onSuccess();
      onClose();

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
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
          <h2 className="text-xl font-bold">{isEditMode ? 'Edit Tool' : 'Add New Tool'}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
          
          <div className="mb-4">
            <label htmlFor="name" className="block text-gray-700 font-medium mb-1">Tool Name*</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="category" className="block text-gray-700 font-medium mb-1">Category</label>
            <input
              id="category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Cutting, Electrical, Styling"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {!isEditMode && (
            <div className="mb-4">
              <label htmlFor="openingStock" className="block text-gray-700 font-medium mb-1">Opening Stock*</label>
              <input
                id="openingStock"
                type="number"
                min="0"
                value={openingStock}
                // ✅ CHANGED: Simply set the state to the string value from the input.
                onChange={(e) => setOpeningStock(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}
          
          <div className="mb-6">
            <label htmlFor="maintenanceDate" className="block text-gray-700 font-medium mb-1">Maintenance Due Date</label>
            <input
              id="maintenanceDate"
              type="date"
              value={maintenanceDate}
              onChange={(e) => setMaintenanceDate(e.target.value)}
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
              {isLoading ? 'Saving...' : 'Save Tool'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}