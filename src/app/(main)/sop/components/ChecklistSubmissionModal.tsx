'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useSession } from 'next-auth/react';
import { X, Camera, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';

export default function ChecklistSubmissionModal({ checklist, onClose, onSuccess }: { checklist: any; onClose: () => void; onSuccess: () => void; }) {
  const { data: session } = useSession();
  const { handleSubmit, control, formState: { isSubmitting } } = useForm({
    // Set up the form with an array of items based on the checklist
    defaultValues: {
      items: checklist.checklistItems.map((item: any) => ({
        text: item.text,
        file: null as File | null, // Each item will have a file property
      }))
    }
  });

  const { fields, update } = useFieldArray({ control, name: "items" });
  const [error, setError] = useState('');

  // When a file is selected for a specific item, update its state
  const handleFileChange = (index: number, file: File | null) => {
    if (file) {
      update(index, { ...fields[index], file: file });
    }
  };

  const onSubmit = async (data: any) => {
    if (!session) return;
    setError('');

    // Construct a FormData object to send files and data
    const formData = new FormData();
    formData.append('sopId', checklist._id);

    const responsesPayload: { text: string; checked: boolean }[] = [];
    
    // Check if all items have a file
    for (const item of data.items) {
      if (!item.file) {
        setError(`An image is required for: "${item.text}"`);
        return;
      }
      // Add the file to the FormData object
      formData.append('files', item.file);
      // Add the text data to a separate payload
      responsesPayload.push({ text: item.text, checked: true });
    }

    // Append the text data as a JSON string
    formData.append('responses', JSON.stringify(responsesPayload));

    try {
      const headers = new Headers();
      // Use the manual header injection pattern that works for your app
      headers.append('x-tenant-id', session.user.tenantId);

      const res = await fetch('/api/sop/checklist/submit', {
        method: 'POST',
        headers: headers,
        body: formData, // Send the FormData object
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
          <p className="mb-4 text-gray-600">Please complete each task and upload a photo for verification.</p>
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
                  
                  {currentFile ? (
                    <div className="relative h-12 w-12 rounded-md overflow-hidden flex-shrink-0">
                      <Image src={URL.createObjectURL(currentFile)} alt="preview" layout="fill" className="object-cover" />
                    </div>
                  ) : (
                    <label className="cursor-pointer text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-100 transition-colors">
                      <Camera className="h-6 w-6" />
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
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