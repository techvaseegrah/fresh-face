'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Interface for a full audit report
interface IAuditReport {
  _id: string;
  auditorName: string;
  createdAt: string;
  items: {
    toolName: string;
    expectedStock: number;
    countedStock: number;
    discrepancy: number;
    status: 'MATCHED' | 'MISMATCHED';
    remarks?: string;
  }[];
}

export default function AuditReportPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const auditId = params.auditId as string;

  const [report, setReport] = useState<IAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.tenantId && auditId) {
      const fetchReport = async () => {
        try {
          const response = await fetch(`/api/tool-stock/audits/${auditId}`, {
            headers: { 'x-tenant-id': session.user.tenantId! },
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch audit report.');
          }
          const data = await response.json();
          setReport(data);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchReport();
    } else if (status === 'unauthenticated') {
      setError("You are not authenticated.");
      setLoading(false);
    }
  }, [status, session, auditId]);

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();

  if (loading) return <p className="p-8 text-center">Loading Audit Report...</p>;
  if (error) return <p className="p-8 text-center text-red-500">Error: {error}</p>;
  if (!report) return <p className="p-8 text-center">Report not found.</p>;

  return (
    <div className="p-4 md:p-8">
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 border-b">
          <div className="flex items-center space-x-3 mb-4">
            <Link href="/tool-stock/audits" className="p-2 rounded-full hover:bg-gray-100" title="Back to Audit History">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold">Audit Report</h1>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Audit Date:</strong> {formatDate(report.createdAt)}</p>
            <p><strong>Auditor:</strong> {report.auditorName}</p>
          </div>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3">Tool Name</th>
                  <th scope="col" className="px-6 py-3 text-center">Expected</th>
                  <th scope="col" className="px-6 py-3 text-center">Counted</th>
                  <th scope="col" className="px-6 py-3 text-center">Discrepancy</th>
                  <th scope="col" className="px-6 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {report.items.map((item, index) => (
                  <tr key={index} className={`border-b ${item.status === 'MISMATCHED' ? 'bg-red-50' : 'bg-white'}`}>
                    <td className="px-6 py-4 font-medium text-gray-900">{item.toolName}</td>
                    <td className="px-6 py-4 text-center">{item.expectedStock}</td>
                    <td className="px-6 py-4 text-center">{item.countedStock}</td>
                    <td className={`px-6 py-4 text-center font-bold ${item.discrepancy !== 0 ? 'text-red-600' : 'text-gray-700'}`}>
                      {item.discrepancy}
                    </td>
                    <td className="px-6 py-4">{item.remarks || <span className="text-gray-400">N/A</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}