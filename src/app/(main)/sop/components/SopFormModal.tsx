'use client';

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import useSWR, { useSWRConfig } from 'swr';
import Select from 'react-select';
import { X, Plus, Trash2, Loader2, AlertTriangle, HelpCircle, CalendarDays, Calendar, ListChecks } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useCallback } from 'react';
import { motion } from 'framer-motion';

// --- (customSelectStyles can be moved to a separate file if preferred) ---
const customSelectStyles = {
  control: (provided: any, state: any) => ({
    ...provided, backgroundColor: 'white', border: '1px solid',
    borderColor: state.isFocused ? '#3b82f6' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 2px rgb(59 130 246 / 0.5)' : '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    '&:hover': { borderColor: state.isFocused ? '#3b82f6' : '#9ca3af', },
    minHeight: '48px', borderRadius: '0.5rem', transition: 'all 0.2s ease-in-out',
  }),
  valueContainer: (provided: any) => ({ ...provided, padding: '0 12px' }),
  placeholder: (provided: any) => ({ ...provided, color: '#9ca3af' }),
  option: (provided: any, state: any) => ({
    ...provided, padding: '10px 16px',
    backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#eff6ff' : 'white',
    color: state.isSelected ? 'white' : 'black',
  }),
  multiValue: (provided: any) => ({ ...provided, backgroundColor: '#dbeafe' }),
  multiValueLabel: (provided: any) => ({ ...provided, color: '#1e40af' }),
};

// --- (Add utility classes to your global CSS file as needed) ---

// --- STRONG TYPES ---
interface SopFormData {
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly';
  roles: { value: string; label: string }[];
  checklistItems: {
    questionText: string;
    responseType: 'yes_no' | 'yes_no_remarks';
    mediaUpload: 'none' | 'optional' | 'required';
  }[];
}

interface SopProp {
  _id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly';
  roles: { _id: string; displayName: string; }[];
  checklistItems: {
    _id: string;
    questionText: string;
    responseType: 'yes_no' | 'yes_no_remarks';
    mediaUpload: 'none' | 'optional' | 'required';
  }[];
}

interface SopFormModalProps {
  sop?: SopProp;
  onClose: () => void;
}

interface RolesResponse {
  roles: { _id: string; displayName: string; }[];
}

