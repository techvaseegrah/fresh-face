'use client';

import { useState, ChangeEvent, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { X, Loader2, AlertTriangle, Upload, File as FileIcon } from 'lucide-react';

// --- Type Definitions ---
interface IssueForModal {
    _id: string;
    title: string;
    description: string;
    checklistItems: {
      _id: string;
      questionText: string;
      responseType: 'yes_no' | 'yes_no_remarks';
      mediaUpload: 'none' | 'optional' | 'required';
    }[];
}
interface IssueSubmissionModalProps {
    issue: IssueForModal;
    isResubmitting: boolean;
    onClose: () => void;
    onSuccess: (response: any) => void;
}

export default function IssueSubmissionModal({ issue, isResubmitting, onClose, onSuccess }: IssueSubmissionModalProps) {
    const { data: session } = useSession();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const [answer, setAnswer] = useState<'yes' | 'no' | ''>('');
    const [remarks, setRemarks] = useState('');
    const [file, setFile] = useState<File | null>(null);

    // ✅ THE FIX: The component now safely handles issues with or without checklist items.
    const firstChecklistItem = issue.checklistItems?.[0];

    useEffect(() => {
        // If it's a resubmission, you might want to pre-fill old data here in the future.
        // For now, we just clear the form for a fresh start.
        setAnswer('');
        setRemarks('');
        setFile(null);
    }, [issue]);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0] || null;
        if (selectedFile && selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
            toast.error("File is too large. Maximum size is 10MB.");
            return;
        }
        setFile(selectedFile);
    };

    const handleSubmit = async () => {
        if (!session) { toast.error("Session expired."); return; }
        // Validation checks
        if (!firstChecklistItem) { toast.error("This issue has no checklist and cannot be completed."); return; }
        if (!answer) { toast.error("Please answer the question."); return; }
        if (firstChecklistItem.mediaUpload === 'required' && !file) {
            toast.error("A file upload is required for this issue."); return;
        }

        setIsSubmitting(true);
        setServerError(null);

        const formData = new FormData();
        formData.append('issueId', issue._id);
        const responseForApi = [{
            checklistItem: firstChecklistItem._id, // Send the actual checklist item ID
            answer: answer,
            remarks: remarks,
        }];
        formData.append('items', JSON.stringify(responseForApi));
        if (file) { formData.append(`files[0]`, file); }

        try {
            const res = await fetch('/api/issue/submit', {
                method: 'POST',
                headers: { 'x-tenant-id': session.user.tenantId },
                body: formData,
            });
            const responseData = await res.json();
            if (!res.ok) throw new Error(responseData.message || 'Failed to submit issue.');
            onSuccess(responseData);
        } catch (error: any) {
            setServerError(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-5 border-b">
                    <h2 className="text-xl font-bold text-gray-800">{issue.title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto">
                    {serverError && <div className="p-3 bg-red-50 text-red-700 rounded-md flex items-center gap-2"><AlertTriangle size={18}/> {serverError}</div>}
                    
                    {/* ✅ THE FIX: The form is now fully dynamic and handles all cases. */}
                    {!firstChecklistItem ? (
                        <div className="p-3 bg-yellow-50 text-yellow-800 rounded-md flex items-center gap-2">
                            <AlertTriangle size={18}/> This issue has no checklist and cannot be completed.
                        </div>
                    ) : (
                        <>
                            <div>
                                <p className="font-semibold text-gray-700">1. {firstChecklistItem.questionText}</p>
                                <div className="flex items-center gap-8 mt-4">
                                    <label className="flex items-center cursor-pointer"><input type="radio" name="answer" value="yes" checked={answer === 'yes'} onChange={() => setAnswer('yes')} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"/><span className="ml-2 block text-sm text-gray-800">Yes</span></label>
                                    <label className="flex items-center cursor-pointer"><input type="radio" name="answer" value="no" checked={answer === 'no'} onChange={() => setAnswer('no')} className="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"/><span className="ml-2 block text-sm text-gray-800">No</span></label>
                                </div>
                            </div>
                            {firstChecklistItem.responseType === 'yes_no_remarks' && (
                                <div>
                                    <label htmlFor="remarks" className="block text-sm font-medium text-gray-700">Remarks (Optional)</label>
                                    <textarea id="remarks" placeholder="Add remarks about the resolution..." value={remarks} onChange={(e) => setRemarks(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500" rows={3}/>
                                </div>
                            )}
                            {firstChecklistItem.mediaUpload !== 'none' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Upload Proof ({firstChecklistItem.mediaUpload === 'required' ? 'Required' : 'Optional'})</label>
                                    {!file ? (
                                        <label className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-sm font-semibold cursor-pointer hover:bg-gray-50 transition-colors">
                                            <Upload size={16}/><span>Upload Media</span><input type='file' accept="image/*,video/*,.pdf" className="hidden" onChange={handleFileChange} />
                                        </label>
                                    ) : (
                                        <div className="p-2 border rounded-md bg-gray-50 relative flex items-center gap-2 text-sm">
                                            <FileIcon className="h-5 w-5 text-gray-500 flex-shrink-0" /><p className="text-gray-700 truncate">{file.name}</p>
                                            <button type="button" onClick={() => setFile(null)} className="ml-auto text-red-500 hover:text-red-700"><X size={16}/></button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div className="flex justify-end gap-4 p-5 border-t bg-gray-50 rounded-b-lg">
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleSubmit} className="btn-primary" disabled={isSubmitting || !firstChecklistItem}>
                        {isSubmitting && <Loader2 size={18} className="animate-spin mr-2" />}
                        {isSubmitting ? 'Submitting...' : 'Submit Issue'}
                    </button>
                </div>
            </div>
        </div>
    );
}