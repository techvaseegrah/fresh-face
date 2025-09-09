'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { X } from 'lucide-react'; // Using lucide-react for icons as it seems to be in your project

// Define the shape of a tool object we might pass for editing
interface ITool {
  _id: string;
  name: string;
  category: string;
  maintenanceDueDate?: string;
  // We don't edit stock directly in this form
}

interface ToolFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  toolToEdit?: ITool | null;
  tenantId: string | undefined; // <--- ADD THIS LINE. This is the fix.
}

export function ToolFormModal({ isOpen, onClose, onSuccess, toolToEdit,tenantId }: ToolFormModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [openingStock, setOpeningStock] = useState(0);
  const [maintenanceDate, setMaintenanceDate] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!toolToEdit;

  useEffect(() => {
    // If a tool object is passed, populate the form fields for editing
    if (isEditMode && toolToEdit) {
      setName(toolToEdit.name);
      setCategory(toolToEdit.category);
      // Format the date for the input[type=date] which expects 'YYYY-MM-DD'
      if (toolToEdit.maintenanceDueDate) {
        setMaintenanceDate(new Date(toolToEdit.maintenanceDueDate).toISOString().split('T')[0]);
      }
    } else {
      // Reset form when opening for creation or when toolToEdit is cleared
      setName('');
      setCategory('');
      setOpeningStock(0);
      setMaintenanceDate('');
    }
  }, [toolToEdit, isEditMode, isOpen]); // Rerun when the modal opens or the tool to edit changes

  const handleSubmit = async (e: FormEvent) => {
    if (!tenantId) {
        setError("Cannot perform action: Tenant information is missing.");
        return;
    }
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const body = isEditMode
      ? { name, category, maintenanceDueDate: maintenanceDate || null }
      : { name, category, openingStock, maintenanceDueDate: maintenanceDate || null };
    
    const url = isEditMode ? `/api/tool-stock/tools/${toolToEdit?._id}` : '/api/tool-stock/tools';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId, // Add the required header
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'An unknown error occurred.');
      }

      onSuccess(); // Re-fetch the tool list on the parent page
      onClose(); // Close the modal

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // If the modal is not open, render nothing
  if (!isOpen) {
    return null;
  }

  // Basic styling for a modal overlay and content
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      onClick={onClose} // Close modal on overlay click
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal content
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
          
          {/* Only show Opening Stock field when creating a new tool */}
          {!isEditMode && (
            <div className="mb-4">
              <label htmlFor="openingStock" className="block text-gray-700 font-medium mb-1">Opening Stock*</label>
              <input
                id="openingStock"
                type="number"
                min="0"
                value={openingStock}
                onChange={(e) => setOpeningStock(Number(e.target.value))}
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