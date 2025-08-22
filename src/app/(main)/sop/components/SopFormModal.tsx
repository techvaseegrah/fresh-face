'use client';

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import useSWR, { useSWRConfig } from 'swr';
import Select from 'react-select';
// --- UPDATED Imports ---
import { X, Plus, Trash2, Loader2, ListChecks, CalendarDays, Calendar, AlertTriangle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useCallback } from 'react';
import { motion } from 'framer-motion';

// --- (customSelectStyles remains the same) ---
const customSelectStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: 'white',
    border: '1px solid',
    borderColor: state.isFocused ? '#3b82f6' : '#d1d5db',
    boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    '&:hover': {
      borderColor: state.isFocused ? '#3b82f6' : '#9ca3af',
    },
    minHeight: '48px',
    borderRadius: '0.5rem',
    transition: 'border-color 0.2s ease-in-out',
  }),
  valueContainer: (provided: any) => ({
    ...provided,
    padding: '0 12px',
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: '#9ca3af',
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    padding: '10px 16px',
    backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#eff6ff' : 'white',
    color: state.isSelected ? 'white' : 'black',
  }),
  multiValue: (provided: any) => ({
    ...provided,
    backgroundColor: '#dbeafe',
  }),
  multiValueLabel: (provided: any) => ({
    ...provided,
    color: '#1e40af',
  }),
};

export default function SopFormModal({ sop, onClose }: { sop?: any; onClose: () => void; }) {
  const { data: session } = useSession();

  const fetcherWithAuth = useCallback(async (url: string) => {
    if (!session?.user?.tenantId) throw new Error("Session not ready");
    const headers = new Headers();
    headers.append('x-tenant-id', session.user.tenantId);
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errorInfo = await res.json();
      throw new Error(errorInfo.message || 'An error occurred while fetching roles.');
    }
    return res.json();
  }, [session]);

  const { data: rolesResponse, error: rolesError } = useSWR(session ? '/api/admin/roles' : null, fetcherWithAuth);
  const { mutate } = useSWRConfig();
  const isEditing = !!sop;

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      title: sop?.title || '',
      description: sop?.description || '',
      // --- UPDATED Default type ---
      type: sop?.type || 'daily', 
      roles: sop?.roles?.map((r: any) => ({ value: r._id, label: r.displayName })) || [],
      // --- REMOVED 'content' field ---
      checklistItems: sop?.checklistItems?.length > 0 ? sop.checklistItems : [{ text: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'checklistItems' });
  const sopType = watch('type');
  const roleOptions = Array.isArray(rolesResponse?.roles) ? rolesResponse.roles.map((role: any) => ({ value: role._id, label: role.displayName })) : [];

  const onSubmit = async (data: any) => {
    if (!session) return;
    const payload = { ...data, roles: data.roles.map((r: any) => r.value) };
    const url = isEditing ? `/api/sop/${sop._id}` : '/api/sop';
    const method = isEditing ? 'PUT' : 'POST';
    try {
      const headers = new Headers();
      headers.append('x-tenant-id', session.user.tenantId);
      headers.append('Content-Type', 'application/json');
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to save SOP');
      mutate('/api/sop');
      onClose();
    } catch (error) {
      console.error(error);
    }
  };

  const FormError = ({ message }: { message?: string }) => {
    if (!message) return null;
    return (
      <div className="flex items-center gap-1 text-red-600 mt-1.5 text-sm">
        <AlertTriangle size={14} /> <p>{message}</p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[95vh]"
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">{isEditing ? 'Edit SOP' : 'Create New SOP'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1.5 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="p-8 space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-1.5">Title</label>
              <input {...register('title', { required: 'Title is required' })} className="form-input" placeholder="e.g., Morning Shift Opening Tasks" />
              <FormError message={errors.title?.message as string} />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
              <textarea {...register('description')} rows={3} className="form-input" placeholder="A brief summary of what this checklist covers." />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Assign to Roles</label>
              <Controller
                name="roles" control={control} rules={{ required: 'At least one role must be assigned.' }}
                render={({ field }) => (
                  <Select {...field} isMulti options={roleOptions} styles={customSelectStyles} isLoading={!rolesResponse && !rolesError} placeholder="Select roles..." />
                )}
              />
              <FormError message={errors.roles?.message as string} />
            </div>

            {/* --- UPDATED SOP Type Selection --- */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Checklist Frequency</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className={`relative flex items-center p-4 border rounded-lg cursor-pointer transition-all shadow-sm ${sopType === 'daily' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'}`}>
                  <input {...register('type')} type="radio" value="daily" className="sr-only" />
                  <ListChecks className={`mr-4 ${sopType === 'daily' ? 'text-blue-600' : 'text-gray-500'}`} />
                  <div>
                    <span className="font-semibold text-gray-800">Daily</span>
                    <p className="text-sm text-gray-500">Tasks for every day.</p>
                  </div>
                </label>
                <label className={`relative flex items-center p-4 border rounded-lg cursor-pointer transition-all shadow-sm ${sopType === 'weekly' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'}`}>
                  <input {...register('type')} type="radio" value="weekly" className="sr-only" />
                  <CalendarDays className={`mr-4 ${sopType === 'weekly' ? 'text-blue-600' : 'text-gray-500'}`} />
                  <div>
                    <span className="font-semibold text-gray-800">Weekly</span>
                    <p className="text-sm text-gray-500">Once-a-week tasks.</p>
                  </div>
                </label>
                <label className={`relative flex items-center p-4 border rounded-lg cursor-pointer transition-all shadow-sm ${sopType === 'monthly' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'}`}>
                  <input {...register('type')} type="radio" value="monthly" className="sr-only" />
                  <Calendar className={`mr-4 ${sopType === 'monthly' ? 'text-blue-600' : 'text-gray-500'}`} />
                  <div>
                    <span className="font-semibold text-gray-800">Monthly</span>
                    <p className="text-sm text-gray-500">Once-a-month tasks.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* --- UPDATED Checklist Items (now always visible) --- */}
            <motion.div key="checklist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 pt-2">
              <label className="block text-sm font-semibold text-gray-700">Checklist Items</label>
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <input {...register(`checklistItems.${index}.text`, { required: 'Checklist item cannot be empty' })} className="form-input flex-grow" placeholder={`Item #${index + 1}`} />
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(index)} className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => append({ text: '' })} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors py-2 px-3 rounded-md hover:bg-blue-50">
                <Plus size={16} />Add Item
              </button>
            </motion.div>

          </div>
        </form>

        <div className="flex justify-end gap-4 p-6 bg-gray-50 border-t border-gray-200 rounded-b-xl">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-gray-200 transition-all">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} onClick={handleSubmit(onSubmit)} className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 disabled:bg-blue-300 disabled:cursor-not-allowed transition-all flex items-center">
            {isSubmitting && <Loader2 size={18} className="animate-spin mr-2" />}
            {isSubmitting ? 'Saving...' : 'Save SOP'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}