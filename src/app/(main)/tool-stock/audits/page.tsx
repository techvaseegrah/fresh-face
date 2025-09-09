'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Eye } from 'lucide-react';

// Interface for the audit list summary
interface IAuditSummary {
  _id: string;
  auditorName: string;
  createdAt: string;
  items: {
    status: 'MATCHED' | 'MISMATCHED';
  }[];
}

export default function AuditHistoryPage() {
  const { data: session, status } = useSession();
  const [audits, setAudits] = useState<IAuditSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.tenantId) {
      const fetchAuditHistory = async () => {
        try {
          const response = await fetch('/api/tool-stock/audits', {
            headers: { 'x-tenant-id': session.user.tenantId! },
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch audit history.');
          }
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(); // Shows date and time
  };
  
  const getMismatchCount = (items: { status: string }[]) => {
    return items.filter(item => item.status === 'MISMATCHED').length;
  };

  if (loading) {
    return <p className="p-8 text-center">Loading Audit History...</p>;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 border-b flex items-center space-x-3">
          <Link href="/tool-stock" className="p-2 rounded-full hover:bg-gray-100" title="Back to Tool List">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold">Audit History</h1>
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
                    <th scope="col" className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.length > 0 ? (
                    audits.map((audit) => {
                      const mismatches = getMismatchCount(audit.items);
                      return (
                        <tr key={audit._id} className="bg-white border-b hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900">{formatDate(audit.createdAt)}</td>
                          <td className="px-6 py-4">{audit.auditorName}</td>
                          <td className="px-6 py-4">
                            {mismatches > 0 ? (
                              <span className="font-bold text-red-600">{mismatches} item(s) mismatched</span>
                            ) : (
                              <span className="font-bold text-green-600">All items matched</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <Link href={`/tool-stock/audits/${audit._id}`} className="font-medium text-blue-600 hover:underline flex items-center">
                              <Eye size={16} className="mr-1" /> View Report
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                        No audit reports found.
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