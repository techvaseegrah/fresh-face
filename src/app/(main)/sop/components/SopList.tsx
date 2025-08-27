'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { FileText, ListChecks, Edit, Trash2, Eye, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// --- (1) DEFINE STRONG TYPES ---

// The shape of a single role object
interface Role {
  _id: string;
  displayName: string;
}

// The shape of a single SOP object
interface Sop {
  _id: string;
  title: string;
  description: string;
  type: 'checklist' | 'document'; // Assuming these are the possible types
  roles: Role[];
}

// The shape of the props for this component
interface SopListProps {
  onEdit: (sop: Sop) => void;
}

// --- (2) APPLY THE PROP TYPE TO THE COMPONENT ---
export default function SopList({ onEdit }: SopListProps) {
  const { data: session } = useSession();

  const fetcherWithAuth = useCallback(async (url: string) => {
    if (!session?.user?.tenantId) {
      throw new Error("Session not ready");
    }
    const headers = new Headers();
    headers.append('x-tenant-id', session.user.tenantId);
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errorInfo = await res.json();
      throw new Error(errorInfo.message || 'An error occurred while fetching the data.');
    }
    return res.json();
  }, [session]);

  // --- (3) APPLY THE SOP TYPE TO useSWR ---
  // This tells SWR what to expect from the API
  const { data: sops, error, mutate } = useSWR<Sop[]>('/api/sop', fetcherWithAuth);

  const canManage = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.SOP_MANAGE);

  const handleDelete = async (sopId: string) => {
    if (!session) return;
    if (confirm('Are you sure you want to delete this SOP?')) {
      const headers = new Headers();
      headers.append('x-tenant-id', session.user.tenantId);
      await fetch(`/api/sop/${sopId}`, {
        method: 'DELETE',
        headers: headers
      });
      mutate();
    }
  };

  if (error) {
    return (
      <div className="text-red-600 bg-red-50 p-4 rounded-lg flex items-center gap-3">
        <AlertTriangle size={20} />
        <span>{error.message}</span>
      </div>
    );
  }

  if (!sops) {
    return (
      <div className="flex justify-center items-center p-10">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (sops.length === 0) {
    return (
      <div className="text-center py-10 px-6 bg-gray-50 rounded-lg">
        <h3 className="text-xl font-semibold text-gray-700">No SOPs Found</h3>
        <p className="text-gray-500 mt-2">
          {canManage
            ? "Get started by adding a new SOP for your team."
            : "There are no SOPs assigned to your role yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* --- (4) APPLY THE SOP TYPE IN THE MAP FUNCTION --- */}
      {/* This removes the `any` type and gives you autocomplete */}
      {sops.map((sop: Sop) => (
        <div 
          key={sop._id} 
          className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
        >
          <div className="flex-1 min-w-0 mb-4 md:mb-0">
            <div className="flex items-center gap-4">
              {sop.type === 'checklist' ? 
                <ListChecks className="text-blue-500 flex-shrink-0" size={24} /> : 
                <FileText className="text-green-500 flex-shrink-0" size={24} />
              }
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-lg font-semibold text-gray-800 truncate">{sop.title}</p>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${sop.type === 'checklist' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                    {sop.type}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1 truncate">{sop.description}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:mx-4 flex-shrink-0 justify-start md:justify-center mb-4 md:mb-0">
            {sop.roles.map((role: Role) => (
              <span key={role._id} className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded-full">{role.displayName}</span>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
            <Link href={`/sop/${sop._id}`} className="p-2 text-gray-500 hover:text-blue-600 transition-colors" title="View SOP">
              <Eye size={18} />
            </Link>
            {canManage && (
              <>
                <button onClick={() => onEdit(sop)} className="p-2 text-gray-500 hover:text-green-600 transition-colors" title="Edit SOP">
                  <Edit size={18} />
                </button>
                <button onClick={() => handleDelete(sop._id)} className="p-2 text-gray-500 hover:text-red-600 transition-colors" title="Delete SOP">
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}