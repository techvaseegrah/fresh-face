// src/app/(main)/crm/components/AddEditCustomerModal.tsx - MULTI-TENANT & MOBILE-RESPONSIVE
'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { toast } from 'react-toastify';
import { CrmCustomer, AddCustomerFormData } from '../types';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Gender } from '@/types/gender';
import { getSession } from 'next-auth/react';

interface AddEditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  customerToEdit: CrmCustomer | null;
}

const AddEditCustomerModal: React.FC<AddEditCustomerModalProps> = ({ isOpen, onClose, onSave, customerToEdit }) => {
  const [formData, setFormData] = useState<AddCustomerFormData>({ name: '', email: '', phoneNumber: '', gender: Gender.Other, dob: '', survey: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Replaced single formError with an object to hold errors for each field
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const isEditMode = !!customerToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && customerToEdit) {
        setFormData({
            name: customerToEdit.name,
            email: customerToEdit.email || '',
            phoneNumber: customerToEdit.phoneNumber,
            gender: customerToEdit.gender || 'other',
            dob: customerToEdit.dob ? new Date(customerToEdit.dob).toISOString().split('T')[0] : '',
            survey: customerToEdit.survey || ''
        });
      } else {
        setFormData({ name: '', email: '', phoneNumber: '', gender: 'other', dob: '', survey: '' });
      }
      // Reset errors when the modal opens or data changes
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, customerToEdit, isEditMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let processedValue = value;

    // --- NEW: Input validation logic ---
    if (name === 'name') {
      // Allow only letters and spaces
      processedValue = value.replace(/[^a-zA-Z\s]/g, '');
    } else if (name === 'phoneNumber') {
      // Allow only numbers
      processedValue = value.replace(/[^0-9]/g, '');
    }

    setFormData(prev => ({ ...prev, [name]: processedValue }));

    // Clear the error for the field being edited
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Full Name is required.';
    }
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone Number is required.';
    } else if (formData.phoneNumber.length < 10) {
      newErrors.phoneNumber = 'Please enter a valid 10-digit phone number.';
    }
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address.';
    }
    
    setErrors(newErrors);
    // Return true if there are no errors
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // --- NEW: Validate form before submitting ---
    if (!validateForm()) {
      return; // Stop submission if validation fails
    }

    setIsSubmitting(true);
    setErrors({}); // Clear old errors before new submission

    const apiEndpoint = isEditMode ? `/api/customer/${customerToEdit?._id}` : '/api/customer';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const session = await getSession();
      if (!session?.user?.tenantId) {
        throw new Error("Your session is invalid. Please log in again.");
      }

      const response = await fetch(apiEndpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': session.user.tenantId,
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to save customer.');
      }

      toast.success(`Customer ${isEditMode ? 'updated' : 'added'} successfully!`);
      onSave();
      onClose();

    } catch (error: any) {
      console.error("Form submission error:", error);
      // Set a general error message for API or network issues
      setErrors({ form: error.message });
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex justify-center items-center p-4 overflow-y-auto py-6">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-full">
        <div className="px-6 py-4 md:px-8 md:py-6 border-b flex-shrink-0">
            <div className="flex justify-between items-center">
              <h2 className="text-xl md:text-2xl font-semibold">{isEditMode ? 'Edit Customer' : 'Add New Customer'}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={isSubmitting}>
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto">
          <div className="p-6 md:p-8 space-y-4">
            {/* Display general form error from API response */}
            {errors.form && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">{errors.form}</div>}
            
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className={`w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 ${errors.name ? 'border-red-500' : 'border-gray-300'}`} />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input type="tel" name="phoneNumber" id="phoneNumber" value={formData.phoneNumber} onChange={handleChange} required maxLength={10} className={`w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 ${errors.phoneNumber ? 'border-red-500' : 'border-gray-300'}`} />
              {errors.phoneNumber && <p className="mt-1 text-sm text-red-600">{errors.phoneNumber}</p>}
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
              <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} className={`w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 ${errors.email ? 'border-red-500' : 'border-gray-300'}`} />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="dob" className="block text-sm font-medium text-gray-700 mb-1">Date of Birth (Optional)</label>
              <input type="date" name="dob" id="dob" value={formData.dob} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select name="gender" id="gender" value={formData.gender} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500">
                <option value={Gender.Female}>Female</option>
                <option value={Gender.Male}>Male</option>
                <option value={Gender.Other}>Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="survey" className="block text-sm font-medium text-gray-700 mb-1">How did you hear about us? (Optional)</label>
              <textarea name="survey" id="survey" value={formData.survey} onChange={handleChange} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
          </div>
          
          <div className="px-6 py-4 md:px-8 bg-gray-50 border-t flex justify-end gap-3 flex-shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 text-sm font-medium rounded-md hover:bg-gray-100" disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-white bg-black text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center" disabled={isSubmitting}>
              {isSubmitting && <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
              {isSubmitting ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditCustomerModal;