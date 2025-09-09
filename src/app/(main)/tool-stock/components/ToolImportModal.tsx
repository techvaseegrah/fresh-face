'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import { X, Download, Upload, AlertTriangle, CheckCircle } from 'lucide-react';

interface ImportResult {
  message: string;
  created: number;
  updated: number;
  errors: { row: number; error: string }[];
}

interface ToolImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string | undefined;
}

export function ToolImportModal({ isOpen, onClose, onSuccess, tenantId }: ToolImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setResult(null); // Clear previous results when a new file is selected
    }
  };

  const handleClose = () => {
    // If an import was successful, trigger the parent page to refresh its data
    if (result && result.errors.length === 0) {
      onSuccess();
    }
    // Reset all state before closing
    setSelectedFile(null);
    setResult(null);
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !tenantId) return;

    setIsUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/tool-stock/tools/import', {
        method: 'POST',
        headers: {
          'x-tenant-id': tenantId,
          // Note: Don't set 'Content-Type' here; the browser will set it correctly for FormData
        },
        body: formData,
      });

      const data: ImportResult = await response.json();
      setResult(data);

      if (!response.ok) {
        // The API will return a 400 with a list of errors, which we display
        throw new Error(data.message || 'Import failed.');
      }
      
    } catch (err: any) {
      setResult({
        message: err.message || 'An unexpected error occurred.',
        created: 0,
        updated: 0,
        errors: [],
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={handleClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Import Tools from Excel</h2>
          <button onClick={handleClose} className="p-1 rounded-full hover:bg-gray-200"><X size={24} /></button>
        </div>

        {/* Instructions and Template Download */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-bold text-lg mb-2">Step 1: Download Template</h3>
          <p className="text-sm text-gray-600 mb-3">
            Download our Excel template to ensure your data is in the correct format for a successful import.
          </p>
          <a
            href="/templates/tool_import_template.xlsx"
            download
            className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 text-sm"
          >
            <Download className="mr-2 h-4 w-4" /> Download Template
          </a>
        </div>

        {/* File Upload Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-bold text-lg mb-2">Step 2: Upload File</h3>
            <p className="text-sm text-gray-600 mb-3">
              Choose the completed Excel file from your computer to begin the import.
            </p>
            <input
              type="file"
              onChange={handleFileChange}
              accept=".xlsx, .xls"
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              required
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button type="button" onClick={handleClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
              {result ? 'Close' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={!selectedFile || isUploading || !!result}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isUploading ? 'Uploading...' : 'Upload and Process'}
            </button>
          </div>
        </form>

        {/* Results Display Area */}
        {result && (
          <div className="mt-6 p-4 rounded-lg border">
            {result.errors.length > 0 ? (
              <div className="text-red-700">
                <div className="flex items-center mb-2">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  <h4 className="font-bold">Import Failed with Errors</h4>
                </div>
                <p className="text-sm mb-2">{result.message}</p>
                <ul className="list-disc list-inside text-sm max-h-32 overflow-y-auto">
                  {result.errors.map((err, i) => <li key={i}>Row {err.row}: {err.error}</li>)}
                </ul>
              </div>
            ) : (
              <div className="text-green-700">
                <div className="flex items-center mb-2">
                  <CheckCircle className="mr-2 h-5 w-5" />
                  <h4 className="font-bold">Import Successful</h4>
                </div>
                <p className="text-sm">Created: {result.created} new tools</p>
                <p className="text-sm">Updated: {result.updated} existing tools</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}