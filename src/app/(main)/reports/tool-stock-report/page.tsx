'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { File, FileText } from 'lucide-react'; // Changed icon from Download

interface ITool {
  _id: string;
  name: string;
  category: string;
  currentStock: number;
  maintenanceDueDate?: string;
}

export default function ToolStockReportPage() {
  const { data: session, status } = useSession();
  const [tools, setTools] = useState<ITool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<'' | 'xlsx' | 'pdf'>('');

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.tenantId) {
      const fetchTools = async () => {
        try {
          const response = await fetch('/api/tool-stock/tools', {
            headers: { 'x-tenant-id': session.user.tenantId! },
          });
          if (!response.ok) throw new Error('Failed to fetch tool data.');
          const data = await response.json();
          setTools(data);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchTools();
    } else if (status === 'unauthenticated') {
      setError("You are not authenticated.");
      setLoading(false);
    }
  }, [status, session]);

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    if (!session?.user?.tenantId) {
      setError('Could not verify tenant. Please refresh and try again.');
      return;
    }
    setIsExporting(format);
    try {
      // The URL now includes the format query parameter
      const response = await fetch(`/api/tool-stock/tools/export?format=${format}`, {
        headers: { 'x-tenant-id': session.user.tenantId },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to export data.');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const contentDisposition = response.headers.get('content-disposition');
      let fileName = `tool_stock_report.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) fileName = match[1];
      }
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(`Export failed: ${err.message}`);
    } finally {
      setIsExporting('');
    }
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) return <p className="p-8 text-center">Loading Report Data...</p>;

  return (
    <div>
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 border-b flex items-center justify-between">
          <h1 className="text-xl font-bold">Tool Stock Report</h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExport('xlsx')}
              disabled={isExporting !== '' || tools.length === 0}
              className="flex items-center px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
            >
              <File size={16} className="mr-2"/>
              {isExporting === 'xlsx' ? 'Exporting...' : 'Export Excel'}
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={isExporting !== '' || tools.length === 0}
              className="flex items-center px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400"
            >
              <FileText size={16} className="mr-2"/>
              {isExporting === 'pdf' ? 'Exporting...' : 'Export PDF'}
            </button>
          </div>
        </div>
        <div className="p-4">
          {error && <p className="text-red-500 bg-red-50 p-3 rounded-md">Error: {error}</p>}
          {!error && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3">Tool Name</th>
                    <th scope="col" className="px-6 py-3">Category</th>
                    <th scope="col" className="px-6 py-3 text-right">Current Stock</th>
                    <th scope="col" className="px-6 py-3">Maintenance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {tools.length > 0 ? (
                    tools.map((tool) => (
                      <tr key={tool._id} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{tool.name}</td>
                        <td className="px-6 py-4">{tool.category}</td>
                        <td className="px-6 py-4 text-right">{tool.currentStock}</td>
                        <td className="px-6 py-4">{formatDate(tool.maintenanceDueDate)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center">
                        No tool data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}