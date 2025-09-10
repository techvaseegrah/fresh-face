'use client';

import { useState, useEffect, Fragment } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, DocumentArrowDownIcon, ArrowUpTrayIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface IJobStatus {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';
  progress: {
    total: number;
    processed: number;
    failed: number;
  };
  reportMessage?: string;
  errorLog?: { row: number, message: string }[];
}

export default function CustomerHistoryImportModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { data: session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<IJobStatus>({
    status: 'idle',
    progress: { total: 0, processed: 0, failed: 0 },
  });

  // Reset state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => { // Delay reset to allow closing animation
        setFile(null);
        setJobId(null);
        setJobStatus({ status: 'idle', progress: { total: 0, processed: 0, failed: 0 } });
      }, 300);
    }
  }, [isOpen]);

  // Polling mechanism
  useEffect(() => {
    if (!jobId || !isOpen || jobStatus.status === 'completed' || jobStatus.status === 'failed') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/customer/history-import/status/${jobId}`, {
          headers: { 'x-tenant-id': session?.user.tenantId || '' }
        });

        if (res.ok) {
          const data = await res.json();
          // Assuming the job object is nested under a 'job' key
          const jobData = data.job;
          setJobStatus(jobData);
          if (jobData.status === 'completed' || jobData.status === 'failed') {
            clearInterval(interval);
            if(jobData.status === 'completed') {
                toast.success(jobData.reportMessage || "Import completed successfully!");
            } else {
                toast.error(jobData.reportMessage || "Import failed. Check details in the modal.");
            }
          }
        } else {
          clearInterval(interval);
          setJobStatus(prev => ({ ...prev, status: 'failed', reportMessage: 'Could not get import status.' }));
          toast.error('Could not get import status.');
        }
      } catch (error) {
        clearInterval(interval);
        setJobStatus(prev => ({ ...prev, status: 'failed', reportMessage: 'Error fetching import status.' }));
        toast.error('Error fetching import status.');
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [jobId, isOpen, session, jobStatus.status]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFile = e.target.files[0];
      if (selectedFile && (selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || selectedFile.name.endsWith('.xlsx'))) {
        setFile(selectedFile);
      } else {
        toast.error("Please select a valid Excel file (.xlsx)");
        e.target.value = ''; // Reset file input
      }
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file to import.');
      return;
    }
    if (!session?.user.tenantId) {
        toast.error('Session is invalid. Please log in again.');
        return;
    }

    setJobStatus({ status: 'uploading', progress: { total: 0, processed: 0, failed: 0 } });
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/customer/history-import/start', {
        method: 'POST',
        headers: { 'x-tenant-id': session.user.tenantId },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to start import.');

      setJobId(data.jobId);
      toast.success('Upload complete! Import has started in the background.');
    } catch (error: any) {
      setJobStatus({ status: 'failed', progress: { total: 0, processed: 0, failed: 0 }, reportMessage: error.message });
      toast.error(error.message);
    }
  };

  const isProcessing = jobStatus.status === 'uploading' || jobStatus.status === 'processing';

  const renderProgress = () => {
    const { status, progress, reportMessage, errorLog } = jobStatus;

    if (status === 'idle') {
      return (
        <div className="text-center">
            <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700">
                <ArrowUpTrayIcon className="w-5 h-5"/>
                {file ? `Selected: ${file.name}` : 'Select Excel File'}
            </label>
            <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".xlsx" />
            <p className="mt-2 text-xs text-gray-500">Only .xlsx files are accepted.</p>
        </div>
      );
    }
    
    const percentage = progress.total > 0 ? Math.round(((progress.processed + progress.failed) / progress.total) * 100) : (status === 'uploading' ? 0 : 100);
    
    return (
        <div>
            {status === 'uploading' && <p className="flex items-center justify-center gap-2"><ClockIcon className="w-5 h-5 animate-spin"/> Uploading file...</p>}
            {status === 'processing' && (
                <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-base font-medium text-blue-700">Processing...</span>
                      <span className="text-sm font-medium text-blue-700">{progress.processed + progress.failed} / {progress.total} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                    </div>
                </div>
            )}
            {status === 'completed' && (
                <div className="text-center text-green-600">
                    <CheckCircleIcon className="w-12 h-12 mx-auto mb-2"/>
                    <p className="font-semibold">{reportMessage}</p>
                    <p>Success: {progress.processed}, Failed: {progress.failed}</p>
                </div>
            )}
            {status === 'failed' && (
                <div className="text-center text-red-600">
                    <XCircleIcon className="w-12 h-12 mx-auto mb-2"/>
                    <p className="font-semibold">{reportMessage}</p>
                </div>
            )}
            {progress.failed > 0 && (
                <div className="mt-4 max-h-40 overflow-y-auto bg-red-50 p-3 rounded-md border border-red-200">
                    <h4 className="font-semibold text-red-800">Error Details:</h4>
                    <ul className="text-sm text-red-700 list-disc list-inside">
                        {errorLog?.slice(0, 20).map((err, i) => <li key={i}>Row {err.row}: {err.message}</li>)}
                    </ul>
                    {errorLog && errorLog.length > 20 && <p className="mt-2 text-xs text-red-600">...and {errorLog.length - 20} more errors.</p>}
                </div>
            )}
        </div>
    );
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={isProcessing ? () => {} : onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black bg-opacity-40" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 flex justify-between items-center">
                  Import Customer History
                  <button onClick={onClose} disabled={isProcessing} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50">
                    <XMarkIcon className="w-5 h-5"/>
                  </button>
                </Dialog.Title>
                <div className="mt-4 space-y-4">
                  <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
                    {renderProgress()}
                  </div>
                  <div>
                    <a href="/templates/customer_history_import_template.xlsx" download className="inline-flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                        <DocumentArrowDownIcon className="w-5 h-5"/> Download Template
                    </a>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={onClose} disabled={isProcessing} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-transparent rounded-md hover:bg-gray-200 disabled:opacity-50">
                        {jobStatus.status === 'completed' || jobStatus.status === 'failed' ? 'Close' : 'Cancel'}
                    </button>
                    <button type="button" onClick={handleImport} disabled={!file || isProcessing} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isProcessing ? 'Importing...' : 'Start Import'}
                    </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}