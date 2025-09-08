// src/app/(main)/issues/page.tsx

'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { PlusCircle, Loader2, AlertTriangle, Eye, Edit, Trash2, X, ListChecks, FileText, ArrowUp, ArrowRight, ArrowDown, Inbox } from 'lucide-react';
import IssueFormModal, { IssueProp } from './components/IssueFormModal';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

// --- TYPE DEFINITION ---
interface DisplayIssue {
    _id: string;
    dataType: 'submission' | 'template';
    issueId: string;
    title: string;
    status: 'pending_review' | 'approved' | 'rejected' | 'pending_assignment';
    submissionDate: string | null;
    createdDate: string; 
    assignee: {
        name: string | null;
        roles: string[];
    };
    reviewer: {
        name: string;
        role: string;
    } | null;
    priority: 'high' | 'medium' | 'low' | 'none';
    submittedBy: {
        name: string;
        role: string;
    } | null;
}


const ImageViewerModal = ({ src, onClose }: { src: string; onClose: () => void }) => {
    return (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[60] p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-2xl p-2"
                onClick={(e) => e.stopPropagation()} 
            >
                <Image 
                    src={src} 
                    alt="Attachment Preview" 
                    width={1200} 
                    height={800} 
                    className="object-contain max-w-full max-h-[85vh] rounded" 
                />
                <button 
                    onClick={onClose} 
                    className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full p-1.5 shadow-lg hover:bg-gray-200 transition-colors"
                >
                    <X size={20} />
                </button>
            </motion.div>
        </div>
    );
};


// --- RE-STYLED & ENHANCED COMPONENTS ---

const PriorityDisplay = ({ priority }: { priority: 'high' | 'medium' | 'low' | 'none' }) => {
    const iconMap = {
        high: <ArrowUp size={16} />,
        medium: <ArrowRight size={16} />,
        low: <ArrowDown size={16} />,
        none: null
    };
    const colorMap = {
        high: "bg-red-100 text-red-800",
        medium: "bg-yellow-100 text-yellow-800",
        low: "bg-blue-100 text-blue-800",
        none: "bg-gray-100 text-gray-700"
    };
    const textMap = { high: 'High', medium: 'Medium', low: 'Low', none: 'None' };

    return (
        <span className={`px-3 py-1 text-sm font-semibold rounded-full inline-flex items-center gap-2 ${colorMap[priority]}`}>
            {iconMap[priority]}
            {textMap[priority]}
        </span>
    );
};

