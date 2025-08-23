'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useSession } from 'next-auth/react';
import { X, Video, CheckCircle2 } from 'lucide-react';

// --- ROBUSTNESS: Define an interface for the incoming prop ---
// `checklistItems` is optional to match the type in the parent component (MyTasksPage).
interface Checklist {
  _id: string;
  title: string;
  checklistItems?: { text: string }[];
}

// The component now accepts an `isResubmitting` prop to change its behavior
export default function ChecklistSubmissionModal({
  checklist,
  isResubmitting,
  onClose,
  onSuccess
}: {
  checklist: Checklist;
  isResubmitting: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  // --- ROBUSTNESS: Add a guard clause inside the modal ---
  // This is a safety net. If the modal is somehow rendered with a checklist
  // that has no items, it will not crash.
  if (!checklist.checklistItems || checklist.checklistItems.length === 0) {
    console.error("ChecklistSubmissionModal was rendered without checklistItems.");
    // Return null to render nothing, preventing a crash.
    return null; 
  }

  const { data: session } = useSession();
  const { handleSubmit, control, formState: { isSubmitting } } = useForm({
    // The .map() is now safe because of the guard clause above.
    defaultValues: {
      items: checklist.checklistItems.map((item) => ({
        text: item.text,
        file: null as File | null,
      }))
    }
  });

  const { fields, update } = useFieldArray({ control, name: "items" });
  const [error, setError] = useState('');

  // This function validates the file size before updating the form state
  const handleFileChange = (index: number, file: File | null) => {
    if (file) {
      const MAX_FILE_SIZE_MB = 10;
      const maxFileSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;

      if (file.size > maxFileSizeBytes) {
        alert(`The selected video is too large. Please choose a file smaller than ${MAX_FILE_SIZE_MB}MB.`);
        const fileInput = document.getElementById(`file-input-${index}`) as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
        return;
      }
      
      update(index, { ...fields[index], file: file });
    }
  };

  // The onSubmit function works for both new submissions and re-submissions
  const onSubmit = async (data: any) => {
    if (!session) return;
    setError('');

    const formData = new FormData();
    formData.append('sopId', checklist._id);

    const responsesPayload: { text: string; checked: boolean }[] = [];
    
    for (const item of data.items) {
      if (!item.file) {
        setError(`A video is required for: "${item.text}"`);
        return;
      }
      formData.append('files', item.file);
      responsesPayload.push({ text: item.text, checked: true });
    }

    formData.append('responses', JSON.stringify(responsesPayload));

    try {
      const headers = new Headers();
      headers.append('x-tenant-id', session.user.tenantId);

      const res = await fetch('/api/sop/checklist/submit', {
        method: 'POST',
        headers: headers,
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Submission failed');
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{checklist.title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-1.5 rounded-full hover:bg-gray-100"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <p className="mb-4 text-gray-600">Please complete each task and upload a short video (max 10MB) for verification.</p>
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
            {fields.map((field, index) => {
              const currentFile = (field as any).file as File | null;
              return (
                <div key={field.id} className="p-3 bg-gray-50 rounded-md flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {currentFile ? 
                      <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" /> :
                      <div className="h-6 w-6 border-2 border-gray-300 rounded-full flex-shrink-0" />
                    }
                    <span className="text-gray-700">{(field as any).text}</span>
                  </div>
                  
                  {currentFile ? (
                    <div className="relative h-16 w-16 rounded-md overflow-hidden flex-shrink-0 bg-black">
                      <video
                        src={URL.createObjectURL(currentFile)}
                        className="object-cover h-full w-full"
                        autoPlay
                        loop
                        muted
                        playsInline
                      />
                    </div>
                  ) : (
                    <label className="cursor-pointer text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-100 transition-colors">
                      <Video className="h-6 w-6" />
                      <input
                        id={`file-input-${index}`}
                        type="file"
                        className="hidden"
                        accept="video/*"
                        onChange={(e) => handleFileChange(index, e.target.files ? e.target.files[0] : null)}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
          <div className="flex justify-end gap-4 mt-8">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:bg-blue-300 hover:bg-blue-700">
              {isSubmitting ? 'Submitting...' : (isResubmitting ? 'Re-submit Checklist' : 'Submit Checklist')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}