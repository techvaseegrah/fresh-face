'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { Loader2, Search, FileDown, FileText, FileSpreadsheet } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { hasPermission, PERMISSIONS } from '../../../../lib/permissions'; // Path to your permissions file

// --- Interfaces (Based on your existing Task model) ---
interface ITaskLibraryItem {
  _id: string;
  taskName: string;
  position: string;
  isGroupMaster: boolean;
  assignedTo?: { name: string };
  status: string; // Added status for filtering
  dueDate: string; // Added dueDate for filtering
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'None';
  checklistQuestions?: any[];
  createdAt: string;
}

// --- Main Report Page Component ---
const TaskLibraryReportPage = () => {
    const { data: session, status: sessionStatus } = useSession();
    const userPermissions = session?.user?.role?.permissions || [];

    const [tasks, setTasks] = useState<ITaskLibraryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('Todays Tasks');

    const fetchTaskLibrary = useCallback(async () => {
        if (sessionStatus !== 'authenticated') return;
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/tasks', {
                headers: { 'x-tenant-id': session!.user.tenantId! }
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to load task library.');
            }
            setTasks(result.data);
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [sessionStatus, session]);

    useEffect(() => {
        fetchTaskLibrary();
    }, [fetchTaskLibrary]);

    const filteredTasks = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const finishedStatuses = ['Completed', 'Approved'];

        let tabFilteredTasks = tasks;

        switch (activeFilter) {
            case 'Todays Tasks':
                tabFilteredTasks = tasks.filter(t => new Date(t.dueDate).setHours(0,0,0,0) === now.getTime());
                break;
            case 'Ongoing':
                tabFilteredTasks = tasks.filter(t => !finishedStatuses.includes(t.status) && new Date(t.dueDate) >= now);
                break;
            case 'Overdue':
                tabFilteredTasks = tasks.filter(t => !finishedStatuses.includes(t.status) && new Date(t.dueDate) < now);
                break;
            case 'Completed':
                tabFilteredTasks = tasks.filter(t => finishedStatuses.includes(t.status));
                break;
            case 'Group Task':
                tabFilteredTasks = tasks.filter(t => t.isGroupMaster);
                break;
            default:
                tabFilteredTasks = tasks;
                break;
        }
        
        if (!searchTerm) return tabFilteredTasks;

        return tabFilteredTasks.filter(task =>
            task.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.position.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [tasks, searchTerm, activeFilter]);

    const handleExportPDF = () => {
        if (filteredTasks.length === 0) return toast.info("No data available to export.");
        const doc = new jsPDF();
        doc.text('Task Library Report', 14, 16);
        const tableColumn = ["Task Name", "Assigned To", "Status", "Due Date", "Frequency", "Checklist Items"];
        const tableRows = filteredTasks.map(task => [
            task.taskName,
            task.isGroupMaster ? '(Group Task)' : (task.assignedTo?.name || 'N/A'),
            task.status,
            format(new Date(task.dueDate), 'dd MMM, yyyy'),
            task.frequency,
            (task.checklistQuestions?.length ?? 0).toString(),
        ]);
        autoTable(doc, { head: [tableColumn], body: tableRows, startY: 25 });
        doc.save('task_library_report.pdf');
     };
    const handleExportExcel = () => {
        if (filteredTasks.length === 0) return toast.info("No data available to export.");
        const worksheetData = filteredTasks.map(task => ({
            "Task Name": task.taskName,
            "Position": task.position,
            "Assigned To": task.isGroupMaster ? '(Group Task)' : (task.assignedTo?.name || 'N/A'),
            "Status": task.status,
            "Due Date": format(new Date(task.dueDate), 'yyyy-MM-dd'),
            "Frequency": task.frequency,
            "Checklist Items": task.checklistQuestions?.length ?? 0,
        }));
        const ws = XLSX.utils.json_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Task Library");
        XLSX.writeFile(wb, "task_library_report.xlsx");
    };
    
    if (sessionStatus === 'loading') {
      return <div className="p-8 text-center"><Loader2 className="animate-spin inline-block"/> Loading session...</div>;
    }

    return (
        <div className="p-6 sm:p-8 bg-gray-50 min-h-screen">
            <ToastContainer position="top-right" autoClose={3000} />
            
            <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Task Library Report</h1>
                    <p className="text-gray-500 mt-1">An overview of all master and template tasks in the system.</p>
                </div>
            </header>

            <div className="mb-6">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto">
                        {['Todays Tasks', 'Ongoing', 'Overdue', 'Completed', 'Group Task'].map(filter => (
                            <button 
                                key={filter} 
                                onClick={() => setActiveFilter(filter)} 
                                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeFilter === filter 
                                    ? 'border-blue-500 text-blue-600' 
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                {filter}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md border">
                <div className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search by task or position..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="pl-10 w-full pr-4 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>
                    {hasPermission(userPermissions, PERMISSIONS.REPORT_TASK_LIBRARY_MANAGE) && (
                        <div className="flex items-center gap-2">
                            <button onClick={handleExportPDF} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border rounded-md hover:bg-gray-50">
                                <FileText size={16} className="text-red-500"/> PDF
                            </button>
                            <button onClick={handleExportExcel} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border rounded-md hover:bg-gray-50">
                                <FileSpreadsheet size={16} className="text-green-600"/> Excel
                            </button>
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    {isLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin inline-block"/> Loading tasks...</div> :
                    error ? <div className="p-10 text-center text-red-600 bg-red-50 rounded-b-lg">{error}</div> :
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 uppercase">
                            <tr>
                                <th className="p-4 font-semibold">Task Name</th>
                                <th className="p-4 font-semibold">Assigned To</th>
                                <th className="p-4 font-semibold">Status</th>
                                <th className="p-4 font-semibold">Due Date</th>
                                <th className="p-4 font-semibold">Frequency</th>
                                <th className="p-4 font-semibold text-center">Checklist Items</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredTasks.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-10 text-center text-gray-500">
                                        No tasks found for this filter.
                                    </td>
                                </tr>
                            ) : (
                                filteredTasks.map((task) => (
                                    <tr key={task._id} className="hover:bg-gray-50">
                                        <td className="p-4 font-medium text-gray-800">
                                            <div>{task.taskName}</div>
                                            <div className="text-xs text-gray-500">{task.position}</div>
                                        </td>
                                        <td className="p-4 text-gray-600">
                                            {task.isGroupMaster ? (
                                                <span className="font-semibold text-indigo-700">{`(Group Task)`}</span>
                                            ) : (
                                                task.assignedTo?.name || 'N/A'
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                                task.status === 'Completed' || task.status === 'Approved' ? 'bg-green-100 text-green-800' : 
                                                task.status === 'Overdue' || task.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                                task.status === 'Awaiting Review' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-blue-100 text-blue-800'
                                            }`}>{task.status}</span>
                                        </td>
                                        <td className="p-4 text-gray-600">{format(new Date(task.dueDate), 'dd MMM, yyyy')}</td>
                                        <td className="p-4 text-gray-600">{task.frequency}</td>
                                        <td className="p-4 text-center font-medium text-gray-700">
                                            {task.checklistQuestions?.length ?? 0}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    }
                </div>
            </div>
        </div>
    );
};

export default TaskLibraryReportPage;