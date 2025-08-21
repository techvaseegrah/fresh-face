'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { PlusCircle } from 'lucide-react';
import SopList from './components/SopList';
import SopFormModal from './components/SopFormModal';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export default function SopManagementPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSop, setEditingSop] = useState(null);
  const { data: session } = useSession();

  // <<< FIX: Provide a default empty array
  const canManage = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.SOP_MANAGE);

  const handleEdit = (sop) => {
    setEditingSop(sop);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingSop(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSop(null);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">SOP Library</h1>
        {canManage && (
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusCircle size={20} />
            Add New SOP
          </button>
        )}
      </div>

      <SopList onEdit={handleEdit} />

      {isModalOpen && canManage && (
        <SopFormModal
          sop={editingSop}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}