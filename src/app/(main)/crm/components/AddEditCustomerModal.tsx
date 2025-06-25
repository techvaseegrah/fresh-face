// FILE: /app/crm/components/AddEditCustomerModal.tsx
'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { toast } from 'react-toastify';
import { CrmCustomer, AddCustomerFormData } from '../types';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface AddEditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void; // Callback to trigger a data refresh on the parent
  customerToEdit: CrmCustomer | null;
}

/**
 * A modal form for either adding a new customer or editing an existing one.
 * It handles its own form state and API submission.
 */
const AddEditCustomerModal: React.FC<AddEditCustomerModalProps> = ({ isOpen, onClose, onSave, customerToEdit }) => {
  // 1. UPDATE THE INITIAL STATE TO INCLUDE GENDER
  const [formData, setFormData] = useState<AddCustomerFormData>({
    name: '',
    email: '',
    phoneNumber: '',
    gender: '' // Add gender field
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isEditMode = !!customerToEdit;

  // Effect to reset form state when the modal opens or the customer to edit changes
  useEffect(() => {
    if (isOpen) {
      if (isEditMode) {
        // 2. POPULATE THE GENDER FIELD IN EDIT MODE
        setFormData({
          name: customerToEdit.name,
          email: customerToEdit.email,
          phoneNumber: customerToEdit.phoneNumber,
          gender: customerToEdit.gender || '' // Use existing gender or default to empty string
        });
      } else {
        // Reset for new customer
        setFormData({ name: '', email: '', phoneNumber: '', gender: '' });
      }
      setFormError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, customerToEdit, isEditMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    
    const apiEndpoint = isEditMode ? `/api/customer/${customerToEdit?.id}` : '/api/customer';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      // The formData now automatically includes the gender field in the payload
      const response = await fetch(apiEndpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to save customer.');
      }
      
      toast.success(`Customer ${isEditMode ? 'updated' : 'added'} successfully!`);
      onSave(); // Trigger parent component to refresh its data
      onClose(); // Close the modal

    } catch (error: any) {
      setFormError(error.message);
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const inputClasses = "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex justify-center items-center p-4">
      <div className="bg-white p-6 md:p-8 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">{isEditMode ? 'Edit Customer' : 'Add New Customer'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={isSubmitting}>
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        
        {formError && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{formError}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className={inputClasses}/>
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} required className={inputClasses}/>
          </div>
          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input type="tel" name="phoneNumber" id="phoneNumber" value={formData.phoneNumber} onChange={handleChange} required className={inputClasses}/>
          </div>
          
          {/* 3. ADD THE GENDER SELECTOR TO THE FORM */}
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select
              name="gender"
              id="gender"
              value={formData.gender}
              onChange={handleChange}
              required
              className={inputClasses}
            >
              <option value="" disabled>Select Gender...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div className="mt-8 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 border border-gray-300 text-sm font-medium rounded-md hover:bg-gray-200" disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-white bg-black text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditCustomerModal;