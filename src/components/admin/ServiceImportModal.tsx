// /src/components/admin/ServiceImportModal.tsx

"use client";

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { read, utils } from 'xlsx';
import { XIcon, UploadCloudIcon, FileTextIcon } from 'lucide-react';
import { toast } from 'react-toastify';

interface ServiceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (report: any) => void;
}

const REQUIRED_HEADERS = [
  'ServiceName', 'ServiceCode', 'CategoryName', 'SubCategoryName', 'Audience',
  'Duration', 'Price'
];

export default function ServiceImportModal({ isOpen, onClose, onImportSuccess }: ServiceImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      toast.info(`File selected: ${acceptedFiles[0].name}`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
  });
  
  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file to import.");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data: any[] = utils.sheet_to_json(worksheet);

      if (data.length === 0) throw new Error("The Excel file is empty.");

      const headers = Object.keys(data[0]);
      const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        throw new Error(`The Excel file is missing required columns: ${missingHeaders.join(', ')}`);
      }

      const response = await fetch('/api/service-items/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.message || "Import failed on the server.");
      
      onImportSuccess(result.report);
      onClose();

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Import Services from Excel</h2>
          <button onClick={onClose} disabled={isProcessing} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <p className="font-semibold mb-2">Instructions:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Use the template to ensure your column headers are correct.</li>
              <li>A service with multiple consumables should have multiple rows (one for each consumable).</li>
              <li>The `ServiceCode` must be unique and is used to update existing services.</li>
              <li>If `Consumable_SKU` is provided, it must exist in your products list.</li>
            </ul>
             <a href="/templates/service_import_template.xlsx" download
               className="inline-block mt-3 text-sm font-medium text-blue-600 hover:underline">
              Download Template
            </a>
          </div>

          <div {...getRootProps()}
               className={`p-10 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'}`}>
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center">
              <UploadCloudIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="font-medium text-gray-700">{isDragActive ? "Drop the file here..." : "Drag & drop service Excel file here"}</p>
            </div>
          </div>
          
          {file && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileTextIcon className="h-6 w-6 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
              <button onClick={() => setFile(null)} disabled={isProcessing} className="p-1 text-gray-500 hover:text-red-600 rounded-full"><XIcon className="h-4 w-4" /></button>
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button onClick={onClose} disabled={isProcessing} className="px-6 py-2.5 text-sm font-medium bg-white border rounded-lg hover:bg-gray-100">Cancel</button>
          <button onClick={handleImport} disabled={!file || isProcessing} className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 shadow-sm">
            {isProcessing ? 'Importing...' : 'Start Service Import'}
          </button>
        </div>
      </div>
    </div>
  );
}