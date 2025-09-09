'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { File, FileText, ShieldAlert } from 'lucide-react';
// ▼▼▼ ADD THESE IMPORTS ▼▼▼
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
// ▲▲▲ END OF ADDITION ▲▲▲

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

  // ▼▼▼ DEFINE USER PERMISSIONS ▼▼▼
  const userPermissions = useMemo(() => session?.user?.role?.permissions || [], [session]);
  
  const canRead = useMemo(() => hasPermission(userPermissions, PERMISSIONS.TOOL_STOCK_READ), [userPermissions]);
  const canUseReports = useMemo(() => hasPermission(userPermissions, PERMISSIONS.TOOL_STOCK_REPORTS), [userPermissions]);
  // ▲▲▲ END OF DEFINITION ▲▲▲

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.tenantId) {
      // Permission check before fetching
      if (!canRead) {
        setError('You do not have permission to view this report.');
        setLoading(false);
        return;
      }

      const fetchTools = async () => {
        try {
          const response = await fetch('/api/tool-stock/tools', {
            headers: { 'x-tenant-id': session.user.tenantId! },
          });
          if (!response.ok) throw new Error('Failed to fetch tool data.');
          const data = await response.json();
          setTools(data);
          setError(null);
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
  }, [status, session, canRead]); // Added canRead dependency

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    // Add permission check to handler
    if (!session?.user?.tenantId || !canUseReports) {
      setError('Permission denied or could not verify tenant.');
      return;
    }
    setIsExporting(format);
    try {
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

  if (status === 'loading') {
    return <p className="p-8 text-center">Authenticating...</p>;
  }

  // ▼▼▼ TOP-LEVEL PERMISSION CHECK ▼▼▼
  if (!loading && !canRead) {
    return (
      <div className="p-8 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-red-500" />
        <h2 className="mt-4 text-xl font-bold">Permission Denied</h2>
        <p className="mt-2 text-gray-600">You do not have permission to view this page.</p>
      </div>
    );
  }
  // ▲▲▲ END OF CHECK ▲▲▲

  return (
    <div className="p-4 md:p-8">
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 border-b flex items-center justify-between">
          <h1 className="text-xl font-bold">Tool Stock Report</h1>
          {/* --- PERMISSION CHECK FOR EXPORT BUTTONS --- */}
          {canUseReports && (
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
          )}
        </div>
        <div className="p-4">
          {error && <p className="text-red-500 bg-red-50 p-3 rounded-md">Error: {error}</p>}
          {!error && (
            <div className="overflow-x-auto">
              {loading ? (
                <p className="text-center py-4">Loading Report Data...</p>
              ) : (
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
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}