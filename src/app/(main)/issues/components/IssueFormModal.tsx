// src/app/(main)/issues/components/IssueFormModal.tsx

'use client';

import { useForm, Controller, FieldError } from 'react-hook-form';
import useSWR from 'swr';
import Select from 'react-select';
import { X, Loader2, AlertTriangle, ArrowUp, ArrowRight, ArrowDown, UploadCloud, File as FileIcon, Trash2, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import Image from 'next/image';
import React from 'react';

// --- (CHILD COMPONENT) FILE PREVIEW CARD ---
const FilePreview = ({ 
    fileName, 
    fileSize, 
    previewUrl, 
    isImage, 
    onRemove 
}: { 
    fileName: string; 
    fileSize?: string; 
    previewUrl: string; 
    isImage: boolean; 
    onRemove: () => void; 
}) => (
    <div className="bg-white p-3 border-2 border-slate-300 rounded-lg flex items-center gap-4 transition-all shadow-sm">
        <div className="flex-shrink-0 h-16 w-16 flex items-center justify-center bg-slate-100 rounded-md">
            {isImage ? (
                <Image src={previewUrl} alt="Preview" width={64} height={64} className="object-cover rounded-md h-full w-full" />
            ) : (
                <FileIcon className="h-8 w-8 text-slate-500" />
            )}
        </div>
        <div className="flex-grow overflow-hidden">
            <p className="font-semibold text-slate-800 truncate" title={fileName}>{fileName}</p>
            {fileSize && <p className="text-sm text-slate-500">{fileSize}</p>}
        </div>
        <button 
            type="button" 
            onClick={onRemove} 
            title="Remove file" 
            className="flex-shrink-0 text-slate-500 hover:text-red-600 hover:bg-red-100 p-2 rounded-full transition-colors"
        >
            <Trash2 size={20} />
        </button>
    </div>
);

// --- (CHILD COMPONENT) DYNAMIC FILE UPLOADER ---
const FileUploader = ({ field }: { field: { onChange: (file: File | null) => void; value: File | null; } }): React.JSX.Element => {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (field.value instanceof File) {
      const url = URL.createObjectURL(field.value);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null);
  }, [field.value]);

  if (field.value && preview) {
    return (
      <FilePreview 
        fileName={field.value.name}
        fileSize={`${(field.value.size / 1024).toFixed(2)} KB`}
        previewUrl={preview}
        isImage={field.value.type.startsWith('image/')}
        onRemove={() => field.onChange(null)}
      />
    );
  }

  return (
    <label className="w-full flex flex-col items-center px-4 py-8 bg-slate-50 text-slate-600 rounded-lg shadow-inner tracking-wide border-2 border-dashed border-slate-300 cursor-pointer hover:bg-slate-100 hover:border-blue-500 transition-colors">
      <UploadCloud size={32} className="text-slate-400 mb-2"/>
      <span className="mt-2 text-base leading-normal font-semibold">Select or Drag a File</span>
      <span className="text-xs text-slate-500">Max file size: 10MB</span>
      <input type='file' className="hidden" onChange={(e) => field.onChange(e.target.files ? e.target.files[0] : null)} />
    </label>
  );
};


// --- TYPE DEFINITIONS ---
export interface IssueProp {
  _id: string; title: string; description: string; priority: 'high' | 'medium' | 'low' | 'none';
  roles: { _id: string; displayName: string; }[]; fileUrl?: string;
}
interface IssueFormData {
  title: string; description: string; priority: 'high' | 'medium' | 'low';
  roles: { value: string; label: string }[]; file: File | null;
}
interface IssueFormModalProps {
  issue?: IssueProp; onClose: () => void; onSuccess: (response: any) => void;
}
interface RolesResponse {
  roles: { _id: string; displayName: string; }[];
}