export default function SopFormModal({ sop, onClose }: SopFormModalProps) {
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

  const { data: rolesResponse } = useSWR<RolesResponse>(session ? '/api/admin/roles' : null, fetcherWithAuth);
  const { mutate } = useSWRConfig();
  const isEditing = !!sop;

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<SopFormData>({
    defaultValues: {
      title: sop?.title || '',
      description: sop?.description || '',
      type: sop?.type || 'daily',
      roles: sop?.roles?.map((r) => ({ value: r._id, label: r.displayName })) || [],
      checklistItems: sop?.checklistItems?.length > 0 ? sop.checklistItems.map(({_id, ...item}) => item) : [{
        questionText: '', responseType: 'yes_no', mediaUpload: 'none',
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'checklistItems' });
  const sopType = watch('type');
  const roleOptions = Array.isArray(rolesResponse?.roles) ? rolesResponse.roles.map((role) => ({ value: role._id, label: role.displayName })) : [];

  const onSubmit = async (data: SopFormData) => {
    if (!session) return;
    const payload = { ...data, roles: data.roles.map((r) => r.value) };
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
    return <div className="flex items-center gap-1 text-red-600 mt-1.5 text-sm"><AlertTriangle size={14} /> <p>{message}</p></div>;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-start md:items-center z-50 p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-lg md:max-w-2xl lg:max-w-4xl flex flex-col max-h-[95vh]"
      >
        <div className="flex justify-between items-center p-4 sm:p-6 border-b bg-white rounded-t-xl sticky top-0 z-10">
          <h2 className="text-lg md:text-xl font-bold text-gray-900">{isEditing ? 'Edit SOP' : 'Create New SOP'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 md:p-8 space-y-8">
            <fieldset className="space-y-6">
              <legend className="text-lg font-semibold text-gray-800 mb-2">SOP Details</legend>
              <div>
                <label htmlFor="title" className="form-label mb-1.5">Title</label>
                <input {...register('title', { required: 'Title is required' })} id="title" className="form-input" placeholder="e.g., Morning Shift Opening Tasks" />
                <FormError message={errors.title?.message} />
              </div>
              <div>
                <label htmlFor="description" className="form-label mb-1.5">Description (Optional)</label>
                <textarea {...register('description')} id="description" rows={3} className="form-input" placeholder="A brief summary of what this checklist covers." />
              </div>
              <div>
                <label className="form-label mb-1.5">Assign to Roles</label>
                <Controller name="roles" control={control} rules={{ required: 'At least one role must be assigned.' }}
                  render={({ field }) => <Select {...field} isMulti options={roleOptions} styles={customSelectStyles} isLoading={!rolesResponse} placeholder="Select roles..." />}
                />
                <FormError message={errors.roles?.message} />
              </div>
            </fieldset>

            <fieldset>
                <legend className="form-label text-lg font-semibold text-gray-800 mb-4">Checklist Frequency</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className={`form-radio-card ${sopType === 'daily' ? 'selected' : ''}`}>
                        <input {...register('type')} type="radio" value="daily" className="sr-only" />
                        <ListChecks className={`mr-3 flex-shrink-0 ${sopType === 'daily' ? 'text-blue-600' : 'text-gray-500'}`} />
                        <div><span className="font-semibold text-gray-800">Daily</span><p className="text-sm text-gray-600">Tasks for every day.</p></div>
                    </label>
                    <label className={`form-radio-card ${sopType === 'weekly' ? 'selected' : ''}`}>
                        <input {...register('type')} type="radio" value="weekly" className="sr-only" />
                        <CalendarDays className={`mr-3 flex-shrink-0 ${sopType === 'weekly' ? 'text-blue-600' : 'text-gray-500'}`} />
                        <div><span className="font-semibold text-gray-800">Weekly</span><p className="text-sm text-gray-600">Once-a-week tasks.</p></div>
                    </label>
                    <label className={`form-radio-card ${sopType === 'monthly' ? 'selected' : ''}`}>
                        <input {...register('type')} type="radio" value="monthly" className="sr-only" />
                        <Calendar className={`mr-3 flex-shrink-0 ${sopType === 'monthly' ? 'text-blue-600' : 'text-gray-500'}`} />
                        <div><span className="font-semibold text-gray-800">Monthly</span><p className="text-sm text-gray-600">Once-a-month tasks.</p></div>
                    </label>
                </div>
            </fieldset>

            <fieldset>
              <legend className="form-label text-lg font-semibold text-gray-800 mb-4">Checklist Questions</legend>
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 border rounded-lg bg-white space-y-4 relative shadow-sm">
                     <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 h-7 w-7 flex items-center justify-center bg-gray-100 text-gray-600 rounded-full font-semibold text-sm mt-1.5">{index + 1}</span>
                        <div className="flex-grow">
                            <label htmlFor={`question-${index}`} className="text-sm font-medium text-gray-600">Question Text</label>
                            <textarea
                              {...register(`checklistItems.${index}.questionText`, { required: 'Question text cannot be empty.' })}
                              id={`question-${index}`}
                              className="form-input mt-1"
                              placeholder="e.g., Arrived 5 mins early and set up front desk..."
                              rows={2}
                            />
                            {errors.checklistItems?.[index]?.questionText && <FormError message={errors.checklistItems[index]?.questionText?.message} />}
                        </div>
                     </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:pl-10">
                      <div>
                        {/* --- FIX: Wrap the icon in a span and move the title attribute --- */}
                        <label className="text-sm font-medium text-gray-600 flex items-center gap-1.5 mb-1">
                          Response Type 
                          <span title="Choose the inputs the employee will see.">
                            <HelpCircle size={14} className="text-gray-400" />
                          </span>
                        </label>
                        <select {...register(`checklistItems.${index}.responseType`)} className="form-select">
                          <option value="yes_no">Yes / No</option>
                          <option value="yes_no_remarks">Yes / No + Remarks</option>
                        </select>
                      </div>
                      <div>
                        {/* --- FIX: Wrap the icon in a span and move the title attribute --- */}
                        <label className="text-sm font-medium text-gray-600 flex items-center gap-1.5 mb-1">
                          Media Upload
                          <span title="Set media requirement for this question.">
                            <HelpCircle size={14} className="text-gray-400" />
                          </span>
                        </label>
                        <select {...register(`checklistItems.${index}.mediaUpload`)} className="form-select">
                          <option value="none">None</option>
                          <option value="optional">Optional</option>
                          <option value="required">Required</option>
                        </select>
                      </div>
                    </div>
                    {fields.length > 1 && (
                        <button type="button" onClick={() => remove(index)} className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                            <Trash2 size={16} />
                        </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => append({ questionText: '', responseType: 'yes_no', mediaUpload: 'none' })}
                  className="w-full flex items-center justify-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors py-3 px-3 rounded-lg hover:bg-blue-50 border-2 border-dashed border-gray-300 hover:border-blue-400"
                >
                  <Plus size={16} />Add Question
                </button>
              </div>
            </fieldset>
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 p-4 sm:p-6 bg-white/50 backdrop-blur-sm border-t rounded-b-xl sticky bottom-0">
            <button type="button" onClick={onClose} className="btn-secondary w-full sm:w-auto">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full sm:w-auto">
              {isSubmitting && <Loader2 size={18} className="animate-spin mr-2" />}
              {isSubmitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create SOP')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}