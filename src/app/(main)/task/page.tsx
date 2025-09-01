'use client';

import React, { useState, useEffect, useCallback, useMemo, FormEvent, ChangeEvent } from 'react';
import { useSession } from 'next-auth/react';

// --- SVG Icons for UI Elements (No changes) ---
const ViewIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C3.732 4.943 9.522 3 10 3s6.268 1.943 9.542 7c-3.274 5.057-9.064 7-9.542 7S3.732 15.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>;
const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const DailyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const WeeklyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;
const MonthlyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

// --- Interfaces (No changes) ---
interface IStaffMember { _id: string; name: string; position: string; status: 'active' | 'inactive'; }
interface IChecklistQuestion {
  questionText: string;
  responseType: 'Yes/No' | 'Yes/No + Remarks';
  mediaUpload: 'None' | 'Optional' | 'Required';
}
interface ITaskViewModel {
  _id: string; taskName: string; position: string; status: string; dueDate: string;
  assignedTo?: { name: string }; isGroupMaster: boolean; parentTaskId?: string;
  checklistQuestions?: IChecklistQuestion[];
}

// --- Reusable Components & Modals (No changes needed) ---
// ... (Your existing ViewTaskModal, EditTaskModal, and ChecklistDisplay components go here)
const ChecklistDisplay = ({ questions }: { questions: IChecklistQuestion[] }) => (
    <div className="mt-6 pt-4 border-t border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">Checklist</h3>
      {questions && questions.length > 0 ? (
        <ul className="space-y-3">
          {questions.map((q, index) => (
            <li key={index} className="flex items-start p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-semibold text-gray-500 mr-3">{index + 1}.</span>
              <div className="flex-1">
                <p className="text-gray-700">{q.questionText}</p>
                <div className="flex items-center text-xs text-gray-500 mt-1">
                  <span>Response: {q.responseType}</span>
                  <span className="mx-2">|</span>
                  <span>Media: {q.mediaUpload}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 italic">No checklist questions for this task.</p>
      )}
    </div>
  );
  
  const ViewTaskModal = ({ task, onClose }: { task: ITaskViewModel | null, onClose: () => void }) => {
    if (!task) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl transform transition-all">
          <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Task Details</h2>
              <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600"><CloseIcon /></button>
          </div>
          <div className="mt-6 space-y-4 text-gray-700">
            <div className="grid grid-cols-2 gap-4">
              <p><strong>Task:</strong><br />{task.taskName}</p>
              <p><strong>Assigned To:</strong><br />{task.isGroupMaster ? `(Group) ${task.position}` : task.assignedTo?.name || 'N/A'}</p>
              <p><strong>Status:</strong><br /><span className="px-2 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">{task.status}</span></p>
              <p><strong>Due Date:</strong><br />{new Date(task.dueDate).toLocaleDateString()}</p>
            </div>
          </div>
          <ChecklistDisplay questions={task.checklistQuestions || []} />
        </div>
      </div>
    );
  };
  
  const EditTaskModal = ({ task, onClose, onSave }: { task: ITaskViewModel | null, onClose: () => void, onSave: (updatedData: any) => void }) => {
    const [taskName, setTaskName] = useState(task?.taskName || '');
    const [dueDate, setDueDate] = useState(task ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    const [checklist, setChecklist] = useState<IChecklistQuestion[]>(task?.checklistQuestions || []);
  
    if (!task) return null;
  
    const handleQuestionChange = (index: number, field: keyof IChecklistQuestion, value: string) => {
      const newChecklist = [...checklist];
      newChecklist[index] = { ...newChecklist[index], [field]: value as any };
      setChecklist(newChecklist);
    };
    const handleAddQuestion = () => setChecklist([...checklist, { questionText: '', responseType: 'Yes/No', mediaUpload: 'None' }]);
    const handleRemoveQuestion = (index: number) => setChecklist(checklist.filter((_, i) => i !== index));
    
    const handleSave = () => {
      const finalChecklist = checklist.filter(q => q.questionText.trim() !== '');
      onSave({ taskName, dueDate, checklistQuestions: finalChecklist });
    };
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-3xl transform transition-all">
          <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Edit Task</h2>
              <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600"><CloseIcon /></button>
          </div>
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-4 mt-6">
            <div><label htmlFor="editTaskName" className="block text-sm font-medium text-gray-700 mb-1">Task Name</label><input id="editTaskName" type="text" value={taskName} onChange={(e) => setTaskName(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"/></div>
            <div><label htmlFor="editDueDate" className="block text-sm font-medium text-gray-700 mb-1">Due Date</label><input id="editDueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"/></div>
            
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Checklist Questions</h3>
              <div className="space-y-4">
                {checklist.map((q, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 font-bold">{index + 1}.</span>
                      <input type="text" placeholder="Question text..." value={q.questionText} onChange={(e) => handleQuestionChange(index, 'questionText', e.target.value)} className="flex-grow border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
                      <button type="button" onClick={() => handleRemoveQuestion(index)} className="text-red-500 hover:text-red-700 font-bold text-xl p-1">&times;</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pl-8">
                      <div>
                        <label className="text-xs text-gray-500">Response Type</label>
                        <select value={q.responseType} onChange={(e) => handleQuestionChange(index, 'responseType', e.target.value)} className="w-full border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500">
                          <option value="Yes/No">Yes / No</option>
                          <option value="Yes/No + Remarks">Yes / No + Remarks</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Media Upload</label>
                        <select value={q.mediaUpload} onChange={(e) => handleQuestionChange(index, 'mediaUpload', e.target.value)} className="w-full border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500">
                          <option value="None">None</option>
                          <option value="Optional">Optional</option>
                          <option value="Required">Required</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={handleAddQuestion} className="mt-4 text-sm text-blue-600 font-semibold hover:text-blue-800 transition-colors">+ Add Question</button>
            </div>
          </div>
          <div className="flex justify-end gap-4 pt-6 mt-4 border-t border-gray-200">
              <button onClick={onClose} className="bg-gray-200 text-gray-800 px-5 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors">Cancel</button>
              <button onClick={handleSave} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm">Save Changes</button>
          </div>
        </div>
      </div>
    );
  };

// --- Main Page Component ---
const TaskPage = (): JSX.Element => {
    // All state and hooks remain the same
    const { data: session, status: sessionStatus } = useSession();
    const [allTasks, setAllTasks] = useState<ITaskViewModel[]>([]);
    const [staffList, setStaffList] = useState<IStaffMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalLoading, setIsModalLoading] = useState(false);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [viewingTask, setViewingTask] = useState<ITaskViewModel | null>(null);
    const [editingTask, setEditingTask] = useState<ITaskViewModel | null>(null);
    const [activeFilter, setActiveFilter] = useState('Todays Tasks');
    
    const initialNewTaskState = {
      assignmentType: 'Individual',
      assignee: '',
      taskName: '',
      dueDate: new Date().toISOString().split('T')[0],
      frequency: 'Daily'
    };
    const [newTask, setNewTask] = useState(initialNewTaskState);
    const [checklistQuestions, setChecklistQuestions] = useState<IChecklistQuestion[]>([{ questionText: '', responseType: 'Yes/No', mediaUpload: 'None' }]);

    // All functions (makeApiRequest, fetchAllData, handlers) remain the same
    const makeApiRequest = useCallback(async (url: string, options: RequestInit = {}) => {
        if (!session?.user?.tenantId) throw new Error('Session not found.');
        const headers = new Headers(options.headers || {});
        headers.set('x-tenant-id', session.user.tenantId);
        if (options.body) headers.set('Content-Type', 'application/json');
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
          const errText = await response.text();
          try { const errJson = JSON.parse(errText); throw new Error(errJson.error || 'API Request Failed'); } 
          catch { throw new Error(errText || 'API Request Failed'); }
        }
        return response.json();
      }, [session]);
    
      const fetchAllData = useCallback(async () => {
        if (sessionStatus === 'authenticated') {
          setIsLoading(true);
          try {
            const [tasksResponse, staffResponse] = await Promise.all([ makeApiRequest('/api/tasks'), makeApiRequest('/api/staff?action=list') ]);
            if (tasksResponse.success) setAllTasks(tasksResponse.data);
            if (staffResponse.success) setStaffList(staffResponse.data);
          } catch (error) { console.error("Failed to fetch data:", error); } 
          finally { setIsLoading(false); }
        }
      }, [sessionStatus, makeApiRequest]);
    
      useEffect(() => { fetchAllData(); }, [fetchAllData]);
      
      const tasksToDisplay = useMemo(() => {
        const displayList = allTasks.filter(task => task.isGroupMaster || !task.parentTaskId);
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const finishedStatuses = ['Completed', 'Approved'];
        switch (activeFilter) {
          case 'Todays Tasks': return displayList.filter(t => new Date(t.dueDate).setHours(0,0,0,0) === now.getTime());
          case 'Ongoing': return displayList.filter(t => !finishedStatuses.includes(t.status) && new Date(t.dueDate) >= now);
          case 'Overdue': return displayList.filter(t => !finishedStatuses.includes(t.status) && new Date(t.dueDate) < now);
          case 'Completed': return displayList.filter(t => finishedStatuses.includes(t.status));
          case 'Group Task': return displayList.filter(t => t.isGroupMaster);
          default: return displayList;
        }
      }, [allTasks, activeFilter]);
    
      const openViewModal = async (taskId: string) => { /* ... unchanged ... */ };
      const openEditModal = async (taskId: string) => { /* ... unchanged ... */ };
      const handleDeleteTask = async (taskId: string) => { /* ... unchanged ... */ };
      const handleSaveChanges = async (updatedData: any) => { /* ... unchanged ... */ };
    
      const positions = useMemo(() => [...new Set(staffList.map(s => s.position.trim()).filter(p => p))], [staffList]);
      const handleAddQuestion = () => setChecklistQuestions([...checklistQuestions, { questionText: '', responseType: 'Yes/No', mediaUpload: 'None' }]);
      const handleRemoveQuestion = (index: number) => setChecklistQuestions(checklistQuestions.filter((_, i) => i !== index));
      const handleQuestionChange = (index: number, field: keyof IChecklistQuestion, value: string) => {
        const newQuestions = [...checklistQuestions];
        newQuestions[index] = { ...newQuestions[index], [field]: value as any };
        setChecklistQuestions(newQuestions);
      };
      
      const closeCreateModal = () => {
        setCreateModalOpen(false);
        setNewTask(initialNewTaskState);
        setChecklistQuestions([{ questionText: '', responseType: 'Yes/No', mediaUpload: 'None' }]);
      };
    
      const handleCreateTask = async (e: FormEvent) => {
        e.preventDefault();
        if (!session?.user?.id || !newTask.assignee) return alert("Please select who to assign the task to.");
        const finalChecklist = checklistQuestions.filter(q => q.questionText.trim() !== '');
        try {
          const taskData = { ...newTask, createdBy: session.user.id, checklistQuestions: finalChecklist };
          await makeApiRequest('/api/tasks', { method: 'POST', body: JSON.stringify(taskData) });
          alert('Task created successfully!');
          fetchAllData();
          closeCreateModal();
        } catch (error: any) { alert(`Failed to create task: ${error.message}`); }
      };
    
      const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setNewTask(prev => ({ ...prev, [e.target.name]: e.target.value }));
      const handleAssignmentTypeChange = (type: 'Individual' | 'Position') => setNewTask(prev => ({ ...prev, assignmentType: type, assignee: '' }));
      const handleFrequencyChange = (frequency: 'Daily' | 'Weekly' | 'Monthly') => setNewTask(prev => ({ ...prev, frequency }));

    if (sessionStatus === 'loading') return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
                    <p className="mt-1 text-sm text-gray-500">Manage, create, and track all tasks.</p>
                </div>
                <button onClick={() => setCreateModalOpen(true)} className="mt-4 sm:mt-0 bg-blue-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:bg-blue-700 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">+ Create Task</button>
            </header>

            <div className="mb-6">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6">
                        {['Todays Tasks', 'Ongoing', 'Overdue', 'Completed', 'Group Task'].map(filter => (
                            <button key={filter} onClick={() => setActiveFilter(filter)} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeFilter === filter ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>{filter}</button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* ✅ FIX: The task list rendering logic is now restored. */}
            <div className="bg-white shadow-lg rounded-xl">
                <div className="divide-y divide-gray-200">
                    {isLoading ? ( <div className="text-center py-10 text-gray-500">Loading tasks...</div> )
                    : tasksToDisplay.length === 0 ? ( <div className="text-center py-10 text-gray-500 italic">No tasks found for this filter.</div> )
                    : ( tasksToDisplay.map((task: ITaskViewModel) => (
                        <div key={task._id} className="grid grid-cols-1 md:grid-cols-12 items-center p-4 hover:bg-gray-50 transition-colors">
                            <div className="md:col-span-3 mb-2 md:mb-0">
                                <p className="font-semibold text-gray-800">{task.taskName}</p>
                                <p className="text-sm text-gray-500">{task.position}</p>
                            </div>
                            <div className="md:col-span-3 text-sm text-gray-600 mb-2 md:mb-0">
                                {task.isGroupMaster ? `(Group) ${task.position}` : task.assignedTo?.name || 'N/A'}
                            </div>
                            <div className="md:col-span-2 text-sm mb-2 md:mb-0">
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                    task.status === 'Completed' || task.status === 'Approved' ? 'bg-green-100 text-green-800' : 
                                    task.status === 'Overdue' || task.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                    task.status === 'Awaiting Review' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-blue-100 text-blue-800'
                                }`}>{task.status}</span>
                            </div>
                            <div className="md:col-span-2 text-sm text-gray-600 mb-4 md:mb-0">{new Date(task.dueDate).toLocaleDateString()}</div>
                            <div className="md:col-span-2 flex items-center justify-start md:justify-end gap-3">
                                <button onClick={() => openViewModal(task._id)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="View Details"><ViewIcon /></button>
                                <button onClick={() => openEditModal(task._id)} className="p-2 text-gray-400 hover:text-green-600 transition-colors" title="Edit Task"><EditIcon /></button>
                                <button onClick={() => handleDeleteTask(task._id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors" title="Delete Task"><DeleteIcon /></button>
                            </div>
                        </div>
                    )))}
                </div>
            </div>

            {isModalLoading && <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-[60]"><div className="bg-white text-gray-700 font-semibold px-6 py-3 rounded-lg shadow-lg">Loading Details...</div></div>}
            
            {/* The fully corrected Create Task Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl transform transition-all">
                        <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                            <h2 className="text-2xl font-bold text-gray-800">Create New Task</h2>
                            <button onClick={closeCreateModal} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600"><CloseIcon /></button>
                        </div>
                        <form onSubmit={handleCreateTask} className="space-y-6 max-h-[75vh] overflow-y-auto pr-4 mt-6">
                            
                            <div>
                                <label htmlFor="taskName" className="block text-sm font-medium text-gray-700 mb-1">Task Name</label>
                                <input id="taskName" type="text" name="taskName" value={newTask.taskName} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required />
                            </div>

                            <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                            <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
                                <button type="button" onClick={() => handleAssignmentTypeChange('Individual')} className={`w-full py-1.5 rounded-md text-sm font-semibold transition-colors ${newTask.assignmentType === 'Individual' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}>Individual</button>
                                <button type="button" onClick={() => handleAssignmentTypeChange('Position')} className={`w-full py-1.5 rounded-md text-sm font-semibold transition-colors ${newTask.assignmentType === 'Position' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}>Position</button>
                            </div>
                            </div>

                            <div>
                                {newTask.assignmentType === 'Individual' 
                                ? (<select name="assignee" value={newTask.assignee} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required><option value="" disabled>Select staff...</option>{staffList.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select>) 
                                : (<select name="assignee" value={newTask.assignee} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required><option value="" disabled>Select position...</option>{positions.map(p => <option key={p} value={p}>{p}</option>)}</select>)}
                            </div>
                            
                            <div>
                            <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                            <input id="dueDate" type="date" name="dueDate" value={newTask.dueDate} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required />
                            </div>

                            <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Checklist Frequency</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <button type="button" onClick={() => handleFrequencyChange('Daily')} className={`p-4 border rounded-lg text-left transition-all ${newTask.frequency === 'Daily' ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500' : 'bg-white hover:border-gray-400'}`}>
                                    <DailyIcon />
                                    <h4 className="font-semibold mt-2">Daily</h4>
                                    <p className="text-xs text-gray-500">Tasks for every day.</p>
                                </button>
                                <button type="button" onClick={() => handleFrequencyChange('Weekly')} className={`p-4 border rounded-lg text-left transition-all ${newTask.frequency === 'Weekly' ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500' : 'bg-white hover:border-gray-400'}`}>
                                    <WeeklyIcon />
                                    <h4 className="font-semibold mt-2">Weekly</h4>
                                    <p className="text-xs text-gray-500">Once-a-week tasks.</p>
                                </button>
                                <button type="button" onClick={() => handleFrequencyChange('Monthly')} className={`p-4 border rounded-lg text-left transition-all ${newTask.frequency === 'Monthly' ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500' : 'bg-white hover:border-gray-400'}`}>
                                    <MonthlyIcon />
                                    <h4 className="font-semibold mt-2">Monthly</h4>
                                    <p className="text-xs text-gray-500">Once-a-month tasks.</p>
                                </button>
                            </div>
                            </div>
                            
                            <div className="pt-4 border-t border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-700 mb-3">Checklist Questions</h3>
                                <div className="space-y-4">
                                    {checklistQuestions.map((q, index) => (
                                    <div key={index} className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="block text-sm font-medium text-gray-700">Question Text</label>
                                            {index > 0 && <button type="button" onClick={() => handleRemoveQuestion(index)} className="text-red-500 hover:text-red-700 font-bold text-xl leading-none p-1">&times;</button>}
                                        </div>
                                        <textarea 
                                            placeholder="e.g., Arrived 5 mins early and set up front desk..." 
                                            value={q.questionText} 
                                            onChange={(e) => handleQuestionChange(index, 'questionText', e.target.value)} 
                                            className="w-full border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" 
                                            rows={2}
                                        />
                                        <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Response Type</label>
                                            <select value={q.responseType} onChange={(e) => handleQuestionChange(index, 'responseType', e.target.value)} className="w-full border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500">
                                            <option value="Yes/No">Yes / No</option>
                                            <option value="Yes/No + Remarks">Yes / No + Remarks</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Media Upload</label>
                                            <select value={q.mediaUpload} onChange={(e) => handleQuestionChange(index, 'mediaUpload', e.target.value)} className="w-full border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500">
                                            <option value="None">None</option>
                                            <option value="Optional">Optional</option>
                                            <option value="Required">Required</option>
                                            </select>
                                        </div>
                                        </div>
                                    </div>
                                    ))}
                                </div>
                                <button type="button" onClick={handleAddQuestion} className="mt-4 text-sm text-blue-600 font-semibold hover:text-blue-800 transition-colors">+ Add Question</button>
                            </div>

                            <div className="flex justify-end gap-4 pt-6 mt-4 border-t border-gray-200">
                                <button type="button" onClick={closeCreateModal} className="bg-gray-200 text-gray-800 px-5 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors">Cancel</button>
                                <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm">Create Task</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {viewingTask && <ViewTaskModal task={viewingTask} onClose={() => setViewingTask(null)} />}
            {editingTask && <EditTaskModal task={editingTask} onClose={() => setEditingTask(null)} onSave={handleSaveChanges} />}
        </div>
    );
};

export default TaskPage;