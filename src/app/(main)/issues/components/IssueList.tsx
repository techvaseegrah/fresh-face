'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { ListChecks, Edit, Trash2, Eye, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// Define strong types
interface Role { _id: string; displayName: string; }
interface Issue { _id: string; title: string; description: string; roles: Role[]; }
interface IssueListProps { onEdit: (issue: Issue) => void; }

export default function IssueList({ onEdit }: IssueListProps) {
  const { data: session } = useSession();

  const fetcherWithAuth = useCallback(async (url: string) => {
    if (!session?.user?.tenantId) throw new Error("Session not ready");
    const headers = new Headers();
    headers.append('x-tenant-id', session.user.tenantId);
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errorInfo = await res.json();
      throw new Error(errorInfo.message || 'An error occurred while fetching the data.');
    }
    return res.json();
  }, [session]);

  const { data: issues, error, mutate } = useSWR<Issue[]>('/api/issue', fetcherWithAuth);
  const canManage = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.ISSUE_MANAGE);

  const handleDelete = async (issueId: string) => {
    if (!session || !confirm('Are you sure you want to delete this issue?')) return;
    const headers = new Headers();
    headers.append('x-tenant-id', session.user.tenantId);
    await fetch(`/api/issue/${issueId}`, { method: 'DELETE', headers });
    mutate();
  };

  if (error) return <div className="text-red-600 bg-red-50 p-4 rounded-lg flex items-center gap-3"><AlertTriangle size={20} /><span>{error.message}</span></div>;
  if (!issues) return <div className="flex justify-center items-center p-10"><Loader2 className="animate-spin text-gray-400" size={32} /></div>;
  if (issues.length === 0) return (
    <div className="text-center py-10 px-6 bg-gray-50 rounded-lg">
      <h3 className="text-xl font-semibold text-gray-700">No Issues Found</h3>
      <p className="text-gray-500 mt-2">{canManage ? "Get started by adding a new issue for your team." : "There are no issues assigned to your role yet."}</p>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {issues.map((issue: Issue) => (
        <div key={issue._id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors">
          <div className="flex-1 min-w-0 mb-4 md:mb-0">
             <div className="flex items-center gap-4">
                <ListChecks className="text-blue-500 flex-shrink-0" size={24} />
                 <div className="min-w-0">
                    <p className="text-lg font-semibold text-gray-800 truncate">{issue.title}</p>
                    <p className="text-sm text-gray-500 mt-1 truncate">{issue.description}</p>
                 </div>
             </div>
          </div>
          <div className="flex flex-wrap gap-2 md:mx-4 flex-shrink-0 justify-start md:justify-center mb-4 md:mb-0">
            {issue.roles.map((role: Role) => (
              <span key={role._id} className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded-full">{role.displayName}</span>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
            <Link href={`/issues/${issue._id}`} className="p-2 text-gray-500 hover:text-blue-600 transition-colors" title="View Issue"><Eye size={18} /></Link>
            {canManage && (
              <>
                <button onClick={() => onEdit(issue)} className="p-2 text-gray-500 hover:text-green-600 transition-colors" title="Edit Issue"><Edit size={18} /></button>
                <button onClick={() => handleDelete(issue._id)} className="p-2 text-gray-500 hover:text-red-600 transition-colors" title="Delete Issue"><Trash2 size={18} /></button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}