// File: app/reports/eb-report/page.tsx

'use client';

import { useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import ReportDownloadModal from '@/components/ReportDownloadModal';
import { toast } from 'react-toastify';

// ======================= MODIFICATION #1 =======================
// Import useSession to get access to the current user's session data,
// which includes the all-important tenantId.
import { useSession } from 'next-auth/react';
// ===============================================================

export default function EbReportPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // ======================= MODIFICATION #2 =======================
  // Call the useSession hook at the top level of your component.
  const { data: session } = useSession();
  // ===============================================================

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  const handleDownload = async (params: {
    startDate: Date;
    endDate: Date;
    format: 'pdf' | 'excel';
  }) => {
    setIsDownloading(true);

    // ======================= MODIFICATION #3 =======================
    // Get the tenantId from the session. The `?.` safely handles cases
    // where the session might still be loading.
    const tenantId = session?.user?.tenantId;

    // Add a critical safety check. If for any reason we don't have a
    // tenantId, we stop immediately and inform the user.
    if (!tenantId) {
      toast.error('Could not identify user session. Please try logging in again.');
      console.error('Download failed: tenantId is missing from the session.');
      setIsDownloading(false);
      return;
    }
    // ===============================================================

    try {
      const apiUrl = '/api/eb/report/eb-report';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // ======================= MODIFICATION #4 (The Core Fix) =======================
          // Add the tenantId to the request headers. Your backend's
          // getTenantIdOrBail function is looking for this.
          'X-Tenant-ID': tenantId,
          // ==============================================================================
        },
        body: JSON.stringify({
          startDate: params.startDate.toISOString(),
          endDate: params.endDate.toISOString(),
          format: params.format,
        }),
      });

      // Your existing error handling block is good, no changes needed here.
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to generate report.');
        } else {
          console.error("Received non-JSON error response from server. Status:", response.status);
          throw new Error('Authentication may have failed or a server error occurred.');
        }
      }

      // --- Successful download logic remains the same ---
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = params.format === 'excel' ? 'EB_Report.xlsx' : 'EB_Report.pdf';

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch.length > 1) {
          filename = filenameMatch[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      handleCloseModal();
      toast.success('Report downloaded successfully!');

    } catch (error: any) {
      console.error('Download error:', error);
      toast.error(error.message || 'An unexpected error occurred.');
    } finally {
      setIsDownloading(false);
    }
  };

  // --- The rest of your component remains the same ---
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8 pb-4 border-b">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">EB Readings</h1>
          <p className="text-sm text-gray-500">View, update, and manage electricity consumption.</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
          Download Report
        </button>
      </div>
      <div className="p-10 text-center bg-gray-50 border-2 border-dashed rounded-lg">
        <p className="text-gray-500">
          Your EB Report data, charts, and tables will be displayed here.
        </p>
      </div>
      <ReportDownloadModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onDownload={handleDownload}
        isDownloading={isDownloading}
      />
    </div>
  );
}