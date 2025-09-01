'use client';

import React, { useState, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import { useSession } from 'next-auth/react';

// --- Interfaces (These should match your Task model) ---
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

// --- Reusable Media Preview Modal ---
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

// --- Reusable Checklist Modal ---
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

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert("File is too large. Maximum size is 10MB.");
        return;
    }
    setUploadingIndex(index);
    try {
        const fileData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });

        const response = await fetch('/api/tasks/upload-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileData }),
        });
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
    // Validation check before submitting
    for (let i = 0; i < (task.checklistQuestions?.length ?? 0); i++) {
        if (!answers[i].answer) {
            alert(`Please provide an answer for question ${i + 1}.`);
            return;
        }
        if (task.checklistQuestions![i].mediaUpload === 'Required' && !answers[i].mediaUrl) {
            alert(`A media upload is required for question ${i + 1}.`);
            return;
        }
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
      {/* ✅ FIX WAS HERE: Changed 'MediaPreviewUrl' to the correct component name 'MediaPreviewModal' */}
      {mediaPreviewUrl && <MediaPreviewModal mediaUrl={mediaPreviewUrl} onClose={() => setMediaPreviewUrl(null)} />}
    </>
  );
};

// --- Main Page Component for Staff ---
const MyTasksPage = () => {
  const { data: session, status: sessionStatus } = useSession();
  const [myTasks, setMyTasks] = useState<ITaskViewModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [selectedTask, setSelectedTask] = useState<ITaskViewModel | null>(null);

  const makeApiRequest = useCallback(async (url: string, options: RequestInit = {}) => {
    if (!session?.user?.tenantId) throw new Error('Session not found.');
    const headers = new Headers(options.headers || {});
    headers.set('x-tenant-id', session.user.tenantId);
    if(options.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'API Request Failed');
    }
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

  useEffect(() => {
    fetchMyTasks();
  }, [fetchMyTasks]);

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
      case 'Awaiting Review': return <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending Review</span>;
      case 'Rejected': return <button type="button" onClick={() => setSelectedTask(task)} className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-red-700">Resubmit</button>;
      default: return <button type="button" onClick={() => setSelectedTask(task)} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">Start Task</button>;
    }
  };

  if (isLoading || sessionStatus === 'loading') {
    return <div className="p-8 text-center">Loading your tasks...</div>;
  }
  if (error) {
    return <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg">{error}</div>;
  }

  return (
    <div className="bg-gray-50 min-h-screen p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">My Tasks</h1>
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-6">
          {(['Daily', 'Weekly', 'Monthly'] as const).map(f => (
            <button key={f} type="button" onClick={() => setActiveFilter(f)} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeFilter === f ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{f} Tasks</button>
          ))}
        </nav>
      </div>
      {filteredTasks.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg shadow-sm">
          <h3 className="text-lg font-medium">All tasks completed!</h3>
          <p className="mt-1 text-sm text-gray-500">No pending {activeFilter.toLowerCase()} tasks.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTasks.map((task: ITaskViewModel) => (
            <div key={task._id} className="bg-white rounded-xl shadow p-5 flex flex-col justify-between">
              <div>
                <p className="font-semibold text-gray-800">{task.taskName}</p>
                <p className="text-sm text-gray-500">{task.position}</p>
              </div>
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <p className="text-sm text-gray-500">Due: {new Date(task.dueDate).toLocaleDateString()}</p>
                <StatusDisplay task={task} />
              </div>
            </div>
          ))}
        </div>
      )}
      {selectedTask && <ChecklistModal task={selectedTask} onClose={() => setSelectedTask(null)} onSubmit={handleSubmitChecklist} />}
    </div>
  );
};

export default MyTasksPage;