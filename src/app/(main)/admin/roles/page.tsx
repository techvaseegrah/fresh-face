// /app/admin/roles/page.tsx - FINAL VERSION WITH UI LAYOUT FIX
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession, getSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS, ALL_PERMISSIONS, PermissionInfo } from '@/lib/permissions';
import EditRoleModal from '@/components/EditRoleModal';
import { PencilIcon, TrashIcon } from 'lucide-react';
import { toast } from 'react-toastify';

interface Role {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  canHandleBilling: boolean;
  isActive: boolean;
  isSystemRole: boolean;
  createdAt: string;
}

export default function RolesPage() {
  const { data: session } = useSession();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const [newRole, setNewRole] = useState({
    name: '',
    displayName: '',
    description: '',
    permissions: [] as string[],
    canHandleBilling: false,
  });

  const canCreate = session && hasPermission(session.user.role.permissions, PERMISSIONS.ROLES_CREATE);
  const canUpdate = session && hasPermission(session.user.role.permissions, PERMISSIONS.ROLES_UPDATE);
  const canDelete = session && hasPermission(session.user.role.permissions, PERMISSIONS.ROLES_DELETE);

  const loggedInUserPermissions = useMemo(() => session?.user?.role?.permissions || [], [session]);

  const grantablePermissions = useMemo((): PermissionInfo[] => {
    if (loggedInUserPermissions.includes('*')) {
      return ALL_PERMISSIONS;
    }
    return ALL_PERMISSIONS.filter(pInfo =>
      hasPermission(loggedInUserPermissions, pInfo.permission)
    );
  }, [loggedInUserPermissions]);

  const grantableGroupedPermissions = useMemo(() => {
    return grantablePermissions.reduce((acc, perm) => {
      const category = perm.category || 'General';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(perm);
      return acc;
    }, {} as Record<string, PermissionInfo[]>);
  }, [grantablePermissions]);

  const tenantFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const currentSession = await getSession();
    const headers = {
      ...options.headers,
      'Content-Type': 'application/json',
      'x-tenant-id': currentSession?.user?.tenantId || '',
    };
    return fetch(url, { ...options, headers });
  }, []);

  const fetchRoles = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      const response = await tenantFetch('/api/admin/roles');
      const data = await response.json();
      if (data.success) {
        setRoles(data.roles);
      } else {
        toast.error(data.message || "Failed to fetch roles.");
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error("An unexpected error occurred while fetching roles.");
    } finally {
      setIsLoading(false);
    }
  }, [session, tenantFetch]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);
  
  const handleUpdateRole = async (roleId: string, updateData: any) => {
    try {
      const response = await tenantFetch(`/api/admin/roles/${roleId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Role updated successfully!');
        fetchRoles();
        setShowEditModal(false);
      } else {
        toast.error(data.message || 'Error updating role');
      }
    } catch (error) {
      toast.error('An unexpected error occurred while updating the role.');
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
     e.preventDefault();
    try {
      const response = await tenantFetch('/api/admin/roles', {
        method: 'POST',
        body: JSON.stringify(newRole),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Role created successfully!');
        setShowCreateModal(false);
        setNewRole({ name: '', displayName: '', description: '', permissions: [], canHandleBilling: false });
        fetchRoles();
      } else {
        toast.error(data.message || 'Error creating role');
      }
    } catch (error) {
      toast.error('An unexpected error occurred while creating the role.');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (confirm('Are you sure you want to delete this role? This might affect associated users.')) {
      try {
        const response = await tenantFetch(`/api/admin/roles/${roleId}`, {
          method: 'DELETE',
        });
        const data = await response.json();
        if (data.success) {
          toast.success('Role deleted successfully!');
          fetchRoles();
        } else {
          toast.error(data.message || 'Error deleting role');
        }
      } catch (error) {
        toast.error('An unexpected error occurred while deleting the role.');
      }
    }
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setShowEditModal(true);
  };

  const togglePermission = (permission: string) => {
    setNewRole(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handleToggleCategoryPermissions = (categoryPermissions: string[], isChecked: boolean) => {
    if (isChecked) {
      setNewRole(prev => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...categoryPermissions])]
      }));
    } else {
      setNewRole(prev => ({
        ...prev,
        permissions: prev.permissions.filter(p => !categoryPermissions.includes(p))
      }));
    }
  };

  return (
    // ✅ CHANGED: Simplified root container. Padding can be p-4, p-6 or p-8 based on your preference.
    <div className="p-6 space-y-6">
      {/* ✅ CHANGED: Unified header for better alignment */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage system roles and their permissions for your salon.
          </p>
        </div>
        {canCreate && (
          <div className="mt-4 sm:mt-0">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              Add Role
            </button>
          </div>
        )}
      </div>

       {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900"></div>
        </div>
       ) : (
        // ✅ CHANGED: Removed extra flex container and adjusted layout for the table card
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    {(canUpdate || canDelete) && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {roles.map((role) => (
                    <tr key={role._id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{role.displayName}</div>
                          <div className="text-sm text-gray-500">{role.description}</div>
                          <div className="mt-2 flex items-center gap-2">
                              {role.isSystemRole && <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">System Role</span>}
                              {role.canHandleBilling && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.158-.103.346-.196.567-.267v1.698a2.5 2.5 0 00-1.134 0v-1.43zM11.567 7.151c.221.07.409.164.567.267v1.43a2.5 2.5 0 00-1.134 0V7.15z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.5 4.5 0 00-1.879 3.515v1.2a1 1 0 001.121.983 13.95 13.95 0 00.758 0 1 1 0 001.121-.983v-1.2a4.5 4.5 0 00-1.879-3.515V5z" clipRule="evenodd" /></svg>
                                      Billing Staff
                                  </span>
                              )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{role.permissions.includes('*') ? <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">All Permissions</span> : <span className="text-sm text-gray-500">{role.permissions.length} permissions</span>}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${role.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{role.isActive ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(role.createdAt).toLocaleDateString()}</td>
                      {(canUpdate || canDelete) && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex gap-2">
                            {canUpdate && <button onClick={() => handleEditRole(role)} className="text-indigo-600 hover:text-indigo-900" title="Edit role" disabled={role.isSystemRole}><PencilIcon className="h-5 w-5" /></button>}
                            {canDelete && <button onClick={() => handleDeleteRole(role._id)} className="text-red-600 hover:text-red-900" title="Delete role" disabled={role.isSystemRole}><TrashIcon className="h-5 w-5" /></button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
       )}

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Role</h3>
              <form onSubmit={handleCreateRole} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role Name</label>
                    <input type="text" required value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value.toUpperCase() })} placeholder="e.g., MANAGER" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Display Name</label>
                    <input type="text" required value={newRole.displayName} onChange={(e) => setNewRole({ ...newRole, displayName: e.target.value })} placeholder="e.g., Manager" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} rows={2} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Settings</label>
                    <div className="mt-2 space-y-2 border border-gray-200 rounded-md p-3">
                        <div className="relative flex items-start">
                            <div className="flex h-6 items-center">
                                <input
                                    id="canHandleBilling"
                                    name="canHandleBilling"
                                    type="checkbox"
                                    checked={newRole.canHandleBilling}
                                    onChange={(e) => setNewRole({ ...newRole, canHandleBilling: e.target.checked })}
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                />
                            </div>
                            <div className="ml-3 text-sm leading-6">
                                <label htmlFor="canHandleBilling" className="font-medium text-gray-900">
                                    Can Handle Billing
                                </label>
                                <p id="canHandleBilling-description" className="text-gray-500">
                                    Allows users with this role to appear in billing staff lists.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Permissions</label>
                  <div className="space-y-4 max-h-96 overflow-y-auto p-1">
                    {Object.entries(grantableGroupedPermissions).map(([category, permissions]) => {
                      
                      const categoryPermissionKeys = permissions.map(p => p.permission);
                      const areAllInCategorySelected = categoryPermissionKeys.every(p => newRole.permissions.includes(p));
                      
                      return (
                        <div key={category} className="border rounded-lg p-4">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-medium text-gray-900">{category}</h4>
                            <div className="flex items-center">
                              <input 
                                  id={`select-all-${category}`}
                                  type="checkbox" 
                                  checked={areAllInCategorySelected}
                                  onChange={(e) => handleToggleCategoryPermissions(categoryPermissionKeys, e.target.checked)}
                                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" 
                              />
                              <label htmlFor={`select-all-${category}`} className="ml-2 text-xs font-medium text-gray-700">
                                Select All in Category
                              </label>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t">
                            {permissions.map((perm) => (
                              <label key={perm.permission} className="flex items-center">
                                <input type="checkbox" checked={newRole.permissions.includes(perm.permission)} onChange={() => togglePermission(perm.permission)} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                                <span className="ml-2 text-sm text-gray-700">{perm.description}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700">Create Role</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

       {showEditModal && editingRole && (
        <EditRoleModal 
            isOpen={showEditModal} 
            onClose={() => { setShowEditModal(false); setEditingRole(null); }} 
            role={editingRole} 
            onUpdate={handleUpdateRole} 
            grantablePermissions={grantablePermissions}
        />
      )}
    </div>
  );
} 