'use client';

import { IStylist } from '@/models/Stylist';
import { PlusIcon, PencilIcon, TrashIcon, ClockIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import StylistFormModal from './StylistFormModal';
import StylistHistoryModal from '../StylistHistoryModal';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

interface IStylistHistoryItem {
  _id: string;
  date: string;
  customerName: string;
  services: string;
  amount: number;
  estimatedDuration: number;
  actualDuration: number;
}

const StylistSkeletonCard = () => (
  <div className="animate-pulse bg-white p-4 rounded-lg shadow-sm border border-gray-200">
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
      <div className="flex-1 space-y-2">
        <div className="h-5 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
      </div>
    </div>
  </div>
);

export default function StylistManager() {
  const { data: session } = useSession();

  const [stylists, setStylists] = useState<IStylist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingStylist, setEditingStylist] = useState<IStylist | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedStylist, setSelectedStylist] = useState<IStylist | null>(null);
  const [historyData, setHistoryData] = useState<IStylistHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const canCreate = session && hasPermission(session.user.role.permissions, PERMISSIONS.STYLISTS_CREATE);
  const canUpdate = session && hasPermission(session.user.role.permissions, PERMISSIONS.STYLISTS_UPDATE);
  const canDelete = session && hasPermission(session.user.role.permissions, PERMISSIONS.STYLISTS_DELETE);

  const fetchStylists = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/stylists');
      const data = await res.json();
      if (data.success) setStylists(data.data);
    } catch (error) {
      console.error("Failed to fetch stylists", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStylists();
  }, []);

  const handleOpenFormModal = (stylist: IStylist | null = null) => {
    setEditingStylist(stylist);
    setIsFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setIsFormModalOpen(false);
    setEditingStylist(null);
  };

  const handleViewHistory = async (stylist: IStylist) => {
    setSelectedStylist(stylist);
    setIsHistoryModalOpen(true);
    setIsHistoryLoading(true);
    try {
      const res = await fetch(`/api/stylist-history?stylistId=${stylist._id}`);
      const data = await res.json();
      if (data.success) {
        setHistoryData(data.data);
      } else {
        setHistoryData([]);
      }
    } catch (error) {
      setHistoryData([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleCloseHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setSelectedStylist(null);
    setHistoryData([]);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this stylist? This action cannot be undone.')) {
      try {
        const res = await fetch(`/api/stylists?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchStylists();
        } else {
          const errorData = await res.json();
          alert(`Failed to delete stylist: ${errorData.error}`);
        }
      } catch (error) {
        alert('An error occurred while deleting the stylist.');
      }
    }
  };
  
  const handleSave = async (stylistData: any) => {
    const isEditing = !!editingStylist;
    const url = isEditing ? `/api/stylists?id=${editingStylist!._id}` : '/api/stylists';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stylistData),
      });

      if (res.ok) {
        handleCloseFormModal();
        fetchStylists();
      } else {
        const errorData = await res.json();
        alert(`Failed to save: ${errorData.error}`);
      }
    } catch (error) {
      alert('An error occurred while saving.');
    }
  };

  return (
    <>
      <StylistFormModal
        isOpen={isFormModalOpen}
        onClose={handleCloseFormModal}
        onSave={handleSave}
        stylistToEdit={editingStylist}
      />
      
      <StylistHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={handleCloseHistoryModal}
        stylistName={selectedStylist?.name || ''}
        history={historyData}
        isLoading={isHistoryLoading}
      />

      <div className="bg-white rounded-lg shadow-lg overflow-hidden h-full flex flex-col">
        <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Manage Stylists</h2>
              <p className="text-sm text-gray-500 mt-1">View, add, or edit stylist information and history.</p>
            </div>
            {canCreate && (
              <button
                onClick={() => handleOpenFormModal()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                <PlusIcon className="h-5 w-5" />
                Add Stylist
              </button>
            )}
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <StylistSkeletonCard key={i} />)
          ) : stylists.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {stylists.map((stylist) => (
                <div key={stylist._id} className="group bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-indigo-300 transition-all duration-300 flex flex-col">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-4">
                      <UserCircleIcon className="h-16 w-16 text-gray-300" />
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">{stylist.name}</h3>
                        <p className="text-sm text-indigo-600 font-medium">{stylist.specialization}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="text-gray-600"><span className="font-medium text-gray-800">Experience:</span> {stylist.experience} years</p>
                      <p className="text-gray-600"><span className="font-medium text-gray-800">Phone:</span> {stylist.phone || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="mt-5 pt-4 border-t border-gray-100 flex justify-end items-center gap-2">
                    <button onClick={() => handleViewHistory(stylist)} className="p-2 text-gray-500 hover:text-indigo-600 rounded-full hover:bg-indigo-50 transition-colors" title="View History">
                      <ClockIcon className="h-5 w-5" />
                    </button>
                    {canUpdate && (
                      <button onClick={() => handleOpenFormModal(stylist)} className="p-2 text-gray-500 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors" title="Edit Stylist">
                        <PencilIcon className="h-5 w-5" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => handleDelete(stylist._id)} className="p-2 text-gray-500 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors" title="Delete Stylist">
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500">
              <h3 className="text-lg font-semibold">No Stylists Found</h3>
              <p className="mt-1">Click the &quot;Add Stylist&quot; button to get started.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
