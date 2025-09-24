// /src/app/(main)/(Staff)/my-reported-issues/page.tsx

'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { format, formatDistanceToNow } from 'date-fns';
import { Loader2, AlertTriangle, Inbox, CheckCircle, Clock, XCircle, UserCheck, ShieldCheck, X } from 'lucide-react';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

// --- TYPE DEFINITIONS ---
interface ReportedIssue {
    _id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    createdAt: string;
    fileUrl?: string;
    submission: {
        _id: string;
        status: 'pending_review' | 'approved' | 'rejected';
        submissionDate: string;
        reviewedAt?: string;
        // ✅ START OF UI FIX: Updated interface to match corrected API response
        staff?: {
            _id: string;
            name: string;
            roleId?: {
                displayName: string;
            };
        };
        // ✅ END OF UI FIX
        reviewedBy?: {
            _id: string;
            name: string;
        };
    } | null;
}

// --- FETCHER FUNCTION ---
const fetcher = async (url: string, tenantId: string) => {
    const headers = new Headers({ 'x-tenant-id': tenantId });
    const res = await fetch(url, { headers });
    if (!res.ok) {
        const errorInfo = await res.json();
        throw new Error(errorInfo.message || 'Failed to load reported issues.');
    }
    return res.json();
};


// --- ImageViewerModal Component ---
const ImageViewerModal = ({ src, onClose }: { src: string; onClose: () => void }) => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[60] p-4" onClick={onClose} >
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


// --- CHILD COMPONENT FOR STATUS DISPLAY ---
const StatusDisplay = ({ issue }: { issue: ReportedIssue }) => {
    const { submission } = issue;

    if (!submission) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-4 bg-gray-100 rounded-lg h-full">
                <Clock className="h-8 w-8 text-gray-500 mb-2" />
                <p className="font-semibold text-gray-800">Awaiting Action</p>
                <p className="text-xs text-gray-500">The issue is in the queue to be addressed.</p>
            </div>
        );
    }
    
    const solver = submission.staff;
    const reviewer = submission.reviewedBy;

    const statusInfo = {
        pending_review: { icon: Clock, text: "Pending Review", textColor: "text-yellow-800", bgColor: "bg-yellow-100" },
        approved: { icon: CheckCircle, text: "Approved", textColor: "text-green-800", bgColor: "bg-green-100" },
        rejected: { icon: XCircle, text: "Rejected", textColor: "text-red-800", bgColor: "bg-red-100" },
    };
    
    const currentStatus = statusInfo[submission.status];
    const Icon = currentStatus.icon;

    return (
        <div className={`p-4 rounded-lg h-full ${currentStatus.bgColor}`}>
            <div className="flex items-center gap-2 mb-3">
                <Icon className={`h-6 w-6 ${currentStatus.textColor}`} />
                <p className={`text-lg font-bold ${currentStatus.textColor}`}>{currentStatus.text}</p>
            </div>
            
            <div className="space-y-3 text-sm text-left">
                <div>
                    <div className="flex items-start gap-3">
                        <UserCheck className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold">SOLVED BY</p>
                            {/* ✅ START OF UI FIX: Display name and role from the corrected data structure */}
                            <p className="font-semibold text-gray-800">{solver ? solver.name : 'N/A'}</p>
                            {solver?.roleId?.displayName && <p className="text-xs text-gray-500 -mt-1">{solver.roleId.displayName}</p>}
                            {/* ✅ END OF UI FIX */}
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-8">
                       {formatDistanceToNow(new Date(submission.submissionDate), { addSuffix: true })}
                    </p>
                </div>

                { (submission.status === 'approved' || submission.status === 'rejected') &&
                    <div>
                        <div className="flex items-start gap-3">
                            <ShieldCheck className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-semibold">REVIEWED BY</p>
                                <p className="font-semibold text-gray-800">{reviewer ? reviewer.name : 'Pending'}</p>
                            </div>
                        </div>
                         {submission.reviewedAt &&
                             <p className="text-xs text-gray-500 mt-1 ml-8">
                                {formatDistanceToNow(new Date(submission.reviewedAt), { addSuffix: true })}
                             </p>
                         }
                    </div>
                }
            </div>
        </div>
    );
};

