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
  _id: string;
  taskName: string;
  dueDate: string;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'None';
  status: 'Pending' | 'Awaiting Review' | 'Approved' | 'Rejected';
  position: string;
  checklistQuestions?: IChecklistQuestion[];
}

// --- Reusable Media Preview Modal (No changes) ---
const MediaPreviewModal = ({ mediaUrl, onClose }: { mediaUrl: string; onClose: () => void; }) => {
    const isVideo = ['.mp4', '.webm', '.ogg'].some(ext => mediaUrl.toLowerCase().endsWith(ext));
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[60]" onClick={onClose}>
            <div className="relative max-w-3xl max-h-[80vh] bg-white rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
                {isVideo ? (
                    <video src={mediaUrl} controls autoPlay className="w-full h-full rounded-lg" />
                ) : (
                    <img src={mediaUrl} alt="Media preview" className="max-w-full max-h-[80vh] object-contain rounded-lg"/>
                )}
                 <button onClick={onClose} className="absolute -top-3 -right-3 bg-white text-black rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold shadow-lg hover:bg-gray-200">
                    &times;
                </button>
            </div>
        </div>
    );
};

// --- Reusable Checklist Modal (No changes) ---
const ChecklistModal = ({ task, onClose, onSubmit }: { task: ITaskViewModel, onClose: () => void, onSubmit: (answers: IChecklistAnswer[], taskId: string) => void }) => {
  const [answers, setAnswers] = useState<IChecklistAnswer[]>(
    task.checklistQuestions?.map(q => ({ questionText: q.questionText, answer: null, remarks: '', mediaUrl: '' })) || []
  );
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);

  const handleAnswerChange = (index: number, field: keyof Omit<IChecklistAnswer, 'questionText'>, value: string | null) => {
    setAnswers(currentAnswers =>
      currentAnswers.map((ans, i) => (i === index ? { ...ans, [field]: value } : ans))
    );
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>, index: number) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("File is too large. Maximum size is 10MB."); return; }
    setUploadingIndex(index);
    try {
        const fileData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
        const response = await fetch('/api/tasks/upload-media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileData }), });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Upload failed.');
        handleAnswerChange(index, 'mediaUrl', result.url);
    } catch (error: any) {
        alert(`File upload failed: ${error.message}`);
    } finally {
        setUploadingIndex(null);
    }
  };

  const handleSubmit = () => {
    for (let i = 0; i < (task.checklistQuestions?.length ?? 0); i++) {
        if (!answers[i].answer) { alert(`Please provide an answer for question ${i + 1}.`); return; }
        if (task.checklistQuestions![i].mediaUpload === 'Required' && !answers[i].mediaUrl) { alert(`A media upload is required for question ${i + 1}.`); return; }
    }
    onSubmit(answers, task._id);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
        <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-lg">
          <div className="flex justify-between items-center pb-4 border-b mb-4">
            <h2 className="text-xl font-bold text-gray-800">{task.taskName}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><span className="text-2xl">&times;</span></button>
          </div>
          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-3">
            {task.checklistQuestions?.map((q, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg">
                <p className="font-semibold text-gray-700">{index + 1}. {q.questionText}</p>
                <div className="flex items-center gap-8 mt-3">
                  <label className="flex items-center"><input type="radio" name={`answer-${index}`} checked={answers[index]?.answer === 'Yes'} onChange={() => handleAnswerChange(index, 'answer', 'Yes')} className="h-4 w-4 text-blue-600 focus:ring-blue-500"/><span className="ml-2 text-sm">Yes</span></label>
                  <label className="flex items-center"><input type="radio" name={`answer-${index}`} checked={answers[index]?.answer === 'No'} onChange={() => handleAnswerChange(index, 'answer', 'No')} className="h-4 w-4 text-blue-600 focus:ring-blue-500"/><span className="ml-2 text-sm">No</span></label>
                </div>
                {q.responseType === 'Yes/No + Remarks' && <textarea placeholder="Add optional remarks..." value={answers[index]?.remarks || ''} onChange={(e) => handleAnswerChange(index, 'remarks', e.target.value)} className="mt-3 w-full border-gray-300 rounded-md p-2 text-sm" rows={2}/>}
                {q.mediaUpload !== 'None' && (
                  <div className="mt-3">
                    {uploadingIndex === index ? <p className="text-sm text-blue-500 animate-pulse">Uploading...</p>
                    : answers[index]?.mediaUrl ? <button type="button" onClick={() => setMediaPreviewUrl(answers[index].mediaUrl!)} className="text-sm text-green-600 font-semibold hover:underline">View Media</button>
                    : <><label htmlFor={`file-upload-${index}`} className="text-sm text-blue-600 font-semibold cursor-pointer hover:underline">{q.mediaUpload === 'Required' ? '* ' : ''}Upload Media</label><input id={`file-upload-${index}`} type="file" className="hidden" accept="image/*,video/*" onChange={(e) => handleFileChange(e, index)}/></>}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-4 pt-5 border-t mt-4">
            <button type="button" onClick={onClose} className="bg-gray-200 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-gray-300">Cancel</button>
            <button type="button" onClick={handleSubmit} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700" disabled={uploadingIndex !== null}>Submit</button>
          </div>
        </div>
      </div>
      {mediaPreviewUrl && <MediaPreviewModal mediaUrl={mediaPreviewUrl} onClose={() => setMediaPreviewUrl(null)} />}
    </>
  );
};

// --- Main Staff Page Component ---
const MyTasksPage = () => {
  const { data: session, status: sessionStatus } = useSession();
  const [myTasks, setMyTasks] = useState<ITaskViewModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [selectedTask, setSelectedTask] = useState<ITaskViewModel | null>(null);

  // --- Logic and Data Fetching (No Changes) ---
  const makeApiRequest = useCallback(async (url: string, options: RequestInit = {}) => {
    if (!session?.user?.tenantId) throw new Error('Session not found.');
    const headers = new Headers(options.headers || {});
    headers.set('x-tenant-id', session.user.tenantId);
    if(options.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'API Request Failed'); }
    return response.json();
  }, [session]);

  const fetchMyTasks = useCallback(async () => {
    if (sessionStatus === 'authenticated') {
      setIsLoading(true);
      setError(null);
      try {
        const response = await makeApiRequest('/api/tasks?assignedTo=me');
        if (response.success) setMyTasks(response.data);
      } catch (err: any) {
        setError(err.message);
      } finally { setIsLoading(false); }
    }
  }, [sessionStatus, makeApiRequest]);

  useEffect(() => { fetchMyTasks(); }, [fetchMyTasks]);

  const filteredTasks = useMemo(() => {
    const actionableTasks = myTasks.filter((task: ITaskViewModel) => task.status !== 'Approved');
    switch (activeFilter) {
      case 'Daily': return actionableTasks.filter((task: ITaskViewModel) => task.frequency === 'Daily' || task.frequency === 'None');
      case 'Weekly': return actionableTasks.filter((task: ITaskViewModel) => task.frequency === 'Weekly');
      case 'Monthly': return actionableTasks.filter((task: ITaskViewModel) => task.frequency === 'Monthly');
      default: return [];
    }
  }, [myTasks, activeFilter]);

  const handleSubmitChecklist = async (answers: IChecklistAnswer[], taskId: string) => {
    try {
        await makeApiRequest(`/api/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ checklistAnswers: answers }) });
        alert('Checklist submitted successfully!');
        fetchMyTasks();
        setSelectedTask(null);
    } catch (err: any) { alert(`Failed to submit: ${err.message}`); }
  };

  const StatusDisplay = ({ task }: { task: ITaskViewModel }) => {
    switch (task.status) {
      case 'Awaiting Review': return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Awaiting Review</span>;
      case 'Rejected': return <button type="button" onClick={() => setSelectedTask(task)} className="bg-red-600 text-white px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-red-700">Resubmit</button>;
      default: return <button type="button" onClick={() => setSelectedTask(task)} className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-blue-700">Start Task</button>;
    }
  };

  if (isLoading || sessionStatus === 'loading') {
    return <div className="flex justify-center items-center h-screen bg-gray-50"><div className="text-center"><p className="text-lg font-semibold text-gray-700">Loading Your Tasks...</p><p className="text-sm text-gray-500">Please wait a moment.</p></div></div>;
  }
  if (error) {
    return <div className="flex justify-center items-center h-screen bg-red-50"><div className="text-center p-8 border border-red-200 rounded-lg bg-white"><h2 className="text-xl font-bold text-red-600 mb-2">An Error Occurred</h2><p className="text-red-500">{error}</p></div></div>;
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">My Checklists</h1>
          <p className="mt-1 text-md text-gray-500">Tasks to be completed for {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="mb-8">
            <div className="flex items-center space-x-4">
                {(['Daily', 'Weekly', 'Monthly'] as const).map(f => (
                    <button key={f} onClick={() => setActiveFilter(f)} className={`relative flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${activeFilter === f ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                        {f === 'Daily' && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path></svg>}
                        {f !== 'Daily' && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                        <span>{f}</span>
                        {activeFilter === f && filteredTasks.length > 0 && (<span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center ring-2 ring-white">{filteredTasks.length}</span>)}
                    </button>
                ))}
            </div>
        </div>
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-lg shadow-sm">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">All tasks completed!</h3>
              <p className="mt-1 text-sm text-gray-500">No {activeFilter.toLowerCase()} tasks are currently pending.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* --- ✅✅✅ MODIFICATION START HERE ✅✅✅ --- */}
              {filteredTasks.map((task: ITaskViewModel) => (
                <div key={task._id} className="bg-white rounded-xl shadow-md flex flex-col justify-between transform transition-all duration-300 ease-in-out hover:shadow-lg hover:scale-105 hover:-translate-y-1">
                  {/* Card Body */}
                  <div className="p-5">
                      <p className="text-lg font-semibold text-gray-800 truncate">{task.taskName}</p>
                      <p className="text-sm text-gray-500 mt-1">({task.position})</p>
                  </div>
                   {/* Card Footer with Due Date */}
                  <div className="mt-2 p-5 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-sm text-gray-500">Due: <span className="font-medium">{new Date(task.dueDate).toLocaleDateString()}</span></p>
                    <StatusDisplay task={task} />
                  </div>
                </div>
              ))}
              {/* --- ✅✅✅ MODIFICATION END HERE ✅✅✅ --- */}
            </div>
          )}
        </div>
      </div>
      {selectedTask && <ChecklistModal task={selectedTask} onClose={() => setSelectedTask(null)} onSubmit={handleSubmitChecklist} />}
    </div>
  );
};

export default MyTasksPage;