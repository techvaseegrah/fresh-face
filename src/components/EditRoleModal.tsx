// app/admin/roles/components/EditRoleModal.tsx
'use client';

import { useState, useEffect } from 'react';
// <<< 1. IMPORT grantablePermissions (SECURITY BEST PRACTICE)
import { PermissionInfo } from '@/lib/permissions';

// <<< 2. DEFINE A STRONG TYPE FOR THE ROLE PROP
interface Role {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  canHandleBilling: boolean;
  isActive: boolean;
  isSystemRole: boolean;
}

interface EditRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: Role; // Use the strong type instead of `any`
  onUpdate: (roleId: string, data: any) => Promise<void>;
  // <<< 3. ACCEPT grantablePermissions (SECURITY BEST PRACTICE)
  grantablePermissions: PermissionInfo[];
}

export default function EditRoleModal({ isOpen, onClose, role, onUpdate, grantablePermissions }: EditRoleModalProps) {
  const [formData, setFormData] = useState({
    displayName: '',
    description: '',
    permissions: [] as string[],
    isActive: true,
    canHandleBilling: false // <<< 4. ADD to initial state
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (role) {
      setFormData({
        displayName: role.displayName || '',
        description: role.description || '',
        permissions: role.permissions || [],
        isActive: role.isActive ?? true,
        canHandleBilling: role.canHandleBilling || false // <<< 5. POPULATE from role prop
      });
    }
  }, [role]);

  const togglePermission = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role?.isSystemRole) return; // Extra safety check
    setIsSubmitting(true);
    
    try {
      // The entire `formData` is sent, which now includes `canHandleBilling`
      await onUpdate(role._id, formData);
      onClose();
    } catch (error) {
      console.error('Error updating role:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group permissions by category using the secure, filtered list
  const groupedPermissions = grantablePermissions.reduce((acc, perm) => {
    const category = perm.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(perm);
    return acc;
  }, {} as Record<string, PermissionInfo[]>);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Edit Role: {role?.displayName}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Display Name and Description inputs remain the same */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Display Name</label>
              <input type="text" required value={formData.displayName} onChange={(e) => setFormData({...formData, displayName: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={2} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
            </div>

            {/* <<< 6. ADD A "SETTINGS" SECTION FOR THE CHECKBOXES --> */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Settings</label>
              <div className="mt-2 space-y-4 border border-gray-200 rounded-md p-3">
                <div className="relative flex items-start">
                    <div className="flex h-6 items-center">
                      <input id="isActiveRole" name="isActive" type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({...formData, isActive: e.target.checked})} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"/>
                    </div>
                    <div className="ml-3 text-sm leading-6">
                      <label htmlFor="isActiveRole" className="font-medium text-gray-900">Active Role</label>
                      <p className="text-gray-500">Inactive roles cannot be assigned to new users.</p>
                    </div>
                </div>
                <div className="relative flex items-start">
                    <div className="flex h-6 items-center">
                        <input id="canHandleBillingEdit" name="canHandleBilling" type="checkbox" checked={formData.canHandleBilling} onChange={(e) => setFormData({ ...formData, canHandleBilling: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"/>
                    </div>
                    <div className="ml-3 text-sm leading-6">
                        <label htmlFor="canHandleBillingEdit" className="font-medium text-gray-900">Can Handle Billing</label>
                        <p className="text-gray-500">Allows users with this role to appear in billing staff lists.</p>
                    </div>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Permissions</label>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {Object.entries(groupedPermissions).map(([category, permissions]) => (
                  <div key={category} className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">{category}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {permissions.map((perm) => (
                        <label key={perm.permission} className="flex items-center">
                          <input type="checkbox" checked={formData.permissions.includes(perm.permission)} onChange={() => togglePermission(perm.permission)} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"/>
                          <span className="ml-2 text-sm text-gray-700">{perm.description}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200">Cancel</button>
              <button type="submit" disabled={isSubmitting || role?.isSystemRole} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50">
                {isSubmitting ? 'Updating...' : 'Update Role'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}