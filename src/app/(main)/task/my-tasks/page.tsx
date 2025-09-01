'use client';

import React, { useState, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import { useSession } from 'next-auth/react';

// --- Interfaces (No changes) ---
interface IChecklistQuestion {
  questionText: string;
  responseType: 'Yes/No' | 'Yes/No + Remarks';
  mediaUpload: 'None' | 'Optional' | 'Required';
}
interface IChecklistAnswer {
  questionText: string;
  answer: 'Yes' | 'No' | null;
  remarks?: string;
  mediaUrl?: string;
}
interface ITaskViewModel {
  _id: string; taskName: string; dueDate: string;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'None';
  status: 'Pending' | 'Ongoing' | 'Overdue' | 'Completed' | 'Awaiting Review' | 'Approved' | 'Rejected';
  assignedTo?: { name: string; }; position: string;
  checklistQuestions?: IChecklistQuestion[];
}


// --- Media Preview Modal Component (No changes) ---
const MediaPreviewModal = ({ mediaUrl, onClose }: { mediaUrl: string; onClose: () => void; }) => {
    const isVideo = ['.mp4', '.webm', '.ogg'].some(ext => mediaUrl.toLowerCase().endsWith(ext));
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[60]" onClick={onClose}>
            <div className="relative max-w-3xl max-h-[80vh] bg-white rounded-lg" onClick={(e) => e.stopPropagation()}>
                {isVideo ? (
                    <video src={mediaUrl} controls autoPlay className="w-full h-full rounded-lg" />
                ) : (
                    <img src={mediaUrl} alt="Media preview" className="max-w-full max-h-[80vh] object-contain rounded-lg"/>
                )}
                 <button onClick={onClose} className="absolute -top-4 -right-4 bg-white text-black rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold shadow-lg hover:bg-gray-200" aria-label="Close media preview">
                    &times;
                </button>
            </div>
        </div>
    );
};

