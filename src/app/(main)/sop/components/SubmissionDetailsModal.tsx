'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { X, Check } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';
import ImageZoomModal from '@/components/ImageZoomModal'; // Adjust path if your component is located elsewhere

// The component now accepts an onAcknowledged function that takes a string (the submissionId)
export default function SubmissionDetailsModal({ details, onClose, onAcknowledged }: { details: any; onClose: () => void; onAcknowledged: (submissionId: string) => void; }) {
  const { data: session } = useSession();
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!details) return null;

  // This function is called when the manager clicks the "Acknowledge" button
  const handleAcknowledge = async (submissionId: string) => {
    if (!session) return;
    setIsAcknowledging(true);
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
            throw new Error(errorData.message || "Failed to acknowledge the submission.");
        }
        
        // This is the FIX: Pass the submissionId back to the parent component.
        onAcknowledged(submissionId);

    } catch (err: any) {
        console.error(err);
        setError(err.message);
    } finally {
        setIsAcknowledging(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
        <div 
          className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
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
            {details.submissions.length > 0 ? (
              details.submissions.map((submission: any) => (
                <div key={submission._id}>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-700">{submission.checklistTitle}</h3>
                    {!submission.isReviewed && (
                        <button
                            onClick={() => handleAcknowledge(submission._id)}
                            disabled={isAcknowledging}
                            className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-lg hover:bg-green-200 disabled:opacity-50 transition-colors"
                        >
                            <Check size={16} />
                            {isAcknowledging ? 'Clearing...' : 'Acknowledge & Clear'}
                        </button>
                    )}
                  </div>
                  <div className="space-y-4">
                    {submission.responses?.map((response: any, index: number) => (
                      <div key={index} className="flex items-start gap-4 p-3 border rounded-lg bg-gray-50">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{response.text}</p>
                        </div>
                        {response.imageUrl ? (
                          <button
                            type="button"
                            className="flex-shrink-0 cursor-zoom-in"
                            onClick={() => setZoomedImageUrl(response.imageUrl)}
                          >
                            <div className="relative h-24 w-24 rounded-md overflow-hidden border hover:opacity-80 transition-opacity">
                              <Image src={response.imageUrl} alt={`Verification for ${response.text}`} layout="fill" className="object-cover" />
                            </div>
                          </button>
                        ) : (
                          <div className="h-24 w-24 flex items-center justify-center bg-gray-200 rounded-md text-xs text-gray-500">
                            No Image
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No unreviewed submissions were found for this day.</p>
            )}
          </div>
        </div>
      </div>

      {zoomedImageUrl && (
        <ImageZoomModal 
          src={zoomedImageUrl} 
          onClose={() => setZoomedImageUrl(null)} 
        />
      )}
    </>
  );
}