// --- MAIN PAGE COMPONENT ---
export default function MyReportedIssuesPage() {
    const { data: session, status: sessionStatus } = useSession();
    const [viewerSrc, setViewerSrc] = useState<string | null>(null);
    const tenantId = session?.user?.tenantId;

    const { data: issues, error } = useSWR<ReportedIssue[]>(
        tenantId ? ['/api/staff/my-reported-issues', tenantId] : null,
        ([url, id]: [string, string]) => fetcher(url, id)
    );

    const handleViewAttachment = (e: React.MouseEvent, fileUrl: string) => {
        const isImage = fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i);
        if (isImage) {
            e.preventDefault();
            setViewerSrc(fileUrl);
        }
    };

    if (sessionStatus === 'loading' || (!issues && !error)) {
        return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-gray-500" size={40}/></div>;
    }
    
    return (
        <>
            <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-5xl mx-auto">
                    <header className="mb-8">
                        <h1 className="text-4xl font-bold text-gray-800 tracking-tight">My Reported Issues</h1>
                        <p className="text-gray-500 mt-2 text-lg">
                            Track the status and resolution of the issues you have submitted.
                        </p>
                    </header>

                    {error && (
                        <div className="text-red-600 p-4 bg-red-50 rounded-lg border border-red-200 flex items-center gap-3">
                            <AlertTriangle className="h-6 w-6"/>
                            <div>
                                <h3 className="font-bold">Error Loading Issues</h3>
                                <p>{(error as Error).message}</p>
                            </div>
                        </div>
                    )}

                    {issues && issues.length === 0 && (
                        <div className="text-center py-20 px-6 bg-white rounded-lg shadow-sm border">
                            <Inbox className="h-16 w-16 text-gray-400 mx-auto" strokeWidth={1} />
                            <h3 className="mt-4 text-xl font-semibold text-gray-900">No issues reported yet</h3>
                            <p className="mt-2 text-md text-gray-500">When you report a new issue using the 'Report an Issue' page, you can track it here.</p>
                        </div>
                    )}
                    
                    <div className="space-y-6">
                        {issues && issues.map((issue: ReportedIssue) => (
                            <motion.div 
                                key={issue._id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 grid grid-cols-1 md:grid-cols-3 gap-0 overflow-hidden"
                            >
                                <div className="p-6 md:col-span-2 border-b md:border-b-0 md:border-r border-gray-200">
                                    <div className="flex justify-between items-start mb-3">
                                        <h2 className="text-xl font-bold text-gray-800 pr-4">{issue.title}</h2>
                                        <span className={`capitalize px-2.5 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${
                                            issue.priority === 'high' ? 'bg-red-100 text-red-800' :
                                            issue.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-green-100 text-green-800'
                                        }`}>{issue.priority}</span>
                                    </div>

                                    <p className="text-gray-600 text-sm mb-4">{issue.description}</p>
                                    
                                    <div className="text-xs text-gray-500">
                                        Reported on {format(new Date(issue.createdAt), 'MMMM d, yyyy, h:mm a')}
                                    </div>
                                    
                                    {issue.fileUrl && (
                                        <a 
                                            href={issue.fileUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
                                            onClick={(e) => handleViewAttachment(e, issue.fileUrl!)}
                                        >
                                            View Attached File
                                        </a>
                                    )}
                                </div>
                            
                                <div className="md:col-span-1 p-2">
                                    <StatusDisplay issue={issue} />
                                 </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>

            <AnimatePresence>
                {viewerSrc && <ImageViewerModal src={viewerSrc} onClose={() => setViewerSrc(null)} />}
            </AnimatePresence>
        </>
    );
}