const ViewIssueModal = ({ issue, onClose }: { issue: IssueProp, onClose: () => void }) => {
    const [viewerSrc, setViewerSrc] = useState<string | null>(null);

    if (!issue) return null;

    const isImage = issue.fileUrl?.match(/\.(jpeg|jpg|gif|png|webp)$/i);

    const handleViewAttachment = (e: React.MouseEvent) => {
        if (isImage) {
            e.preventDefault();
            setViewerSrc(issue.fileUrl!);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-start md:items-center z-50 p-2 sm:p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-xl shadow-2xl w-full max-w-lg md:max-w-xl flex flex-col max-h-[95vh]"
                >
                    <div className="flex justify-between items-center p-4 sm:p-6 border-b">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-full"><ListChecks className="text-blue-600 h-6 w-6" /></div>
                            <h2 className="text-lg md:text-xl font-bold text-gray-900">Issue Details</h2>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition-colors"><X size={20} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Title</h3>
                            <p className="text-2xl font-bold text-gray-800">{issue.title}</p>
                        </div>
                        {issue.description && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</h3>
                                <p className="text-gray-600 whitespace-pre-wrap prose prose-sm max-w-none">{issue.description}</p>
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Priority</h3>
                                <PriorityDisplay priority={issue.priority} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Assigned Roles</h3>
                                <div className="flex flex-wrap gap-2">
                                    {issue.roles.map((role) => (
                                        <span key={role._id} className="px-3 py-1 text-sm bg-gray-200 text-gray-800 rounded-full">{role.displayName}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {issue.fileUrl && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Attachment</h3>
                                <div className="mt-2 p-3 border rounded-lg bg-gray-50">
                                    <a href={issue.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group" onClick={handleViewAttachment}>
                                        {isImage ? (
                                            <Image src={issue.fileUrl} alt="Attachment Preview" width={80} height={80} className="object-cover rounded-md h-20 w-20 flex-shrink-0" />
                                        ) : (
                                            <div className="h-20 w-20 flex items-center justify-center bg-gray-200 rounded-md flex-shrink-0">
                                                <FileText className="text-gray-500 h-8 w-8" />
                                            </div>
                                        )}
                                        <div><p className="font-semibold text-blue-600 group-hover:underline">View Attachment</p></div>
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-gray-50/50 border-t flex justify-end">
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors">Close</button>
                    </div>
                </motion.div>
            </div>
            <AnimatePresence>
                {viewerSrc && <ImageViewerModal src={viewerSrc} onClose={() => setViewerSrc(null)} />}
            </AnimatePresence>
        </>
    );
};

const StatusBadge = ({ status, reviewer }: { status: DisplayIssue['status'], reviewer?: DisplayIssue['reviewer'] | null }): React.JSX.Element => {
    const baseClasses = "px-2.5 py-1 text-xs font-semibold rounded-full inline-block";
    const styles = {
        approved: "bg-green-100 text-green-800",
        pending_review: "bg-yellow-100 text-yellow-800",
        rejected: "bg-red-100 text-red-800",
        pending_assignment: "bg-gray-200 text-gray-800",
    };
    const text = {
        approved: "Approved",
        pending_review: "Pending",
        rejected: "Rejected",
        pending_assignment: "Not Assigned",
    }
    
    if ((status === 'approved' || status === 'rejected') && reviewer) {
        return (
            <div className="text-center">
                <span className={`${baseClasses} ${styles[status]}`}>{text[status]}</span>
                <p className="text-xs text-gray-500 mt-1">by {reviewer.name} ({reviewer.role})</p>
            </div>
        );
    }
    
    return <span className={`${baseClasses} ${styles[status] || 'bg-gray-100 text-gray-700'}`}>{text[status] || status}</span>;
};

const UserAvatar = ({ name }: { name?: string | null }) => {
    if (!name || name === 'platform administrator') {
        return (
             <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center font-bold text-sm flex-shrink-0" title="Platform Administrator">
                P
            </div>
        );
    }
    const initial = name.charAt(0).toUpperCase();
    return (
        <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-sm flex-shrink-0" title={name}>
            {initial}
        </div>
    );
};


// --- FETCHER FUNCTION ---
const fetcherWithAuth = async ([url, tenantId]: [string, string]) => {
    if (!tenantId) throw new Error("Tenant ID not available.");
    const headers = new Headers({ 'x-tenant-id': tenantId });
    const res = await fetch(url, { headers });
    if (!res.ok) {
        const errorInfo = await res.json();
        throw new Error(errorInfo.message || 'Failed to load data.');
    }
    return res.json();
};

export default function IssueManagementPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIssue, setEditingIssue] = useState<IssueProp | null>(null);
    const [viewingIssue, setViewingIssue] = useState<IssueProp | null>(null);
    const [activeTab, setActiveTab] = useState('today');
    const { data: session, status: sessionStatus } = useSession();

    const canManage = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.ISSUE_MANAGE);
    
    const tenantId = session?.user?.tenantId;
    const apiUrl = tenantId ? `/api/issue?filter=${activeTab}` : null;
    const { data: issues, error, mutate } = useSWR<DisplayIssue[]>(
        apiUrl ? [apiUrl, tenantId] : null,
        fetcherWithAuth,
        { revalidateOnFocus: false }
    );

    const handleView = async (issue: DisplayIssue) => {
        if (!tenantId) return;
        try {
            const issueToView: IssueProp = await fetcherWithAuth([`/api/issue/${issue.issueId}`, tenantId]);
            setViewingIssue(issueToView);
        } catch (err: any) {
            toast.error(`Failed to load issue details: ${err.message}`);
        }
    };
    
    const handleEdit = async (issue: DisplayIssue) => {
        if (!tenantId) return;
        try {
            const issueToEdit: IssueProp = await fetcherWithAuth([`/api/issue/${issue.issueId}`, tenantId]);
            setEditingIssue(issueToEdit);
            setIsModalOpen(true);
        } catch (err: any) {
            toast.error(`Failed to load issue details: ${err.message}`);
        }
    };

    const handleDelete = async (issue: DisplayIssue) => {
        if (!tenantId || !confirm(`Are you sure you want to delete "${issue.title}"?`)) { return; }
        try {
            const res = await fetch(`/api/issue/${issue.issueId}`, { method: 'DELETE', headers: { 'x-tenant-id': tenantId }});
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Failed to delete issue');
            }
            toast.success(`Issue "${issue.title}" deleted.`);
            mutate(issues?.filter(i => i._id !== issue._id), false);
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleAddNew = () => { setEditingIssue(null); setIsModalOpen(true); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingIssue(null); };
    const handleCloseViewModal = () => setViewingIssue(null);
    const handleSuccess = (response: any) => { mutate(); handleCloseModal(); if (response?.warning) { toast.warn(response.warning, { autoClose: 8000 }); } else { toast.success(response?.message || "Operation successful!"); } };

    // ✅ START OF CHANGE 1: Update tab label
    const tabs = [
        { key: 'today', label: "Overall Issues" },
        { key: 'ongoing', label: "Ongoing" },
        { key: 'completed', label: "Completed" },
        { key: 'rejected', label: "Rejected" },
    ];
    // ✅ END OF CHANGE 1

    const priorityBorderColor = (priority: DisplayIssue['priority']) => {
        switch (priority) {
            case 'high': return 'border-l-red-500';
            case 'medium': return 'border-l-yellow-500';
            case 'low': return 'border-l-blue-500';
            default: return 'border-l-gray-300';
        }
    };

    if (sessionStatus === 'loading') {
        return <div className="p-10 flex justify-center items-center h-full"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            <header className="mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Issues Dashboard</h1>
                        <p className="text-gray-600 mt-1">Manage, create, and track all assigned issues.</p>
                    </div>
                    {canManage && (
                        <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleAddNew} 
                            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg shadow-sm hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <PlusCircle size={20} />
                            {/* ✅ START OF CHANGE 2: Update button text */}
                            Inform Issue
                            {/* ✅ END OF CHANGE 2 */}
                        </motion.button>
                    )}
                </div>
            </header>

            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    {tabs.map(tab => (
                        <button 
                            key={tab.key} 
                            onClick={() => setActiveTab(tab.key)} 
                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === tab.key 
                                ? 'border-blue-500 text-blue-600' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <main>
                {error && <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg flex items-center gap-3 shadow-sm"><AlertTriangle size={20}/> API Error: {error.message}</div>}
                {!issues && !error && <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>}
                
                {issues && issues.length === 0 && (
                    <div className="text-center py-16 px-6 bg-white rounded-lg shadow-sm">
                        <Inbox className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-lg font-semibold text-gray-900">No issues found</h3>
                        <p className="mt-1 text-sm text-gray-500">There are no issues to display for the "{activeTab}" filter.</p>
                    </div>
                )}
                
                {issues && issues.length > 0 && (
                     <div className="hidden md:grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)] gap-4 items-center px-4 mb-2">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Issue</div>
                        {/* ✅ START OF CHANGE 3: Update column header */}
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Solved By</div>
                        {/* ✅ END OF CHANGE 3 */}
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted By</div>
                        <div className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</div>
                        <div className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted Date</div>
                        <div className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Solved Date</div>
                        <div className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</div>
                    </div>
                )}

                <AnimatePresence>
                    <div className="space-y-4">
                        {issues && issues.map(issue => (
                            <motion.div
                                key={issue._id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.2 }}
                                className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border-l-4 ${priorityBorderColor(issue.priority)} overflow-hidden`}
                            >
                                <div className="p-4 grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)] gap-y-4 md:gap-4 items-center">
                                    <div className="col-span-12 md:col-auto">
                                        <p className="font-semibold text-gray-800 truncate">{issue.title}</p>
                                        <p className="text-sm text-gray-500">{issue.assignee?.roles?.join(', ') || 'No roles assigned'}</p>
                                    </div>
                                    <div className="col-span-6 md:col-auto flex items-center gap-2">
                                        <UserAvatar name={issue.assignee?.name} />
                                        {issue.assignee?.name ? (
                                            <div>
                                                <p className="font-medium text-sm text-gray-800 truncate">{issue.assignee.name}</p>
                                                <p className="text-xs text-gray-500 truncate">{issue.assignee.roles.join(', ')}</p>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-gray-600 truncate">N/A</span>
                                        )}
                                    </div>
                                    <div className="col-span-6 md:col-auto">
                                        {issue.submittedBy ? (
                                            <div>
                                                <p className="font-medium text-sm text-gray-800 truncate">{issue.submittedBy.name}</p>
                                                <p className="text-xs text-gray-500 truncate">{issue.submittedBy.role}</p>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-gray-500">—</span>
                                        )}
                                    </div>
                                    <div className="col-span-6 md:col-auto flex justify-start md:justify-center">
                                        <StatusBadge status={issue.status} reviewer={issue.reviewer} />
                                    </div>
                                    
                                    <div className="col-span-6 md:col-auto text-sm text-gray-600 text-left md:text-center">
                                        {issue.createdDate ? format(new Date(issue.createdDate), 'MMM d, yyyy') : '—'}
                                    </div>
                                    <div className="col-span-6 md:col-auto text-sm text-gray-600 text-left md:text-center">
                                        {issue.submissionDate ? format(new Date(issue.submissionDate), 'MMM d, yyyy') : '—'}
                                    </div>

                                    <div className="col-span-12 md:col-auto flex justify-end items-center gap-1 text-gray-400">
                                        <button onClick={() => handleView(issue)} disabled={!issue.issueId} className="p-2 rounded-md hover:bg-blue-100 hover:text-blue-600 disabled:opacity-30 transition-colors" title="View"><Eye size={18}/></button>
                                        {canManage && <>
                                            <button onClick={() => handleEdit(issue)} disabled={!issue.issueId} className="p-2 rounded-md hover:bg-green-100 hover:text-green-600 disabled:opacity-30 transition-colors" title="Edit"><Edit size={18}/></button>
                                            <button onClick={() => handleDelete(issue)} disabled={!issue.issueId} className="p-2 rounded-md hover:bg-red-100 hover:text-red-600 disabled:opacity-30 transition-colors" title="Delete"><Trash2 size={18}/></button>
                                        </>}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </AnimatePresence>
            </main>

            <AnimatePresence>
                {isModalOpen && canManage && ( <IssueFormModal issue={editingIssue || undefined} onClose={handleCloseModal} onSuccess={handleSuccess} /> )}
                {viewingIssue && ( <ViewIssueModal issue={viewingIssue} onClose={handleCloseViewModal} /> )}
            </AnimatePresence>
        </div>
    );
}