export default function IssueFormModal({ issue, onClose, onSuccess }: IssueFormModalProps): React.JSX.Element {
  const { data: session } = useSession();
  const isEditing = !!issue;
  const [isExistingFileRemoved, setIsExistingFileRemoved] = useState(false);

  const fetcherWithAuth = useCallback(async (url: string): Promise<RolesResponse> => {
    if (!session?.user?.tenantId) throw new Error("Session not ready");
    const headers = new Headers({ 'x-tenant-id': session.user.tenantId });
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('An error occurred while fetching roles.');
    return res.json();
  }, [session]);

  const { data: rolesResponse } = useSWR<RolesResponse>(session ? '/api/admin/roles' : null, fetcherWithAuth);

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<IssueFormData>({
    defaultValues: {
      title: issue?.title || '',
      description: issue?.description || '',
      priority: issue?.priority === 'none' ? 'medium' : issue?.priority || 'medium',
      roles: issue?.roles?.map((r) => ({ value: r._id, label: r.displayName })) || [],
      file: null,
    },
  });

  const issuePriority = watch('priority');
  const roleOptions = Array.isArray(rolesResponse?.roles) ? rolesResponse.roles.map((role) => ({ value: role._id, label: role.displayName })) : [];

  const onSubmit = async (data: IssueFormData) => {
    if (!session) return;
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('priority', data.priority);
    formData.append('roles', JSON.stringify(data.roles.map(r => r.value)));
    if (data.file) {
      formData.append('file', data.file);
    } else if (isEditing && issue?.fileUrl && !isExistingFileRemoved) {
      formData.append('fileUrl', issue.fileUrl);
    } else if (isEditing && isExistingFileRemoved) {
      formData.append('fileUrl', 'null');
    }
    const url = isEditing ? `/api/issue/${issue!._id}` : '/api/issue';
    const method = isEditing ? 'PUT' : 'POST';
    try {
      const headers = new Headers({ 'x-tenant-id': session.user.tenantId });
      const res = await fetch(url, { method, headers, body: formData });
      const responseData = await res.json();
      if (!res.ok) {
        throw new Error(responseData.message || 'Failed to save issue');
      }
      onSuccess(responseData);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const FormError = ({ message }: { message?: string | undefined | FieldError }): React.JSX.Element | null => {
      const msg = typeof message === 'string' ? message : message?.message;
      if (!msg) return null;
      return <div className="flex items-center gap-1.5 text-red-600 mt-1.5 text-sm font-medium"><AlertTriangle size={14} /> <p>{msg}</p></div>;
  };
  
  const Section = ({ title, description, children }: { title: string, description?: string, children: React.ReactNode }) => (
    <div className="pt-6">
      <div className="pb-4 border-b border-slate-200">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  );

  // ✅ PRIORITY STYLING CHANGES
  const priorityOptions = {
    high: { label: 'High', icon: ArrowUp, theme: { base: 'border-slate-300 bg-white', selected: 'bg-red-50 border-red-500 text-red-700', icon: 'text-red-600' } },
    medium: { label: 'Medium', icon: ArrowRight, theme: { base: 'border-slate-300 bg-white', selected: 'bg-yellow-50 border-yellow-500 text-yellow-700', icon: 'text-yellow-600' } },
    low: { label: 'Low', icon: ArrowDown, theme: { base: 'border-slate-300 bg-white', selected: 'bg-green-50 border-green-500 text-green-700', icon: 'text-green-600' } },
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-start md:items-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 0 }}
        className="bg-slate-50 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        <header className="flex-shrink-0 flex justify-between items-center p-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-full"><CheckCircle className="h-6 w-6 text-blue-600" /></div>
            <h2 className="text-xl font-bold text-slate-900">{isEditing ? 'Edit Issue Template' : 'Create New Issue Template'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8">
            <Section title="Issue Details" description="Provide a clear title and the roles responsible for this issue.">
              <div>
                <label htmlFor="title" className="block text-sm font-semibold text-slate-700 mb-1.5">Title</label>
                <input {...register('title', { required: 'Title is required' })} id="title" placeholder='e.g., Daily Kitchen Cleaning Checklist' className={`w-full px-3 py-2 bg-white border ${errors.title ? 'border-red-400' : 'border-slate-300'} rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`} />
                <FormError message={errors.title?.message} />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-slate-700 mb-1.5">Brief Description <span className="text-slate-400 font-normal">(Optional)</span></label>
                <textarea {...register('description')} id="description" rows={3} placeholder="Add a short description of the issue's purpose..." className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assign to Roles</label>
                <Controller name="roles" control={control} rules={{ required: 'At least one role must be assigned.' }}
                  render={({ field }) => <Select {...field} isMulti options={roleOptions} isLoading={!rolesResponse} placeholder="Select roles..." 
                    classNames={{
                      control: () => `!py-1 !border !rounded-md !shadow-sm !transition ${errors.roles ? '!border-red-400' : '!border-slate-300'} hover:!border-slate-400`,
                      valueContainer: () => '!px-2',
                      multiValue: () => 'bg-slate-200 rounded-md',
                      multiValueLabel: () => 'text-slate-800 font-medium',
                      placeholder: () => 'text-slate-400'
                    }}
                  />}
                />
                <FormError message={errors.roles?.message as string | undefined} />
              </div>
            </Section>

            <Section title="Set Priority" description="Indicate the urgency of this issue template.">
                <div className="grid grid-cols-3 gap-3">
                    {Object.entries(priorityOptions).map(([key, option]) => {
                        const isSelected = issuePriority === key;
                        const Icon = option.icon;
                        return (
                            <label key={key} className={`border-2 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-all hover:shadow-md hover:-translate-y-1 ${isSelected ? option.theme.selected : option.theme.base}`}>
                                <input {...register('priority')} type="radio" value={key} className="sr-only" />
                                <Icon size={20} className={`mb-2 ${isSelected ? option.theme.icon : 'text-slate-400'}`} />
                                <span className={`font-semibold text-sm`}>{option.label}</span>
                            </label>
                        );
                    })}
                </div>
            </Section>

            <Section title="Attach File" description="Optionally, add a default attachment like a PDF guide or an image.">
                {isEditing && issue?.fileUrl && !isExistingFileRemoved ? (
                    <FilePreview
                        fileName={issue.fileUrl.split('/').pop()?.split('?')[0] || 'Attachment'}
                        previewUrl={issue.fileUrl}
                        isImage={!!issue.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)}
                        onRemove={() => setIsExistingFileRemoved(true)}
                    />
                ) : (
                    <Controller name="file" control={control} render={({ field }) => <FileUploader field={field} />} />
                )}
            </Section>
          </div>

          <footer className="flex-shrink-0 flex justify-end gap-3 p-4 bg-white/50 backdrop-blur-sm border-t border-slate-200 sticky bottom-0">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-white text-sm font-semibold text-slate-800 rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors shadow-sm">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-blue-600 text-sm font-semibold text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]">
              {isSubmitting ? <><Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" /> Saving...</> : (isEditing ? 'Save Changes' : 'Create Issue')}
            </button>
          </footer>
        </form>
      </motion.div>
    </div>
  );
}