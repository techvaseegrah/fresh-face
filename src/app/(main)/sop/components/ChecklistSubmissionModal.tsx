'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller, FieldError, Control } from 'react-hook-form';
import { useSession } from 'next-auth/react';
import { X, Loader2, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';

// --- (1) DEFINE STRONG TYPES ---

// For a single item within our form's `items` array
interface FormItem {
  checklistItem: string;
  questionText: string;
  responseType: 'yes_no' | 'yes_no_remarks';
  mediaUpload: 'none' | 'optional' | 'required';
  answer: 'yes' | 'no' | ''; // Can be empty string initially
  remarks: string;
  file: File | null;
}

// For the entire form data structure
interface FormData {
  items: FormItem[];
}

// For the props of the MediaUploader component
interface MediaUploaderProps {
  // `Controller` provides a correctly typed field object
  field: {
    onChange: (file: File | null) => void;
    value: File | null;
    name: string;
  };
  error?: FieldError;
}

// For the props of the main Modal component
interface ChecklistItem {
  _id: string;
  questionText: string;
  responseType: 'yes_no' | 'yes_no_remarks';
  mediaUpload: 'none' | 'optional' | 'required';
}

interface Checklist {
  _id: string;
  title: string;
  checklistItems: ChecklistItem[];
}

interface ChecklistSubmissionModalProps {
  checklist: Checklist;
  isResubmitting: boolean;
  onClose: () => void;
  onSuccess: () => void;
}


// --- A reusable sub-component to handle file selection and preview ---
const MediaUploader = ({ field, error }: MediaUploaderProps) => {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (field.value) {
      const url = URL.createObjectURL(field.value);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null);
  }, [field.value]);

  return (
    <div className="mt-2">
      {preview && field.value ? (
        <div className="relative h-24 w-24 rounded-md overflow-hidden border">
          {field.value.type.startsWith('video/') ? (
            <video src={preview} className="object-cover h-full w-full" muted autoPlay loop playsInline />
          ) : (
            <Image src={preview} alt="preview" layout="fill" className="object-cover" />
          )}
           <button type="button" onClick={() => field.onChange(null)} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-0.5 m-1 transition-transform hover:scale-110">
             <X size={12}/>
           </button>
        </div>
      ) : (
        <label className={`cursor-pointer text-sm font-medium flex items-center gap-2 ${error ? 'text-red-600' : 'text-blue-600 hover:text-blue-800'}`}>
          <ImageIcon size={16} /> Upload Media
          <input type="file" className="hidden" accept="image/*,video/*" onChange={(e) => field.onChange(e.target.files ? e.target.files[0] : null)} />
        </label>
      )}
    </div>
  );
};


// --- The main modal component ---
export default function ChecklistSubmissionModal({ checklist, isResubmitting, onClose, onSuccess }: ChecklistSubmissionModalProps) {
  const { data: session } = useSession();
  
  // --- (2) APPLY THE STRONG TYPE TO useForm ---
  const { handleSubmit, control, formState: { isSubmitting, errors } } = useForm<FormData>({
    defaultValues: {
      items: checklist.checklistItems.map((item) => ({
        checklistItem: item._id,
        questionText: item.questionText,
        responseType: item.responseType,
        mediaUpload: item.mediaUpload,
        answer: '',
        remarks: '',
        file: null,
      }))
    }
  });

  const { fields } = useFieldArray({ control, name: "items" });

  const onSubmit = async (data: FormData) => {
    if (!session?.user) return;

    const formData = new FormData();
    formData.append('sopId', checklist._id);

    // Prepare the structured 'items' payload, excluding the raw file object
    const itemsPayload = data.items.map(({ file, ...rest }) => rest);
    formData.append('items', JSON.stringify(itemsPayload));

    // Append files with an indexed key so the backend can match them
    data.items.forEach((item, index) => {
        if (item.file) {
            formData.append(`files[${index}]`, item.file);
        }
    });

    try {
      const headers = new Headers();
      headers.append('x-tenant-id', session.user.tenantId);
      
      const res = await fetch('/api/sop/checklist/submit', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Submission failed');
      }
      onSuccess();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">{checklist.title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8 space-y-6">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 border rounded-lg bg-gray-50/50">
                <p className="font-semibold text-gray-800 mb-3">{index + 1}. {field.questionText}</p>

                <Controller
                    name={`items.${index}.answer`}
                    control={control}
                    rules={{ required: 'Please select Yes or No.' }}
                    render={({ field: radioField }) => (
                      <div className="flex items-center gap-6 mb-3">
                        <label className="flex items-center gap-2 cursor-pointer"><input type="radio" {...radioField} value="yes" className="form-radio text-blue-600 focus:ring-blue-500" /> Yes</label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="radio" {...radioField} value="no" className="form-radio text-blue-600 focus:ring-blue-500" /> No</label>
                      </div>
                    )}
                />
                
                {field.responseType === 'yes_no_remarks' && (
                  <Controller
                    name={`items.${index}.remarks`}
                    control={control}
                    render={({ field: remarksField }) => (
                      <div className="mb-3">
                        <label className="text-sm font-medium text-gray-600">Remarks (Optional)</label>
                        <textarea {...remarksField} rows={2} className="form-input mt-1 w-full" placeholder="Add optional remarks..." />
                      </div>
                    )}
                  />
                )}
                
                {field.mediaUpload !== 'none' && (
                  <Controller
                    name={`items.${index}.file`}
                    control={control}
                    rules={{ required: field.mediaUpload === 'required' ? 'Media upload is required for this item.' : false }}
                    render={({ field: fileField, fieldState }) => (
                       <MediaUploader field={fileField} error={fieldState.error}/>
                    )}
                  />
                )}

                {/* --- (3) FIX THE ERROR DISPLAY --- */}
                {/* Now that `errors.items` is a typed array, you can access it safely */}
                {(errors.items?.[index]?.answer || errors.items?.[index]?.file) && (
                  <p className="text-red-500 text-xs mt-2">
                    {errors.items?.[index]?.answer?.message || errors.items?.[index]?.file?.message}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-4 p-6 bg-gray-50 border-t rounded-b-xl">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting && <Loader2 size={18} className="animate-spin mr-2" />}
              {isSubmitting ? 'Submitting...' : (isResubmitting ? 'Re-submit Checklist' : 'Submit Checklist')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}