// --- Checklist Modal Component (No changes) ---
const ChecklistModal = ({ task, onClose, onSubmit }: { task: ITaskViewModel, onClose: () => void, onSubmit: (answers: IChecklistAnswer[], taskId: string) => void }) => {
  const [answers, setAnswers] = useState<IChecklistAnswer[]>(
    task.checklistQuestions?.map(q => ({ questionText: q.questionText, answer: null, remarks: '', mediaUrl: '' })) || []
  );
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);

  const handleAnswerChange = (index: number, field: keyof Omit<IChecklistAnswer, 'questionText'>, value: string | any) => {
    setAnswers(currentAnswers =>
      currentAnswers.map((ans, i) => (i === index ? { ...ans, [field]: value } : ans))
    );
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>, index: number) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        alert("File is too large. Maximum size is 10MB.");
        return;
    }
    setUploadingIndex(index);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
        const fileData = reader.result as string;
        try {
            const response = await fetch('/api/tasks/upload-media', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileData }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Upload failed due to a server error.');
            handleAnswerChange(index, 'mediaUrl', result.url);
        } catch (error: any) {
            console.error('File upload process failed:', error);
            alert(`File upload failed: ${error.message}`);
        } finally {
            setUploadingIndex(null);
        }
    };
    reader.onerror = () => {
        alert("Failed to read the selected file.");
        setUploadingIndex(null);
    };
  };

  const handleSubmit = () => onSubmit(answers, task._id);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-lg">
          {/* Modal Header */}
          <div className="flex justify-between items-center pb-4 border-b mb-4">
            <h2 className="text-xl font-bold text-gray-800">{task.taskName}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <span className="text-2xl">&times;</span>
            </button>
          </div>

          {/* Questions Body */}
          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-3">
            {task.checklistQuestions?.map((q, index) => (
              <div key={index}>
                <p className="font-semibold text-gray-700">{index + 1}. {q.questionText}</p>
                
                {/* Radio Buttons */}
                <div className="flex items-center gap-8 mt-3">
                  <div className="flex items-center">
                    <input id={`yes-${index}`} name={`answer-${index}`} type="radio" checked={answers[index]?.answer === 'Yes'} onChange={() => handleAnswerChange(index, 'answer', 'Yes')} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"/>
                    <label htmlFor={`yes-${index}`} className="ml-2 block text-sm text-gray-800">Yes</label>
                  </div>
                  <div className="flex items-center">
                    <input id={`no-${index}`} name={`answer-${index}`} type="radio" checked={answers[index]?.answer === 'No'} onChange={() => handleAnswerChange(index, 'answer', 'No')} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"/>
                    <label htmlFor={`no-${index}`} className="ml-2 block text-sm text-gray-800">No</label>
                  </div>
                </div>

                {/* Remarks */}
                {q.responseType === 'Yes/No + Remarks' && (
                  <div className="mt-3">
                    <label htmlFor={`remarks-${index}`} className="block text-sm font-medium text-gray-700">Remarks (Optional)</label>
                    <textarea id={`remarks-${index}`} placeholder="Add optional remarks..." value={answers[index]?.remarks || ''} onChange={(e) => handleAnswerChange(index, 'remarks', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500" rows={3}/>
                  </div>
                )}

                {/* Media Upload */}
                {q.mediaUpload !== 'None' && (
                  <div className="mt-3">
                    {uploadingIndex === index ? (
                      <p className="text-sm text-gray-500 animate-pulse">Uploading...</p>
                    ) : answers[index]?.mediaUrl ? (
                      <button onClick={() => setMediaPreviewUrl(answers[index].mediaUrl!)} className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-3 py-2 rounded-md text-sm font-semibold hover:bg-green-200 transition-colors">
                        View Media
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      </button>
                    ) : (
                      <>
                        <label htmlFor={`file-upload-${index}`} className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm font-semibold cursor-pointer hover:bg-gray-50 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          {q.mediaUpload === 'Required' ? '* ' : ''}Upload Media
                        </label>
                        <input id={`file-upload-${index}`} type="file" className="hidden" accept="image/*,video/*" onChange={(e) => handleFileChange(e, index)}/>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Modal Footer */}
          <div className="flex justify-end gap-4 pt-5 border-t mt-4">
            <button onClick={onClose} className="bg-gray-200 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-gray-300 transition-colors">Cancel</button>
            <button onClick={handleSubmit} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors" disabled={uploadingIndex !== null}>Submit Checklist</button>
          </div>
        </div>
      </div>
      
      {mediaPreviewUrl && <MediaPreviewModal mediaUrl={mediaPreviewUrl} onClose={() => setMediaPreviewUrl(null)} />}
    </>
  );
};

const MyTasksPage = () => {
  const { data: session, status: sessionStatus } = useSession();
  const [allAssignedTasks, setAllAssignedTasks] = useState<ITaskViewModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [selectedTask, setSelectedTask] = useState<ITaskViewModel | null>(null);

  // --- API request and data fetching logic (No changes) ---
  const makeApiRequest = useCallback(async (url: string, options: RequestInit = {}) => {
    if (!session?.user?.tenantId) throw new Error('Session not found.');
    const headers = new Headers(options.headers || {});
    headers.set('x-tenant-id', session.user.tenantId);
    if(options.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) { 
      const errorText = await response.text();
      try { const json = JSON.parse(errorText); throw new Error(json.error || 'API Error'); } 
      catch { throw new Error(errorText.substring(0, 200) || 'Server Error'); }
    }
    return response.json();
  }, [session]);
  
  const fetchAllTasks = useCallback(async () => {
    if (sessionStatus === 'authenticated') {
      setIsLoading(true);
      setError(null);
      try {
        const response = await makeApiRequest('/api/tasks?view=compliance');
        if (response.success) setAllAssignedTasks(response.data);
      } catch (error: any) { 
        console.error("Failed to fetch tasks:", error);
        setError(error.message);
      }
      finally { setIsLoading(false); }
    }
  }, [sessionStatus, makeApiRequest]);

  useEffect(() => { fetchAllTasks(); }, [fetchAllTasks]);
  
  // --- ✅✅✅ MODIFICATIONS START HERE ✅✅✅ ---
  const filteredTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Define statuses that mean the task is "done" from the user's perspective and should be hidden.
    const completedStatuses = ['Completed', 'Approved'];
    
    // Filter out the completed tasks, keeping 'Pending', 'Awaiting Review', 'Rejected', etc.
    const actionableTasks = allAssignedTasks.filter(task => !completedStatuses.includes(task.status));

    switch (activeFilter) {
      case 'Daily':
        return actionableTasks.filter(task => {
          if (task.frequency === 'Daily') return true;
          if (task.frequency === 'None') {
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate.getTime() === today.getTime();
          }
          return false;
        });
      case 'Weekly': return actionableTasks.filter(task => task.frequency === 'Weekly');
      case 'Monthly': return actionableTasks.filter(task => task.frequency === 'Monthly');
      default: return [];
    }
  }, [allAssignedTasks, activeFilter]);
  // --- ✅✅✅ MODIFICATIONS END HERE ✅✅✅ ---
  
  const handleSubmitChecklist = async (answers: IChecklistAnswer[], taskId: string) => {
    try {
        await makeApiRequest(`/api/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ checklistAnswers: answers }) });
        alert('Checklist submitted successfully! Awaiting review.');
        fetchAllTasks();
        setSelectedTask(null);
    } catch (error: any) { alert(`Failed to submit: ${error.message}`); }
  };

  const StatusDisplay = ({ task }: { task: ITaskViewModel }) => {
    switch (task.status) {
      case 'Completed':
      case 'Approved':
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Completed</span>;
      case 'Awaiting Review':
        // This view will now be visible on the main page
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Awaiting Review</span>;
      case 'Rejected':
        return <button onClick={() => setSelectedTask(task)} className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">Resubmit</button>;
      default: // This covers 'Pending' and any other non-final status
        return <button onClick={() => setSelectedTask(task)} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">Start Task</button>;
    }
  };

  if (isLoading || sessionStatus === 'loading') {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700">Loading Tasks...</p>
          <p className="text-sm text-gray-500">Please wait a moment.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen bg-red-50">
        <div className="text-center p-8 border border-red-200 rounded-lg bg-white">
          <h2 className="text-xl font-bold text-red-600 mb-2">An Error Occurred</h2>
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold leading-tight text-gray-900">Task Compliance Overview</h1>
          <p className="mt-1 text-md text-gray-600">Monitor and complete checklists for all assigned staff tasks.</p>
        </div>
        
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
              {(['Daily', 'Weekly', 'Monthly'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`${
                    activeFilter === f
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
                >
                  {f} Tasks
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-lg shadow-sm">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">All tasks completed!</h3>
              <p className="mt-1 text-sm text-gray-500">No {activeFilter.toLowerCase()} tasks are currently pending.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTasks.map(task => (
                <div key={task._id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 ease-in-out">
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <p className="text-lg font-semibold text-gray-800 truncate">{task.taskName}</p>
                            <p className="text-sm text-gray-500 mt-1">
                                Assigned to: <span className="font-medium text-gray-700">{task.assignedTo?.name || 'N/A'}</span>
                            </p>
                             <p className="text-xs text-gray-400">({task.position})</p>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                           <StatusDisplay task={task} />
                        </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {selectedTask && ( <ChecklistModal task={selectedTask} onClose={() => setSelectedTask(null)} onSubmit={handleSubmitChecklist} /> )}
    </div>
  );
};

export default MyTasksPage;