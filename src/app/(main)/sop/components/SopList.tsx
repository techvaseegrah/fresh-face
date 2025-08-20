'use client';

import { useCallback } from 'react'; // Import useCallback
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { FileText, ListChecks, Edit, Trash2, Eye } from 'lucide-react';
import Link from 'next/link';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export default function SopList({ onEdit }) {
  const { data: session } = useSession();

  // --- THIS IS THE FIX ---
  // Create a custom fetcher function that adds the authentication header.
  const fetcherWithAuth = useCallback(async (url: string) => {
    // Wait until the session is loaded
    if (!session) {
      throw new Error("Session not loaded");
    }

    const headers = new Headers();
    headers.append('x-tenant-id', session.user.tenantId);

    const res = await fetch(url, { headers });

    // If the server responds with an error, throw an error to be caught by SWR
    if (!res.ok) {
      const errorInfo = await res.json();
      const error = new Error(errorInfo.message || 'An error occurred while fetching the data.');
      throw error;
    }

    return res.json();
  }, [session]); // Re-create the fetcher only when the session changes

  // Use our new custom fetcher
  const { data: sops, error, mutate } = useSWR('/api/sop', fetcherWithAuth);

  const canManage = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.SOP_MANAGE);

  const handleDelete = async (sopId: string) => {
    if (!session) return; // Guard clause
    if (confirm('Are you sure you want to delete this SOP?')) {
      const headers = new Headers();
      headers.append('x-tenant-id', session.user.tenantId); // Add header to DELETE request

      await fetch(`/api/sop/${sopId}`, { 
        method: 'DELETE',
        headers: headers 
      });
      mutate(); // Re-fetch the data
    }
  };

  if (error) return <div className="text-red-500">{error.message}</div>;
  if (!sops) return <div>Loading...</div>;

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sops.map((sop: any) => (
        <div key={sop._id} className="bg-white rounded-lg shadow-md p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                    {sop.type === 'checklist' ? <ListChecks className="text-blue-500" size={24} /> : <FileText className="text-green-500" size={24} />}
                    <h2 className="text-xl font-semibold">{sop.title}</h2>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${sop.type === 'checklist' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                    {sop.type}
                </span>
            </div>
            <p className="text-gray-600 mb-4">{sop.description}</p>
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-1">Assigned Roles:</h4>
              <div className="flex flex-wrap gap-2">
                {sop.roles.map((role: any) => (
                  <span key={role._id} className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded-full">{role.displayName}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t pt-4 flex justify-end items-center gap-2">
            <Link href={`/sop/${sop._id}`} className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
                <Eye size={18} />
            </Link>
            {canManage && (
              <>
                <button onClick={() => onEdit(sop)} className="p-2 text-gray-500 hover:text-green-600 transition-colors">
                  <Edit size={18} />
                </button>
                <button onClick={() => handleDelete(sop._id)} className="p-2 text-gray-500 hover:text-red-600 transition-colors">
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