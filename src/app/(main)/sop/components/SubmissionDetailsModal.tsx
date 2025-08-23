'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { X, Check, PlayCircle, XCircle } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';
import ImageZoomModal from '@/components/ImageZoomModal';
import VideoPlayerModal from '@/components/VideoPlayerModal';

export default function SubmissionDetailsModal({
  details,
  onClose,
  onAcknowledged
}: {
  details: any;
  onClose: () => void;
  // This function is now more generic, it signals a successful review action
  onAcknowledged: (submissionId: string, newStatus: 'approved' | 'rejected') => void;
}) {
  const { data: session } = useSession();
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [zoomedVideoUrl, setZoomedVideoUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State to manage the rejection UI for each submission individually
  const [rejectionState, setRejectionState] = useState<{ [key: string]: { showInput: boolean; notes: string } }>({});

  if (!details) return null;

  // Handles the "Approve" action
  const handleApprove = async (submissionId: string) => {
    if (!session) return;
    setIsProcessing(true);
    setError(null);

    try {
        const headers = new Headers();
        headers.append('x-tenant-id', session.user.tenantId);
        const res = await fetch(`/api/sop/submissions/${submissionId}/acknowledge`, {
            method: 'PUT',
            headers: headers
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Failed to approve the submission.");
        }
        onAcknowledged(submissionId, 'approved'); // Signal success with the new status
    } catch (err: any) {
        console.error(err);
        setError(err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // Handles the "Reject" action
  const handleReject = async (submissionId: string) => {
    const notes = rejectionState[submissionId]?.notes || '';
    if (!notes.trim()) {
        alert("Please provide a reason for rejection.");
        return;
    }

    setIsProcessing(true);
    setError(null);
    try {
        const headers = new Headers();
        headers.append('x-tenant-id', session.user.tenantId);
        headers.append('Content-Type', 'application/json');

        const res = await fetch(`/api/sop/submissions/${submissionId}/reject`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({ notes }),
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Failed to reject the submission.");
        }
        onAcknowledged(submissionId, 'rejected'); // Signal success with the new status
    } catch (err: any) {
        console.error(err);
        setError(err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // Helper functions to manage the dynamic rejection input UI
  const toggleRejectionInput = (submissionId: string) => {
    setRejectionState(prev => ({
        ...prev,
        [submissionId]: {
            showInput: !prev[submissionId]?.showInput,
            notes: '',
        }
    }));
  };

  const handleNotesChange = (submissionId: string, notes: string) => {
    setRejectionState(prev => ({
        ...prev,
        [submissionId]: { ...prev[submissionId], notes }
    }));
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center p-4 border-b">
            <div>
              <h2 className="text-xl font-bold text-gray-800">{details.staffName}'s Submissions</h2>
              <p className="text-sm text-gray-500">{format(new Date(details.date), 'eeee, MMMM d, yyyy')}</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100">
              <X size={24} />
            </button>
          </div>
          
          <div className="overflow-y-auto p-6 space-y-6">
            {details.submissions.map((submission: any) => (
                <div key={submission._id}>
                  <div className="flex justify-between items-start mb-3 gap-4">
                    <h3 className="text-lg font-semibold text-gray-700">{submission.checklistTitle}</h3>
                    {/* --- UPDATED ---: Show review actions only if status is 'pending_review' */}
                    {submission.status === 'pending_review' && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => handleApprove(submission._id)} disabled={isProcessing} className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-lg hover:bg-green-200 disabled:opacity-50">
                                <Check size={16} /> Approve
                            </button>
                            <button onClick={() => toggleRejectionInput(submission._id)} disabled={isProcessing} className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded-lg hover:bg-red-200 disabled:opacity-50">
                                <XCircle size={16} /> Reject
                            </button>
                        </div>
                    )}
                  </div>
                  
                  {/* --- NEW ---: Rejection notes input section, shown dynamically */}
                  {rejectionState[submission._id]?.showInput && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
                        <label className="block text-sm font-medium text-red-800 mb-1">Reason for Rejection</label>
                        <textarea
                            value={rejectionState[submission._id].notes}
                            onChange={(e) => handleNotesChange(submission._id, e.target.value)}
                            className="w-full border-red-300 rounded-md shadow-sm text-sm focus:ring-red-500 focus:border-red-500"
                            rows={2}
                            placeholder="e.g., Video is blurry, please re-upload."
                        />
                        <div className="flex justify-end mt-2">
                           <button onClick={() => handleReject(submission._id)} disabled={isProcessing} className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-md hover:bg-red-700 disabled:opacity-50">
                             Confirm Rejection
                           </button>
                        </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {submission.responses?.map((response: any, index: number) => (
                      <div key={index} className="flex items-start gap-4 p-3 border rounded-lg bg-gray-50">
                        <p className="flex-1 font-medium text-gray-900">{response.text}</p>
                        
                        {/* --- CORRECTED ---: Use 'mediaUrl' instead of 'imageUrl' */}
                        {response.mediaUrl ? (
                          (() => {
                            const isVideo = /\.(mp4|webm|mov)$/i.test(response.mediaUrl);
                            if (isVideo) {
                              return (
                                <button type="button" className="flex-shrink-0 group relative" onClick={() => setZoomedVideoUrl(response.mediaUrl)}>
                                  <div className="relative h-24 w-24 rounded-md overflow-hidden border bg-black">
                                    <video src={response.mediaUrl} className="object-cover h-full w-full" muted playsInline />
                                    <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <PlayCircle className="text-white text-opacity-80 h-8 w-8" />
                                    </div>
                                  </div>
                                </button>
                              );
                            } else {
                              return (
                                <button type="button" className="flex-shrink-0 cursor-zoom-in" onClick={() => setZoomedImageUrl(response.mediaUrl)}>
                                  <div className="relative h-24 w-24 rounded-md overflow-hidden border hover:opacity-80 transition-opacity">
                                    <Image src={response.mediaUrl} alt={`Verification for ${response.text}`} layout="fill" className="object-cover" />
                                  </div>
                                </button>
                              );
                            }
                          })()
                        ) : (
                          <div className="h-24 w-24 flex items-center justify-center bg-gray-200 rounded-md text-xs text-gray-500 flex-shrink-0">
                            No Media
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
                </div>
              ))}
          </div>
        </div>
      </div>

      {zoomedImageUrl && <ImageZoomModal src={zoomedImageUrl} onClose={() => setZoomedImageUrl(null)} />}
      {zoomedVideoUrl && <VideoPlayerModal src={zoomedVideoUrl} onClose={() => setZoomedVideoUrl(null)} />}
    </>
  );
}