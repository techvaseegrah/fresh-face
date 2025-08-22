'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useSession } from 'next-auth/react';
// --- CHANGED ---: Replaced Camera with Video icon
import { X, Video, CheckCircle2 } from 'lucide-react';

export default function ChecklistSubmissionModal({ checklist, onClose, onSuccess }: { checklist: any; onClose: () => void; onSuccess: () => void; }) {
  const { data: session } = useSession();
  const { handleSubmit, control, formState: { isSubmitting } } = useForm({
    defaultValues: {
      items: checklist.checklistItems.map((item: any) => ({
        text: item.text,
        file: null as File | null,
      }))
    }
  });

  const { fields, update } = useFieldArray({ control, name: "items" });
  const [error, setError] = useState('');

  // --- UPDATED ---: This function now validates the file size
  const handleFileChange = (index: number, file: File | null) => {
    if (file) {
      // 1. Define the file size limit (10MB in bytes)
      const MAX_FILE_SIZE_MB = 10;
      const maxFileSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;

      // 2. Check if the selected file exceeds the limit
      if (file.size > maxFileSizeBytes) {
        // 3. If too large, show an error and prevent the upload
        alert(`The selected video is too large. Please choose a file smaller than ${MAX_FILE_SIZE_MB}MB.`);
        // Clear the file input so the user can select a different file
        const fileInput = document.getElementById(`file-input-${index}`) as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
        return; // Stop the function here
      }
      
      // 4. If the file size is valid, update the form state
      update(index, { ...fields[index], file: file });
    }
  };

  const onSubmit = async (data: any) => {
    if (!session) return;
    setError('');

    const formData = new FormData();
    formData.append('sopId', checklist._id);

    const responsesPayload: { text: string; checked: boolean }[] = [];
    
    for (const item of data.items) {
      if (!item.file) {
        // --- CHANGED ---: Updated error message
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{checklist.title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* --- CHANGED ---: Updated prompt text */}
          <p className="mb-4 text-gray-600">Please complete each task and upload a short video (max 10MB) for verification.</p>
          <div className="space-y-4">
            {fields.map((field, index) => {
              const currentFile = (field as any).file as File | null;
              return (
                <div key={field.id} className="p-3 bg-gray-50 rounded-md flex items-center justify-between gap-4">
                  <div className="flex items-center">
                    {currentFile ? 
                      <CheckCircle2 className="h-6 w-6 text-green-500 mr-3 flex-shrink-0" /> :
                      <div className="h-6 w-6 border-2 border-gray-300 rounded-full mr-3 flex-shrink-0" />
                    }
                    <span className="text-gray-700">{(field as any).text}</span>
                  </div>
                  
                  {/* --- MAJOR CHANGE ---: Replaced Image with Video preview */}
                  {currentFile ? (
                    <div className="relative h-16 w-16 rounded-md overflow-hidden flex-shrink-0 bg-black">
                      <video
                        src={URL.createObjectURL(currentFile)}
                        className="object-cover h-full w-full"
                        autoPlay
                        loop
                        muted
                        playsInline // Important for mobile browsers
                      />
                    </div>
                  ) : (
                    <label className="cursor-pointer text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-100 transition-colors">
                      {/* --- CHANGED ---: Replaced Camera icon */}
                      <Video className="h-6 w-6" />
                      <input
                        // --- ADDED ---: Unique ID to allow clearing the input
                        id={`file-input-${index}`}
                        type="file"
                        className="hidden"
                        // --- CHANGED ---: accept attribute now looks for videos
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
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-blue-300">
              {isSubmitting ? 'Submitting...' : 'Submit Checklist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}