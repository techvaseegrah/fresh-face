'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { File, FileText } from 'lucide-react';

interface IAuditSummary {
  _id: string;
  auditorName: string;
  createdAt: string;
  items: {
    status: 'MATCHED' | 'MISMATCHED';
  }[];
}

export default function AuditReportsPage() {
  const { data: session, status } = useSession();
  const [audits, setAudits] = useState<IAuditSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State to track which report is currently being exported
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.tenantId) {
      const fetchAuditHistory = async () => {
        try {
          const response = await fetch('/api/tool-stock/audits', {
            headers: { 'x-tenant-id': session.user.tenantId! },
          });
          if (!response.ok) throw new Error('Failed to fetch audit history.');
          const data = await response.json();
          setAudits(data);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchAuditHistory();
    } else if (status === 'unauthenticated') {
      setError("You are not authenticated.");
      setLoading(false);
    }
  }, [status, session]);
  
  const handleExport = async (auditId: string, format: 'xlsx' | 'pdf') => {
    if (!session?.user?.tenantId) return;
    setExportingId(auditId);
    try {
      const response = await fetch(`/api/tool-stock/audits/${auditId}/export?format=${format}`, {
        headers: { 'x-tenant-id': session.user.tenantId },
      });
      if (!response.ok) throw new Error(`Failed to export ${format} file.`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const contentDisposition = response.headers.get('content-disposition');
      let fileName = `Audit_Report_${auditId}.${format}`;
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
      setError(`Export Error: ${err.message}`);
    } finally {
      setExportingId(null);
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();
  const getMismatchCount = (items: any[]) => items.filter(item => item.status === 'MISMATCHED').length;

  if (loading) return <p className="p-8 text-center">Loading Reports...</p>;

  return (
    <div>
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">Download Audit Reports</h1>
        </div>
        <div className="p-4">
          {error && <p className="text-red-500">Error: {error}</p>}
          {!error && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3">Audit Date</th>
                    <th scope="col" className="px-6 py-3">Auditor</th>
                    <th scope="col" className="px-6 py-3">Summary</th>
                    <th scope="col" className="px-6 py-3">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.length > 0 ? (
                    audits.map((audit) => {
                      const mismatches = getMismatchCount(audit.items);
                      const isExporting = exportingId === audit._id;
                      return (
                        <tr key={audit._id} className="bg-white border-b hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium">{formatDate(audit.createdAt)}</td>
                          <td className="px-6 py-4">{audit.auditorName}</td>
                          <td className="px-6 py-4">{mismatches > 0 ? `${mismatches} mismatches` : 'All matched'}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleExport(audit._id, 'xlsx')}
                                disabled={isExporting}
                                className="flex items-center p-2 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                                title="Download as Excel"
                              >
                                <File size={14} />
                              </button>
                              <button
                                onClick={() => handleExport(audit._id, 'pdf')}
                                disabled={isExporting}
                                className="flex items-center p-2 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400"
                                title="Download as PDF"
                              >
                                <FileText size={14} />
                              </button>
                               {isExporting && <span className="text-xs text-gray-500">Processing...</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan={4} className="px-6 py-4 text-center">No audit reports found.</td></tr>
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