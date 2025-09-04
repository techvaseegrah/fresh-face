// src/app/(main)/(Staff)/create-issue/page.tsx

'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify'; // <-- FIX: This was missing
import { useForm, Controller } from 'react-hook-form'; // <-- FIX: This was missing
import useSWR from 'swr';
import Select from 'react-select';
import { Loader2, Send, Paperclip, X, ArrowUp, ArrowRight, ArrowDown, UploadCloud } from 'lucide-react';
import { motion } from 'framer-motion';

// --- Type Definitions ---
type IssueFormData = {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  roles: { value: string; label: string }[];
  file: File | null;
};

interface RolesResponse {
  roles: { _id: string; displayName: string; }[];
}

// --- Child Component for a consistent section layout ---
const Section = ({ title, description, children }: { title: string, description?: string, children: React.ReactNode }) => (
    <div className="pt-6 first:pt-0">
      <div className="pb-4 border-b border-slate-200">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      <div className="mt-6 space-y-6">{children}</div>
    </div>
);


export default function CreateIssuePage() {
    const { data: session } = useSession();
    const { register, handleSubmit, control, watch, formState: { errors, isSubmitting }, reset } = useForm<IssueFormData>({
        defaultValues: {
            title: '',
            description: '',
            priority: 'medium',
            roles: [],
            file: null,
        },
    });

    // --- Data Fetching for Roles ---
    const fetcherWithAuth = useCallback(async (url: string): Promise<RolesResponse> => {
        if (!session?.user?.tenantId) throw new Error("Session not ready");
        const headers = new Headers({ 'x-tenant-id': session.user.tenantId });
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('An error occurred while fetching roles.');
        return res.json();
    }, [session]);

    const { data: rolesResponse } = useSWR<RolesResponse>(session ? '/api/staff/roles' : null, fetcherWithAuth);
    const roleOptions = Array.isArray(rolesResponse?.roles) ? rolesResponse.roles.map((role) => ({ value: role._id, label: role.displayName })) : [];


    const issuePriority = watch('priority');
    const priorityOptions = {
        high: { label: 'High', icon: ArrowUp, theme: { base: 'border-slate-300 bg-white', selected: 'bg-red-50 border-red-500 text-red-700', icon: 'text-red-600' } },
        medium: { label: 'Medium', icon: ArrowRight, theme: { base: 'border-slate-300 bg-white', selected: 'bg-yellow-50 border-yellow-500 text-yellow-700', icon: 'text-yellow-600' } },
        low: { label: 'Low', icon: ArrowDown, theme: { base: 'border-slate-300 bg-white', selected: 'bg-green-50 border-green-500 text-green-700', icon: 'text-green-600' } },
    };

    const onSubmit = async (data: IssueFormData) => {
        if (!session?.user?.tenantId) {
            toast.error("Unable to identify your organization. Please log in again.");
            return;
        }
        if (data.roles.length === 0) {
            toast.error("Please assign the issue to at least one role.");
            return;
        }

        const formData = new FormData();
        formData.append('title', data.title);
        formData.append('description', data.description);
        formData.append('priority', data.priority);
        formData.append('roles', JSON.stringify(data.roles.map(r => r.value)));
        if (data.file) {
            formData.append('file', data.file);
        }

        try {
            const headers = new Headers({ 'x-tenant-id': session.user.tenantId });
            const response = await fetch('/api/staff/issues', {
                method: 'POST',
                headers,
                body: formData,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Something went wrong');
            
            toast.success('Issue has been successfully submitted for review!');
            reset();

        } catch (err: any) {
            toast.error(`Submission failed: ${err.message}`);
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-3xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 tracking-tight">Report a New Issue</h1>
                    <p className="text-gray-500 mt-2 text-lg">
                        Spotted a problem? Let the admin team know. Provide as much detail as possible.
                    </p>
                </header>

                <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-6 md:p-8 rounded-xl shadow-lg border border-gray-200">
                    <div className="space-y-8">
                        <Section title="Issue Details" description="Provide a clear title and assign the responsible role(s).">
                            <div>
                                <label htmlFor="title" className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    {...register('title', { required: 'Title is required' })}
                                    id="title" placeholder="e.g., Leaking pipe in the kitchen"
                                    className={`w-full px-3 py-2 bg-white border ${errors.title ? 'border-red-400' : 'border-slate-300'} rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                />
                                {errors.title && <p className="text-red-600 mt-1 text-sm">{errors.title.message}</p>}
                            </div>
                            <div>
                                <label htmlFor="description" className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    Brief Description <span className="text-slate-400 font-normal">(Optional)</span>
                                </label>
                                <textarea
                                    {...register('description')}
                                    id="description" rows={4} placeholder="Please describe the issue, including its location..."
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assign to Roles <span className="text-red-500">*</span></label>
                                <Controller name="roles" control={control} rules={{ required: 'At least one role must be assigned.' }}
                                  render={({ field }) => <Select {...field} isMulti options={roleOptions} isLoading={!rolesResponse && !errors.roles} placeholder="Select roles..." 
                                    classNames={{
                                      control: () => `!py-1 !border !rounded-md !shadow-sm !transition ${errors.roles ? '!border-red-400' : '!border-slate-300'} hover:!border-slate-400`,
                                      valueContainer: () => '!px-2',
                                      multiValue: () => 'bg-slate-200 rounded-md',
                                      multiValueLabel: () => 'text-slate-800 font-medium',
                                      placeholder: () => 'text-slate-400'
                                    }}
                                  />}
                                />
                                {errors.roles && <p className="text-red-600 mt-1 text-sm">{typeof errors.roles.message === 'string' ? errors.roles.message : 'This field is required'}</p>}
                            </div>
                        </Section>

                        <Section title="Set Priority" description="Indicate the urgency of this issue.">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {Object.entries(priorityOptions).map(([key, option]) => {
                                    const isSelected = issuePriority === key;
                                    const Icon = option.icon;
                                    return (
                                        <label key={key} className={`border-2 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-all hover:shadow-md hover:-translate-y-1 ${isSelected ? option.theme.selected : option.theme.base}`}>
                                            <input {...register('priority')} type="radio" value={key} className="sr-only" />
                                            <Icon size={20} className={`mb-2 ${isSelected ? option.theme.icon : 'text-slate-400'}`} />
                                            <span className="font-semibold text-sm">{option.label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </Section>

                        <Section title="Attach File" description="Optionally, add a photo or document of the issue.">
                           <Controller name="file" control={control} render={({ field: { onChange, value } }) => (
                                <>
                                    {value ? (
                                        <div className="p-3 border rounded-md bg-gray-50 flex items-center gap-3 text-sm">
                                            <Paperclip className="h-5 w-5 text-gray-500 flex-shrink-0" />
                                            <p className="text-gray-800 font-semibold truncate">{value.name}</p>
                                            <button type="button" onClick={() => onChange(null)} className="ml-auto text-red-500 hover:text-red-700" title="Remove file"><X size={18}/></button>
                                        </div>
                                    ) : (
                                        <label className="w-full flex flex-col items-center px-4 py-8 bg-slate-50 text-slate-600 rounded-lg shadow-inner tracking-wide border-2 border-dashed border-slate-300 cursor-pointer hover:bg-slate-100 hover:border-blue-500 transition-colors">
                                            <UploadCloud size={32} className="text-slate-400 mb-2"/>
                                            <span className="mt-2 text-base leading-normal font-semibold">Select or Drag a File</span>
                                            <span className="text-xs text-slate-500">Max file size: 10MB</span>
                                            <input type='file' className="hidden" onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file && file.size > 10 * 1024 * 1024) { toast.error("File size cannot exceed 10MB."); return; }
                                                onChange(file || null);
                                            }}/>
                                        </label>
                                    )}
                                </>
                           )}/>
                        </Section>
                    </div>
                    
                    <div className="pt-8 flex justify-end gap-3">
                        <button type="button" onClick={() => reset()} className="px-5 py-2.5 bg-white text-sm font-semibold text-slate-800 rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors shadow-sm">
                            Cancel
                        </button>
                        <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-blue-600 text-sm font-semibold text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center min-w-[150px]">
                            {isSubmitting ? <><Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5"/> Submitting...</> : <><Send className="-ml-1 mr-2 h-5 w-5"/> Submit Issue</>}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}